/**
 * AI provider abstraction layer.
 *
 * All inference goes through the app's own proxy endpoint (`/api/nvidia/...`),
 * served either by the Vite dev server, an Express/Vercel function or a
 * Cloudflare Worker. The NVIDIA key therefore never reaches the browser, and
 * no browser-only SDK shim (e.g. `dangerouslyAllowBrowser`) is required —
 * plain `fetch` keeps the client runtime-agnostic.
 *
 * Callers only depend on the exported wrapper functions; switching provider or
 * proxy does not require changes elsewhere in the app.
 */

import type {
  BibliographyEntry,
  ChartData,
  LiteratureReview,
  ProjectData,
  ProjectResource,
} from '../types';
import {
  API_BASE_PATH,
  DEFAULT_AI_MODEL,
  GENERATION_SETTINGS,
  JSON_PARSE_MAX_ATTEMPTS,
  RETRY_POLICY,
  STORAGE_KEYS,
} from './constants';
import {
  assertJsonShape,
  JsonParseError,
  parseJsonFromText,
  unwrapSchemaEcho,
} from './json-parser';
import { buildResourceContext, MAX_CHARS_PER_RESOURCE, truncateResource } from './resources';
import { readString, writeString } from './storage';

// ---------------------------------------------------------------------------
// Wire types (OpenAI-compatible chat completions)
// ---------------------------------------------------------------------------

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image_url';
  image_url: { url: string };
}

export type ContentPart = TextPart | ImagePart;

export type MessageContent = string | ContentPart[];

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: MessageContent;
}

/** Accepted input shapes for the text/JSON wrappers. */
export type GenerateInput = string | { parts: ContentPart[] };

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  top_p: number;
  max_tokens: number;
  response_format?: { type: 'json_object' };
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { total_tokens?: number };
}

/** Kept for backwards compatibility with existing prompt schema objects. */
export const SchemaType = {
  OBJECT: 'OBJECT',
  STRING: 'STRING',
  ARRAY: 'ARRAY',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
} as const;

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

/**
 * Resolves the proxy path.
 *
 * Kept relative on purpose: the same build must work behind any host or
 * reverse proxy (Vercel, Cloudflare, the Capacitor WebView, `vite preview`).
 * Only exotic schemes without a sense of "relative" (e.g. `file://` in a bare
 * WebView) need the absolute form.
 */
export function resolveApiBaseUrl(): string {
  const relative = API_BASE_PATH;

  if (typeof window === 'undefined') return relative;

  const origin = window.location?.origin;
  if (origin && origin !== 'null' && /^https?:\/\//.test(origin)) return relative;

  return origin ? `${origin}${relative}` : relative;
}

export function getSelectedModel(): string {
  const stored = readString(STORAGE_KEYS.aiModel);
  return stored ?? DEFAULT_AI_MODEL;
}

export function setSelectedModel(model: string): void {
  writeString(STORAGE_KEYS.aiModel, model);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Error handling & retries
// ---------------------------------------------------------------------------

export class AiServiceError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiServiceError';
    this.status = status;
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isRateLimitError(error: unknown): boolean {
  if (error instanceof AiServiceError && error.status === 429) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(message);
}

function isTransientError(error: unknown): boolean {
  if (error instanceof AiServiceError) {
    return error.status === undefined || [429, 500, 502, 503, 504].includes(error.status);
  }
  return false;
}

/** Converts any thrown value into a user-facing French message. */
function toUserMessage(error: unknown): string {
  if (error instanceof AiServiceError) {
    if (error.status === 401) {
      return "Erreur d'authentification (401). La clé API fournie est invalide ou a expiré.";
    }
    if (error.status === 403) {
      return "Accès refusé (403). Vérifiez que la clé API NVIDIA est valide et commence par 'nvapi-'.";
    }
    if (error.status === 404) {
      return "Modèle ou ressource introuvable (404). Le modèle sélectionné n'est peut-être plus disponible.";
    }
    if (error.status === 500 && /API key is missing/i.test(error.message)) {
      return "La clé API NVIDIA est manquante dans l'application. Veuillez configurer la variable d'environnement VITE_NVIDIA_API_KEY.";
    }
    if (error.status === 500) {
      return "Erreur interne du serveur (500). Le service d'IA rencontre actuellement des difficultés.";
    }
    if (error.status === 429 || /quota|rate.?limit/i.test(error.message)) {
      return "Le quota d'utilisation de l'IA a été dépassé. Veuillez réessayer dans quelques instants.";
    }
    return error.message;
  }

  if (error instanceof Error) {
    if (/Failed to fetch|NetworkError|connection error/i.test(error.message)) {
      return "Impossible de contacter les serveurs d'IA. Vérifiez votre connexion internet (Wi-Fi/4G).";
    }
    return error.message;
  }

  return "Une erreur inattendue s'est produite lors de la communication avec l'IA.";
}

/**
 * Runs an inference call with exponential backoff. Non-retryable errors are
 * surfaced immediately with their French message.
 */
async function withRetry<T>(apiCall: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await apiCall();
    } catch (error) {
      const retryable = isRateLimitError(error) || isTransientError(error);
      const rateLimited = isRateLimitError(error);

      if (!retryable) throw new AiServiceError(toUserMessage(error), statusOf(error));

      if (attempt >= RETRY_POLICY.maxRetries) {
        throw new AiServiceError(toUserMessage(error), statusOf(error));
      }

      attempt++;
      const exponential = RETRY_POLICY.baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * RETRY_POLICY.jitterMs;
      const wait = Math.min(exponential, RETRY_POLICY.maxDelayMs) + jitter;

      console.warn(
        `${rateLimited ? 'Limite de débit atteinte' : 'Erreur transitoire'} — nouvelle tentative ${attempt}/${RETRY_POLICY.maxRetries} dans ${Math.round(wait)}ms.`
      );
      await delay(wait);
    }
  }
}

