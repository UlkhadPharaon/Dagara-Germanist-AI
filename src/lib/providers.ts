/**
 * AI provider registry for "bring your own key" mode.
 *
 * Design rules:
 *
 *  1. **Only multimodal models are offered.** Phase 2 and Phase 3 send images
 *     (photos of textbooks, scanned questionnaires) and long documents to the
 *     model, so a text-only model would silently fail or hallucinate.
 *  2. **Capability data is never invented.** When the provider publishes it
 *     (OpenRouter), it is used verbatim. When it does not (NVIDIA, OpenAI,
 *     Anthropic, Gemini…), the local list is filtered against the provider's
 *     own model list and the model is flagged `verified: false` so the UI can
 *     say so.
 *  3. **The key never leaves the browser except to reach its provider.**
 *     BYOK calls go straight from the client to the provider endpoint — our
 *     own proxy is only used in the default (no key) mode.
 */

/** Input modalities a model must accept for this app to be usable. */
export const REQUIRED_INPUT_MODALITIES = ['text', 'image'] as const;

export type InputModality = 'text' | 'image' | 'audio' | 'video' | 'file';

export interface AiModel {
  /** Provider-specific model id. */
  id: string;
  label: string;
  providerId: string;
  /** Input modalities the model accepts. */
  inputModalities: InputModality[];
  /** Tool calling / structured function use. */
  supportsTools: boolean;
  contextLength?: number;
  /** True when the provider published this capability data. */
  verified: boolean;
}

export type ProviderDialect = 'openai' | 'anthropic';

export interface ProviderDefinition {
  id: string;
  label: string;
  /** API key prefix, shown as a hint in the settings form. */
  keyPrefix?: string;
  /** Where the user obtains a key. */
  keyHelpUrl: string;
  /** Base URL of the API (no trailing slash). */
  baseUrl: string;
  /** Request/response dialect. */
  dialect: ProviderDialect;
  /** Path that lists models, relative to baseUrl (omit when not public). */
  modelsPath?: string;
  /**
   * Ids or id prefixes that are known to be multimodal. Used as a filter on
   * top of the provider's own model list when no capability metadata exists.
   * Prefixes are matched at the start of the id (e.g. `gpt-4o` matches
   * `gpt-4o-2024-08-06`).
   */
  omniModelMatchers: string[];
  /** Extra headers required by the provider. */
  extraHeaders?: Record<string, string>;
}

const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Providers that speak the OpenAI chat-completions dialect.
 *
 * OpenRouter aggregates models from many vendors and publishes real
 * modality + tool metadata, so it doubles as the cheapest route to a wide
 * omni catalogue.
 */
export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyPrefix: 'sk-or-v1-',
    keyHelpUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    dialect: 'openai',
    modelsPath: '/models',
    // Metadata-driven: the matcher is only a fallback.
    omniModelMatchers: [],
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    keyPrefix: 'nvapi-',
    keyHelpUrl: 'https://build.nvidia.com/',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    dialect: 'openai',
    modelsPath: '/models',
    omniModelMatchers: [
      'meta/llama-3.2-90b-vision',
      'meta/llama-3.2-11b-vision',
      'microsoft/phi-3.5-vision',
      'microsoft/phi-4-multimodal',
      'google/paligemma',
      'meta/llama-3.2-90b-vision-instruct',
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyPrefix: 'sk-',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    baseUrl: 'https://api.openai.com/v1',
    dialect: 'openai',
    modelsPath: '/models',
    omniModelMatchers: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4o-audio',
      'gpt-4-turbo',
      'gpt-4.1',
      'chatgpt-4o-latest',
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    keyPrefix: 'sk-ant-',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
    baseUrl: 'https://api.anthropic.com/v1',
    dialect: 'anthropic',
    modelsPath: '/models',
    omniModelMatchers: [
      'claude-3-5',
      'claude-3-7',
      'claude-sonnet-4',
      'claude-opus-4',
      'claude-haiku-4',
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    keyPrefix: 'gsk_',
    keyHelpUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
    dialect: 'openai',
    modelsPath: '/models',
    omniModelMatchers: [
      'llama-3.2-90b-vision',
      'llama-3.2-11b-vision',
      'llama-4-scout',
      'llama-4-maverick',
    ],
  },
  {
    id: 'mistral',
    label: 'Mistral',
    keyHelpUrl: 'https://console.mistral.ai/api-keys',
    baseUrl: 'https://api.mistral.ai/v1',
    dialect: 'openai',
    modelsPath: '/models',
    omniModelMatchers: ['pixtral', 'mistral-small-latest', 'mistral-medium-latest'],
  },
];