function statusOf(error: unknown): number | undefined {
  if (error instanceof AiServiceError) return error.status;
  if (isRecord(error) && typeof error.status === 'number') return error.status;
  return undefined;
}

/**
 * Single low-level call: POST an OpenAI-compatible body to the proxy and
 * normalise the result into the assistant message content.
 */
async function createChatCompletion(body: ChatCompletionRequest): Promise<string> {
  let response: Response;

  try {
    response = await fetch(`${resolveApiBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new AiServiceError(toUserMessage(error));
  }

  if (!response) {
    throw new AiServiceError("Impossible de contacter le service d'IA.");
  }

  const rawText = await response.text();

  if (!response.ok) {
    throw new AiServiceError(toUpstreamMessage(rawText, response.status), response.status);
  }

  let payload: ChatCompletionResponse;
  try {
    const parsed: unknown = JSON.parse(rawText);
    payload = parsed as ChatCompletionResponse;
  } catch {
    throw new AiServiceError(
      'Le proxy a renvoyé une réponse illisible. Vérifiez la configuration du service.',
      response.status
    );
  }

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new AiServiceError(
      "L'IA n'a pas renvoyé de réponse. Veuillez réessayer.",
      response.status
    );
  }

  return content;
}

/** Forwards a proxy error body as a clear French message. */
function toUpstreamMessage(rawBody: string, status: number): string {
  let message = '';
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (isRecord(parsed) && typeof parsed.error === 'string') message = parsed.error;
    else if (
      isRecord(parsed) &&
      isRecord(parsed.error) &&
      typeof parsed.error.message === 'string'
    ) {
      message = parsed.error.message;
    }
  } catch {
    message = rawBody.slice(0, 200);
  }

  const synthetic = new AiServiceError(message || "Erreur du service d'IA.", status);
  return toUserMessage(synthetic);
}

// ---------------------------------------------------------------------------
// Shared message assembly
// ---------------------------------------------------------------------------

function normalizeInput(input: GenerateInput): MessageContent {
  if (typeof input === 'string') return input;

  if (isRecord(input) && Array.isArray(input.parts)) {
    const parts = input.parts.filter(
      (part): part is ContentPart => isRecord(part) && typeof part.type === 'string'
    );
    return parts.length > 0 ? parts : '';
  }

  return '';
}

function buildMessages(
  systemInstruction: string | undefined,
  content: MessageContent
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content });
  return messages;
}

function baseRequest(messages: ChatMessage[]): Omit<ChatCompletionRequest, 'response_format'> {
  return {
    model: getSelectedModel(),
    messages,
    temperature: GENERATION_SETTINGS.text.temperature,
    top_p: GENERATION_SETTINGS.text.topP,
    max_tokens: GENERATION_SETTINGS.maxTokens,
  };
}

// ---------------------------------------------------------------------------
// WRAPPER 1: Text generation
// ---------------------------------------------------------------------------

export async function generateText(
  input: GenerateInput,
  systemInstruction?: string
): Promise<string> {
  return withRetry(() =>
    createChatCompletion({
      ...baseRequest(buildMessages(systemInstruction, normalizeInput(input))),
    })
  );
}

// ---------------------------------------------------------------------------
// WRAPPER 2: JSON generation
// ---------------------------------------------------------------------------

const JSON_STRICT_SUFFIX =
  "\n\nTa réponse précédente n'était pas un JSON valide. Renvoie UNIQUEMENT l'objet JSON, " +
  'sans texte avant/après, sans bloc de code markdown, en échappant tous les guillemets ' +
  'doubles internes aux valeurs.';

/**
 * Requests structured output and returns a validated value.
 *
 * The response is parsed with the tolerant-but-lossless parser and re-requested
 * (max {@link JSON_PARSE_MAX_ATTEMPTS} times) when the model emits unparsable or
 * truncated JSON. A partial payload is never returned.
 */
export async function generateJSON<T = unknown>(
  input: GenerateInput,
  schema: unknown,
  systemInstruction?: string
): Promise<T> {
  const userContent = normalizeInput(input);
  const schemaInstruction =
    '\n\nLa structure doit correspondre à ce schéma JSON : ' +
    `${JSON.stringify(schema)}. ` +
    'Génère les données réelles, ne renvoie pas le schéma lui-même.';
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= JSON_PARSE_MAX_ATTEMPTS; attempt++) {
    const strictSuffix = attempt > 1 ? JSON_STRICT_SUFFIX : '';
    const content: MessageContent =
      typeof userContent === 'string'
        ? `${userContent}${schemaInstruction}${strictSuffix}`
        : [
            ...userContent,
            { type: 'text', text: JSON_GUIDANCE + schemaInstruction + strictSuffix },
          ];

    let raw: string;
    try {
      raw = await createChatCompletion({
        ...baseRequest(buildMessages(systemInstruction, content)),
        // Structured output: favour determinism over creativity.
        temperature: GENERATION_SETTINGS.json.temperature,
        response_format: { type: 'json_object' },
      });
    } catch (error) {
      if (isRateLimitError(error) || isTransientError(error)) continue;
      throw new AiServiceError(toUserMessage(error), statusOf(error));
    }

    try {
      const value = parseJsonFromText(raw);
      return unwrapSchemaEcho(value) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `JSON illisible reçu par le modèle (tentative ${attempt}/${JSON_PARSE_MAX_ATTEMPTS}) : ${lastError.message}`
      );
    }
  }

  throw new AiServiceError(
    "L'IA n'a pas renvoyé un format de données valide après plusieurs tentatives. " +
      (lastError?.message ?? 'Veuillez réessayer.')
  );
}

const JSON_GUIDANCE =
  'Réponds UNIQUEMENT par un objet JSON valide, sans texte de présentation ni bloc markdown, ' +
  "en échappant correctement les guillemets doubles à l'intérieur des valeurs.";

// ---------------------------------------------------------------------------
// WRAPPER 3: Chat
// ---------------------------------------------------------------------------

export async function chatWithAI(
  message: string,
  history: Array<{ role: string; text: string }>,
  systemInstruction: string
): Promise<string> {
  const historyMessages: ChatMessage[] = history.map(entry => ({
    role: entry.role === 'user' ? 'user' : 'assistant',
    content: entry.text,
  }));

  return withRetry(() =>
    createChatCompletion({
      ...baseRequest([
        ...(systemInstruction ? [{ role: 'system' as const, content: systemInstruction }] : []),
        ...historyMessages,
        { role: 'user' as const, content: message },
      ]),
    })
  );
}

// ---------------------------------------------------------------------------
// WRAPPER 4: File → AI part conversion
// ---------------------------------------------------------------------------

/** Reads a browser File into the base64 image part expected by the model. */
export async function formatFileForAI(file: File): Promise<ImagePart> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new AiServiceError('Lecture du fichier impossible.'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new AiServiceError('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });

  return { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}` } };
}

// ---------------------------------------------------------------------------
// Shape validation helpers — every LLM payload is checked before it is returned
// ---------------------------------------------------------------------------

function asStringArray(value: unknown, label: string, rawText: string): string[] {
  if (!Array.isArray(value)) {
    throw new JsonParseError(`Champ « ${label} » manquant ou de type incorrect.`, rawText);
  }
  const strings = value.filter((entry): entry is string => typeof entry === 'string');
  if (strings.length === 0 && value.length > 0) {
    throw new JsonParseError(`Champ « ${label} » : aucun élément textuel exploitable.`, rawText);
  }
  return strings;
}

function requireString(value: unknown, label: string, rawText: string): string {
  if (typeof value !== 'string') {
    throw new JsonParseError(`Champ « ${label} » manquant ou de type incorrect.`, rawText);
  }
  return value;
}

/** Safely renders an arbitrary model-provided label as a chart category name. */
function pointToLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/**
 * Runs shape validation and normalises the failure into {@link AiServiceError}
 * so callers only have to deal with one error type (and one French message).
 */
function validated<T>(build: () => T): T {
  try {
    return build();
  } catch (error) {
    if (error instanceof JsonParseError) throw new AiServiceError(error.message);
    throw error;
  }
}

export interface CadrageResult {
  hypotheses: string[];
  questions: string[];
  objectives: { general: string; specific: string[] };
}