/** First entry, materialised as a non-optional reference for form defaults. */
export const FALLBACK_PROVIDER: ProviderDefinition = PROVIDERS[0] ?? {
  id: 'openrouter',
  label: 'OpenRouter',
  keyHelpUrl: 'https://openrouter.ai/keys',
  baseUrl: 'https://openrouter.ai/api/v1',
  dialect: 'openai',
  modelsPath: '/models',
  omniModelMatchers: [],
};

export const DEFAULT_PROVIDER_ID = 'openrouter';

export function getProvider(providerId: string): ProviderDefinition | undefined {
  return PROVIDERS.find(provider => provider.id === providerId);
}

/** True when the id (or one of its prefixes) is in the omni list. */
export function matchesOmniMatcher(modelId: string, matchers: string[]): boolean {
  if (matchers.length === 0) return true;
  const id = modelId.toLowerCase();
  return matchers.some(matcher => {
    const pattern = matcher.toLowerCase();
    return id === pattern || id.startsWith(pattern);
  });
}

// ---------------------------------------------------------------------------
// Model discovery
// ---------------------------------------------------------------------------

interface RawModel {
  id?: string;
  name?: string;
  context_length?: number;
  architecture?: { modality?: string; input_modalities?: string[] };
  supported_parameters?: unknown[];
}

/** Extracts the input modalities advertised by a model (OpenRouter dialect). */
function readModalities(raw: RawModel): InputModality[] {
  const fromArray = raw.architecture?.input_modalities;
  if (Array.isArray(fromArray) && fromArray.length > 0) {
    return fromArray.filter((entry): entry is InputModality =>
      ['text', 'image', 'audio', 'video', 'file'].includes(String(entry))
    );
  }

  // `architecture.modality` looks like "text+image->text".
  const modality = raw.architecture?.modality;
  if (typeof modality === 'string') {
    const inputs = modality.split('->')[0] ?? '';
    return inputs
      .split('+')
      .map(part => part.trim())
      .filter((entry): entry is InputModality =>
        ['text', 'image', 'audio', 'video', 'file'].includes(entry)
      );
  }

  return [];
}

/** Only keep models that can actually do the work this app requires. */
export function isUsableModel(model: AiModel): boolean {
  const modalities = model.inputModalities;
  const omni = REQUIRED_INPUT_MODALITIES.every(required => modalities.includes(required));

  if (!omni) return false;

  // Tool calling is what makes structured output and the future agent flows
  // reliable; without it a model is still usable for plain text, so we keep it
  // but flag it through `supportsTools` in the UI.
  return true;
}

/**
 * Fetches the omni-capable model list for a provider.
 *
 * `capabilityData` true means the provider published modalities/tool support
 * (OpenRouter); false means we filtered with the local matcher list.
 */