export interface AnalysisPayload {
  content: string;
  charts: ChartData[];
}

function toAnalysisPayload(value: unknown, rawText: string): AnalysisPayload {
  assertJsonShape(value, { rootType: 'object', requiredKeys: ['content', 'charts'] }, rawText);
  const record = value as Record<string, unknown>;

  const chartsValue = Array.isArray(record.charts) ? record.charts : [];
  const charts: ChartData[] = [];

  for (const entry of chartsValue) {
    if (!isRecord(entry)) continue;
    const title = requireString(entry.title, 'charts[].title', rawText);
    const rawType = requireString(entry.type, 'charts[].type', rawText);
    const type: ChartData['type'] = rawType === 'pie' ? 'pie' : 'bar';
    const data = Array.isArray(entry.data) ? entry.data : [];

    const points = data
      .filter(isRecord)
      .map(point => ({
        name: pointToLabel(point.name),
        value: typeof point.value === 'number' && Number.isFinite(point.value) ? point.value : 0,
      }))
      .filter(point => point.name.length > 0);

    if (points.length === 0) continue;

    charts.push({
      title,
      type,
      data: points,
      ...(typeof entry.color === 'string' ? { color: entry.color } : {}),
      ...(typeof entry.xAxisLabel === 'string' ? { xAxisLabel: entry.xAxisLabel } : {}),
      ...(typeof entry.yAxisLabel === 'string' ? { yAxisLabel: entry.yAxisLabel } : {}),
    });
  }

  return { content: requireString(record.content, 'content', rawText), charts };
}

function toLiteratureReview(value: unknown, rawText: string): LiteratureReview {
  assertJsonShape(
    value,
    { rootType: 'object', requiredKeys: ['keywords', 'theories', 'authors', 'summary'] },
    rawText
  );
  const record = value as Record<string, unknown>;
  return {
    keywords: asStringArray(record.keywords, 'keywords', rawText),
    theories: asStringArray(record.theories, 'theories', rawText),
    authors: asStringArray(record.authors, 'authors', rawText),
    summary: requireString(record.summary, 'summary', rawText),
  };
}

function toBibliography(value: unknown, rawText: string): BibliographyEntry[] {
  assertJsonShape(value, { rootType: 'array' }, rawText);
  return (value as unknown[])
    .filter(isRecord)
    .map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : `ref-${index + 1}`,
      citation: requireString(entry.citation, 'citation', rawText),
    }))
    .filter(entry => entry.citation.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Business logic (feature-level wrappers)
// ---------------------------------------------------------------------------

export async function generateCadrage(
  subject: string,
  cycle: string,
  context: string,
  resources?: ProjectResource[]
): Promise<CadrageResult> {
  const prompt = `Tu es Dagara Germanist AI for Inspector, expert en didactique de l'allemand au Burkina Faso.
  Génère l'architecture de recherche pour ce sujet :
  Sujet : ${subject}
  Cycle : ${cycle}
  Contexte : ${context}
  ${buildResourceContext(resources)}
  
  Directives :
  - Les hypothèses doivent être solides et liées au contexte burkinabè (APC, effectifs, etc.).
  - Les questions doivent problématiser le sujet.
  - Les objectifs doivent comporter un objectif général et des objectifs spécifiques.
  - Génère les données réelles basées sur le sujet, ne renvoie pas le schéma JSON lui-même.`;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      hypotheses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      questions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      objectives: {
        type: SchemaType.OBJECT,
        properties: {
          general: { type: SchemaType.STRING },
          specific: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
      },
    },
  };

  const raw = await generateJSON<Record<string, unknown>>(prompt, schema);

  return validated(() => {
    const rawText = JSON.stringify(raw);
    assertJsonShape(
      raw,
      { rootType: 'object', requiredKeys: ['hypotheses', 'questions', 'objectives'] },
      rawText
    );

    return {
      hypotheses: asStringArray(raw.hypotheses, 'hypotheses', rawText),
      questions: asStringArray(raw.questions, 'questions', rawText),
      objectives: {
        general: requireString(
          isRecord(raw.objectives) ? raw.objectives.general : undefined,
          'objectives.general',
          rawText
        ),
        specific: asStringArray(
          isRecord(raw.objectives) ? raw.objectives.specific : undefined,
          'objectives.specific',
          rawText
        ),
      },
    };
  });
}