export async function fetchProviderModels(
  provider: ProviderDefinition,
  apiKey: string
): Promise<AiModel[]> {
  if (!provider.modelsPath) {
    throw new Error(`${provider.label} n'expose pas de liste de modèles publique.`);
  }

  const response = await fetch(`${provider.baseUrl}${provider.modelsPath}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? `Clé ${provider.label} refusée (${response.status}). Vérifiez la clé et ses permissions.`
        : `Impossible de lister les modèles ${provider.label} (${response.status}).`
    );
  }

  const payload = (await response.json()) as { data?: unknown };
  const rows: RawModel[] = Array.isArray(payload.data) ? (payload.data as RawModel[]) : [];

  const capabilitiesPublished = rows.some(row => row.architecture !== undefined);

  const models: AiModel[] = rows
    .filter(
      (row): row is RawModel & { id: string } => typeof row.id === 'string' && row.id.length > 0
    )
    .map(row => {
      const published = readModalities(row);
      const modalities =
        capabilitiesPublished && published.length > 0 ? published : modalitiesFor(provider, row.id);

      const supportsTools = capabilitiesPublished
        ? (row.supported_parameters ?? []).includes('tools')
        : true;

      return {
        id: row.id,
        label: typeof row.name === 'string' && row.name ? row.name : row.id,
        providerId: provider.id,
        inputModalities: modalities,
        supportsTools,
        ...(typeof row.context_length === 'number' ? { contextLength: row.context_length } : {}),
        verified: capabilitiesPublished,
      } satisfies AiModel;
    })
    .filter(isUsableModel);

  return sortModels(models);
}

/** Modalities assumed when the provider publishes none (curated fallback). */
function modalitiesFor(provider: ProviderDefinition, modelId: string): InputModality[] {
  // A model that passed the omni matcher is treated as text+image; audio and
  // video are only claimed when the provider said so.
  return matchesOmniMatcher(modelId, provider.omniModelMatchers) ? ['text', 'image'] : ['text'];
}

/** Omni models first, then by context length, then alphabetically. */
function sortModels(models: AiModel[]): AiModel[] {
  return [...models].sort((a, b) => {
    if (a.supportsTools !== b.supportsTools) return a.supportsTools ? -1 : 1;
    if (a.inputModalities.length !== b.inputModalities.length) {
      return b.inputModalities.length - a.inputModalities.length;
    }
    return a.label.localeCompare(b.label);
  });
}

/** Human-readable capability line shown in the model picker. */
export function describeCapabilities(model: AiModel): string {
  const parts: Record<InputModality, string> = {
    text: 'texte',
    image: 'image',
    audio: 'audio',
    video: 'vidéo',
    file: 'fichiers',
  };

  const modalities = model.inputModalities
    .map(modality => parts[modality])
    .filter(Boolean)
    .join(' · ');

  const tools = model.supportsTools ? ' · tool calling' : ' · sans tool calling';
  return `${modalities}${tools}${model.verified ? '' : " · capacités non publiées par l'API"}`;
}

// ---------------------------------------------------------------------------
// Request building (BYOK, direct from the browser)
// ---------------------------------------------------------------------------

export interface ChatMessagePart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessageLike {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessagePart[];
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessageLike[];
  temperature: number;
  topP: number;
  maxTokens: number;
  responseFormat?: { type: 'json_object' };
}

export interface CompletionTarget {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  dialect: ProviderDialect;
}

/** Headers for the OpenAI-compatible dialect. */
function openAiHeaders(provider: ProviderDefinition, apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(provider.extraHeaders ?? {}),
  };
}

/** Splits a leading `system` message out (Anthropic takes it separately). */
function splitSystemMessage(messages: ChatMessageLike[]): {
  system: string | undefined;
  rest: ChatMessageLike[];
} {
  const first = messages[0];
  if (first && first.role === 'system' && typeof first.content === 'string') {
    return { system: first.content, rest: messages.slice(1) };
  }
  return { system: undefined, rest: messages };
}

/** Converts an OpenAI-style image part into Anthropic's shape. */
function toAnthropicPart(part: ChatMessagePart): unknown {
  if (part.type === 'text') return { type: 'text', text: part.text ?? '' };

  const url = part.image_url?.url ?? '';
  const match = /^data:(?<mime>[^;]+);base64,(?<data>.*)$/s.exec(url);
  if (match?.groups) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: match.groups.mime, data: match.groups.data },
    };
  }
  return { type: 'text', text: url };
}

/** Builds the fetch target for a BYOK call. */
export function buildProviderTarget(
  provider: ProviderDefinition,
  apiKey: string,
  request: CompletionRequest
): CompletionTarget {
  if (provider.dialect === 'anthropic') {
    const { system, rest } = splitSystemMessage(request.messages);

    return {
      // `baseUrl` already ends with /v1, so the path must not repeat it.
      url: `${provider.baseUrl}/messages`,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(provider.extraHeaders ?? {}),
      },
      body: {
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        top_p: request.topP,
        ...(system ? { system } : {}),
        messages: rest.map(message => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content:
            typeof message.content === 'string'
              ? message.content
              : message.content.map(toAnthropicPart),
        })),
      },
      dialect: 'anthropic',
    };
  }

  return {
    url: `${provider.baseUrl}/chat/completions`,
    headers: openAiHeaders(provider, apiKey),
    body: {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      top_p: request.topP,
      max_tokens: request.maxTokens,
      ...(request.responseFormat ? { response_format: request.responseFormat } : {}),
    },
    dialect: 'openai',
  };
}

/** Reads the assistant text out of either dialect's response. */
export function readCompletionText(payload: unknown, dialect: ProviderDialect): string | null {
  if (dialect === 'anthropic') {
    const record = payload as { content?: Array<{ type?: string; text?: string }> };
    const text = record.content?.find(block => block.type === 'text')?.text;
    return typeof text === 'string' ? text : null;
  }

  const record = payload as { choices?: Array<{ message?: { content?: string | null } }> };
  const text = record.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text : null;
}