export async function generateTool(
  project: ProjectData,
  toolType: string,
  manualName?: string,
  style?: string,
  customInstructions?: string
): Promise<string> {
  const langInstruction =
    project.language === 'de'
      ? "IMPORTANT: Tu DOIS générer l'outil ENTIÈREMENT EN ALLEMAND (questions, options de réponse, consignes)."
      : "Génère l'outil en français.";

  const prompt = `Tu es Dagara Germanist AI for Inspector. Conçois un outil de collecte de données pour une recherche en didactique de l'allemand au Burkina Faso.
  
  Sujet de la recherche : ${project.subject}
  Hypothèses : ${project.hypotheses.join(', ')}
  Questions de recherche : ${project.questions.join(', ')}
  ${buildResourceContext(project.resources)}
  
  Outil à concevoir : ${toolType}
  ${manualName ? `Manuel concerné : ${manualName}` : ''}
  
  Style d'élaboration (biais psychologique / approche) : ${style || 'Standard / Neutre'}
  Directives personnalisées de l'utilisateur : ${customInstructions || 'Aucune'}
  
  Directives :
  - Format professionnel, prêt à être copié dans Google Forms ou imprimé.
  - Utilise le format Markdown (titres, listes, tableaux si pertinent).
  - Adapte les questions au public cible (${toolType}) en tenant compte du style d'élaboration demandé.
  - Si des directives personnalisées sont fournies, respecte-les scrupuleusement.
  - ${langInstruction}`;

  return generateText(prompt);
}

export type RefinablePart = 'hypotheses' | 'questions' | 'objectives';

export type RefineResult = string[] | { general: string; specific: string[] };

export async function refineArchitecturePart(
  project: ProjectData,
  part: RefinablePart,
  instructions: string
): Promise<RefineResult> {
  const prompt = `Tu es Dagara Germanist AI for Inspector. Voici l'architecture de recherche actuelle :
  Sujet : ${project.subject}
  Hypothèses actuelles : ${project.hypotheses.join(', ')}
  Questions actuelles : ${project.questions.join(', ')}
  Objectifs actuels : Général: ${project.objectives.general}, Spécifiques: ${project.objectives.specific.join(', ')}
  ${buildResourceContext(project.resources)}

  L'utilisateur veut réviser UNIQUEMENT la partie : ${part}.
  Voici ses instructions de recadrage : "${instructions}"

  Génère une nouvelle version améliorée pour cette partie uniquement, en gardant la cohérence avec le reste du projet.`;

  const schema =
    part === 'objectives'
      ? {
          type: SchemaType.OBJECT,
          properties: {
            general: { type: SchemaType.STRING },
            specific: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          },
        }
      : { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } };

  const raw = await generateJSON<unknown>(prompt, schema);

  return validated(() => {
    const rawText = JSON.stringify(raw);

    if (part === 'objectives') {
      assertJsonShape(raw, { rootType: 'object', requiredKeys: ['general', 'specific'] }, rawText);
      const record = raw as Record<string, unknown>;
      return {
        general: requireString(record.general, 'general', rawText),
        specific: asStringArray(record.specific, 'specific', rawText),
      };
    }

    return asStringArray(raw, part, rawText);
  });
}

/** Client-side text extraction for DOCX inputs (other formats go to the model). */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.docx')) {
    const { extractRawText } = await import('mammoth');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error("Erreur lors de l'extraction du fichier Word :", error);
      throw new AiServiceError(
        "Impossible de lire le fichier Word. Assurez-vous qu'il n'est pas corrompu."
      );
    }
  }

  if (file.name.toLowerCase().endsWith('.doc')) {
    throw new AiServiceError(
      "Le format .doc n'est pas supporté. Veuillez enregistrer votre fichier au format .docx ou .pdf."
    );
  }

  const filePart = await formatFileForAI(file);
  const prompt =
    'Extrait tout le texte de ce document de manière fidèle, en conservant la structure (titres, listes, tableaux en Markdown). Ne rajoute aucun commentaire, renvoie uniquement le contenu du document.';

  return generateText({ parts: [filePart, { type: 'text', text: prompt }] });
}

export interface ChartRequest {
  id: string;
  type: 'bar' | 'pie';
  description: string;
}

/** A text source already held by the app (project resource, pasted transcript). */
export interface TextSource {
  name: string;
  content: string;
}

export async function analyzeData(
  project: ProjectData,
  files: File[],
  analysisType: string,
  instructions: string,
  chartRequests: ChartRequest[] = [],
  referenceTool?: string,
  textSources: TextSource[] = []
): Promise<AnalysisPayload> {
  const parts: ContentPart[] = [];

  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.docx')) {
      const { extractRawText } = await import('mammoth');
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await extractRawText({ arrayBuffer });
        parts.push({
          type: 'text',
          text: `--- Contenu du document Word : ${file.name} ---\n${result.value}\n--- Fin du document ---`,
        });
      } catch (error) {
        console.error("Erreur lors de l'extraction du fichier Word :", error);
        throw new AiServiceError(`Impossible de lire le fichier Word : ${file.name}`);
      }
    } else if (file.name.toLowerCase().endsWith('.doc')) {
      throw new AiServiceError(
        `Le format .doc n'est pas supporté pour le fichier "${file.name}". Veuillez l'enregistrer au format .docx ou .pdf avant de l'importer.`
      );
    } else {
      parts.push(await formatFileForAI(file));
    }
  }

  // Documents the user already stored in the project (no re-upload needed).
  for (const source of textSources) {
    const { text, truncated } = truncateResource(source.content, MAX_CHARS_PER_RESOURCE * 2);
    if (text.trim().length === 0) continue;
    parts.push({
      type: 'text',
      text: `--- Document de la bibliothèque : ${source.name} ---\n${text}${
        truncated ? '\n(document tronqué)' : ''
      }\n--- Fin du document ---`,
    });
  }

  const chartInstructions =
    chartRequests && chartRequests.length > 0
      ? `L'utilisateur a explicitement demandé de générer les graphiques suivants à partir des données fournies. Tu DOIS extraire les données correspondantes et les inclure dans le tableau 'charts' du JSON :\n${chartRequests
          .map(
            c =>
              `- Un graphique de type '${c.type}' (barres ou secteurs) représentant : "${c.description}"`
          )
          .join(
            '\n'
          )}\nSi les données exactes ne sont pas présentes, fais une estimation raisonnable basée sur le contexte ou renvoie un tableau vide pour ce graphique spécifique.`
      : 'Extrait des données quantitatives si possible pour générer des graphiques pertinents (optionnel).';

  const referenceInstruction = referenceTool
    ? `\nIMPORTANT - GRILLE D'ANALYSE À UTILISER :\nL'utilisateur a fourni une grille ou un outil spécifique pour structurer cette analyse. Tu DOIS utiliser cette grille comme cadre d'analyse principal pour évaluer les documents :\n"""\n${referenceTool}\n"""\n`
    : '';

  parts.push({
    type: 'text',
    text: `Tu es Dagara Germanist AI for Inspector. Effectue une analyse de ces données.
    Type d'analyse : ${analysisType}
    Instructions spécifiques : ${instructions}
    ${referenceInstruction}
    
    Contexte de la recherche :
    Sujet : ${project.subject}
    Hypothèses : ${project.hypotheses.join(', ')}
    
    Directives :
    - Utilise un langage rigoureux (échantillonnage, récurrence thématique, triangulation).
    - ${chartInstructions}
    - Retourne un objet JSON strict avec deux propriétés :
      1. "content" : Le texte de ton analyse en Markdown.
      2. "charts" : Un tableau de graphiques extraits des données.`,
  });

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      content: { type: SchemaType.STRING, description: "L'analyse détaillée en Markdown" },
      charts: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING, description: 'Titre du graphique' },
            type: { type: SchemaType.STRING, description: "Type de graphique: 'bar' ou 'pie'" },
            data: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING, description: 'Nom de la catégorie' },
                  value: { type: SchemaType.NUMBER, description: 'Valeur numérique' },
                },
              },
            },
          },
        },
      },
    },
  };

  const raw = await generateJSON<unknown>({ parts }, schema);
  return validated(() => toAnalysisPayload(raw, JSON.stringify(raw)));
}

export async function improveTool(
  project: ProjectData,
  toolType: string,
  currentContent: string,
  instructions: string
): Promise<string> {
  const langInstruction =
    project.language === 'de'
      ? "IMPORTANT: Tu DOIS générer l'outil ENTIÈREMENT EN ALLEMAND (questions, options de réponse, consignes)."
      : "Génère l'outil en français.";

  const prompt = `Tu es Dagara Germanist AI for Inspector. L'utilisateur souhaite améliorer ou modifier un outil de collecte de données existant.
  
  Sujet de la recherche : ${project.subject}
  Type d'outil : ${toolType}
  
  Contenu actuel de l'outil :
  """
  ${currentContent}
  """
  ${buildResourceContext(project.resources)}
  
  Instructions de modification : ${instructions}
  
  Directives :
  - Applique les modifications demandées.
  - Garde un format professionnel en Markdown.
  - ${langInstruction}`;

  return generateText(prompt);
}

export async function generateLiteratureReview(
  keywords: string,
  context: string
): Promise<LiteratureReview> {
  const prompt = `Tu es Dagara Germanist AI for Inspector, expert en didactique de l'allemand au Burkina Faso.
  L'utilisateur prépare une recherche et a fourni ces mots-clés : ${keywords}
  Contexte : ${context}
  
  Génère une proposition de revue de littérature comprenant :
  - Les concepts clés à définir.
  - Les théories didactiques pertinentes (ex: approche actionnelle, etc.).
  - Les auteurs de référence (généraux et spécifiques au contexte africain/burkinabè si possible).
  - Un bref résumé de la problématique potentielle.
  
  IMPORTANT : Assure-toi que tout le texte est compatible avec un format JSON (échappe les guillemets doubles si nécessaire).`;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      keywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      theories: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      authors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      summary: { type: SchemaType.STRING },
    },
  };

  const raw = await generateJSON<unknown>(prompt, schema);
  return validated(() => toLiteratureReview(raw, JSON.stringify(raw)));
}

export async function generateBibliography(project: ProjectData): Promise<BibliographyEntry[]> {
  const prompt = `Tu es Dagara Germanist AI for Inspector. Génère une bibliographie au format APA pour ce projet de recherche en didactique de l'allemand.
  Sujet : ${project.subject}
  Théories/Auteurs identifiés : ${project.literatureReview?.authors?.join(', ') || 'Non spécifié'}
  
  Fournis une liste de 5 à 10 références bibliographiques (livres, articles scientifiques) pertinents pour ce sujet, formatées strictement selon la norme APA.
  IMPORTANT : Si le titre contient des guillemets, utilise des guillemets simples (') ou assure-toi qu'ils sont correctement échappés dans le JSON final.`;

  const schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
        citation: { type: SchemaType.STRING, description: 'La référence complète au format APA' },
      },
    },
  };

  const raw = await generateJSON<unknown>(prompt, schema);
  return validated(() => toBibliography(raw, JSON.stringify(raw)));
}

export async function chatWithAssistant(
  project: ProjectData,
  message: string,
  history: Array<{ role: string; text: string }>
): Promise<string> {
  const systemInstruction = `Tu es Dagara Germanist AI for Inspector, un assistant virtuel spécialisé en didactique de l'allemand au Burkina Faso.
  Tu aides un chercheur/étudiant avec son projet.
  Contexte actuel du projet :
  Sujet : ${project.subject || 'Non défini'}
  Hypothèses : ${project.hypotheses?.join(', ') || 'Non définies'}
  ${buildResourceContext(project.resources)}
  
  Réponds de manière concise, académique et encourageante. Si les documents fournis ne permettent pas de répondre, dis-le plutôt que d'inventer.`;

  return chatWithAI(message, history, systemInstruction);
}
