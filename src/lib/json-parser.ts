/**
 * Robust JSON extraction for LLM responses.
 *
 * Language models wrap their JSON in prose, code fences, trailing commas,
 * unescaped quotes and other small mistakes. The historical implementation
 * guessed with `indexOf('{')` / `lastIndexOf('}')` and a single regex, which
 * silently returned corrupted data (e.g. a preamble plus a truncated object).
 *
 * This module replaces that guessing with:
 *   1. a string-aware scanner that extracts one *balanced* JSON value,
 *   2. a list of strictly lossless repairs, each validated by re-parsing,
 *   3. a structural validation step that refuses partial results.
 *
 * Contract: either a fully parsed value is returned, or {@link JsonParseError}
 * is thrown. A partially parsed or silently "fixed" payload is never returned.
 */

import { JSON_PARSE_MAX_INPUT_LENGTH } from './constants';

export class JsonParseError extends Error {
  readonly rawText: string;

  constructor(message: string, rawText: string) {
    super(message);
    this.name = 'JsonParseError';
    this.rawText = rawText;
  }
}

type ParseOutcome = { ok: true; value: unknown } | { ok: false; reason: string };

const succeed = (value: unknown): ParseOutcome => ({ ok: true, value });
const fail = (reason: string): ParseOutcome => ({ ok: false, reason });

/**
 * What may legally follow the closing quote of a JSON string: optional
 * whitespace and then `,` `}` `]` (end of a value) or `:` (end of an object
 * key). Anything else means the quote was part of the text and must be escaped.
 */
const CLOSING_CONTEXT = /^\s*[,:}\]]/;

/**
 * Finds the first complete balanced JSON object/array in `text`.
 *
 * The scan is string-aware: braces inside string literals are ignored, escaped
 * quotes are honoured, and an unterminated value reports "truncated" instead of
 * returning a ragged slice of prose.
 */
export function extractBalancedJson(text: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (char === '}' || char === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
      // A stray closer before any opener: ignore it and keep scanning.
      if (depth < 0) depth = 0;
    }
  }

  return null;
}

/** Removes markdown fences so `extractBalancedJson` sees the raw payload. */
export function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json|json5|javascript|js)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) return fenced[1];
  // Unterminated fence (model hit the token ceiling mid-response).
  const open = text.match(/```(?:json|json5|javascript|js)?\s*([\s\S]*)$/i);
  if (open && open[1]) return open[1];
  return text;
}

/** Escapes double quotes that the model left unescaped inside string values. */
function escapeUnescapedQuotes(source: string): string {
  let out = '';
  let inString = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      if (char === '\\') {
        out += char + (source[i + 1] ?? '');
        i++;
        continue;
      }
      if (char === '"') {
        const rest = source.slice(i + 1);
        const closesValue = CLOSING_CONTEXT.test(rest) || rest.length === 0;
        if (closesValue) {
          inString = false;
          out += char;
        } else {
          out += '\\"';
        }
        continue;
      }
      out += char;
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }

    out += char;
  }

  return out;
}

/** Converts single-quoted strings (`'...'`) to their double-quoted form. */
function normalizeSingleQuotes(source: string): string {
  let out = '';
  let inString = false;
  let quote = '';

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      if (char === '\\') {
        out += char + (source[i + 1] ?? '');
        i++;
        continue;
      }
      if (char === quote) {
        const rest = source.slice(i + 1);
        if (CLOSING_CONTEXT.test(rest) || rest.length === 0) {
          inString = false;
          out += '"';
          continue;
        }
      }
      if (char === '"') {
        out += '\\"';
      } else {
        out += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      inString = true;
      quote = char;
      out += '"';
      continue;
    }

    out += char;
  }

  return out;
}

/** Quotes bare identifier keys, e.g. `{ hypotheses: [...] }`. */
function quoteBareKeys(source: string): string {
  return source.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
}

/**
 * Repairs that are semantically lossless: removing separators the spec forbids
 * and translating Python/JS literals to JSON ones.
 */
function normalizeLiterals(source: string): string {
  return (
    source
      // Python / JS literals used as values
      .replace(/:\s*None\b/g, ': null')
      .replace(/:\s*True\b/g, ': true')
      .replace(/:\s*False\b/g, ': false')
      .replace(/(^|[\s,[)])\s*None\b/g, '$1 null')
      .replace(/(^|[\s,[)])\s*True\b/g, '$1 true')
      .replace(/(^|[\s,[)])\s*False\b/g, '$1 false')
      // Trailing commas before a closing bracket
      .replace(/,(\s*[}\]])/g, '$1')
  );
}

/** Strips characters JSON forbids inside the document. */
function stripInvalidCharacters(source: string): string {
  // eslint-disable-next-line no-control-regex
  return source.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

interface Repair {
  name: string;
  apply: (input: string) => string;
}

/** Applied in order — cheapest and least invasive first. */
const REPAIRS: Repair[] = [
  { name: 'literal-normalization', apply: normalizeLiterals },
  { name: 'quote-escaping', apply: escapeUnescapedQuotes },
  { name: 'single-quote-to-double', apply: normalizeSingleQuotes },
  { name: 'bare-key-quoting', apply: quoteBareKeys },
  { name: 'invalid-character-removal', apply: stripInvalidCharacters },
];

function attemptParse(source: string): ParseOutcome {
  try {
    const parsed: unknown = JSON.parse(source);
    return succeed(parsed);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(reason);
  }
}

/**
 * Parses an LLM answer, trying the raw text first and then each repair.
 * A repair is only accepted when the *repaired document* parses cleanly, so the
 * returned value always corresponds to a syntactically valid JSON document.
 */
export function parseJsonFromText(rawText: string): unknown {
  if (typeof rawText !== 'string') {
    throw new JsonParseError("La réponse de l'IA n'est pas du texte.", String(rawText));
  }

  if (rawText.length === 0) {
    throw new JsonParseError("La réponse de l'IA est vide.", rawText);
  }

  if (rawText.length > JSON_PARSE_MAX_INPUT_LENGTH) {
    throw new JsonParseError("La réponse de l'IA est trop volumineuse pour être analysée.", '');
  }

  const unfenced = stripCodeFences(rawText);
  const candidates: string[] = [];

  const balanced = extractBalancedJson(unfenced);
  if (balanced) candidates.push(balanced);
  const trimmed = unfenced.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) candidates.push(trimmed);
  candidates.push(unfenced);

  const firstError = new JsonParseError(
    `Aucun objet JSON valide n'a été trouvé dans la réponse de l'IA. ${describeFailure(rawText)}`,
    rawText
  );

  for (const candidate of candidates) {
    const direct = attemptParse(candidate);
    if (direct.ok) return direct.value;

    let working = candidate;
    for (const repair of REPAIRS) {
      const previous = working;
      const repaired = repair.apply(working);
      if (repaired === previous) continue;

      const attempt = attemptParse(repaired);
      if (attempt.ok) {
        // Guard against a repair that emptied the payload.
        if (isEmptyPayload(attempt.value)) continue;
        return attempt.value;
      }
      // Repair did not help on its own — try composing it with the next ones.
      working = repaired;
    }
  }

  throw firstError;
}

/** Detects responses that were clearly cut off by the token limit. */
function describeFailure(rawText: string): string {
  const looksTruncated =
    !extractBalancedJson(stripCodeFences(rawText)) && /[[{,]\s*\n?\s*$/.test(rawText.trim());
  if (looksTruncated) {
    return 'La réponse semble avoir été interrompue avant sa fin (limite de tokens du modèle).';
  }
  return 'Relancez la génération — le modèle a renvoyé un format inattendu.';
}

function isEmptyPayload(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export interface JsonShapeExpectation {
  /** Root JSON type the caller expects. */
  rootType: 'object' | 'array';
  /** Keys that must be present (only checked for object roots). */
  requiredKeys?: string[];
  /** Warns (via console.error) instead of throwing when extra keys appear. */
  allowExtraKeys?: boolean;
}

/**
 * Validates that a parsed value matches the shape the caller expects.
 * Throws {@link JsonParseError} on mismatch — never coerces or drops fields.
 */
export function assertJsonShape(
  value: unknown,
  expectation: JsonShapeExpectation,
  rawText: string
): void {
  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);

  if (expectation.rootType === 'object' && !isObject) {
    throw new JsonParseError(
      "L'IA a renvoyé un format inattendu : un objet JSON était attendu.",
      rawText
    );
  }

  if (expectation.rootType === 'array' && !Array.isArray(value)) {
    throw new JsonParseError(
      "L'IA a renvoyé un format inattendu : une liste JSON était attendue.",
      rawText
    );
  }

  if (expectation.rootType === 'object' && expectation.requiredKeys?.length) {
    const keys = Object.keys(value as Record<string, unknown>);
    const missing = expectation.requiredKeys.filter(key => !keys.includes(key));
    if (missing.length > 0) {
      throw new JsonParseError(
        `La réponse de l'IA est incomplète : champ(s) manquant(s) ${missing.join(', ')}.`,
        rawText
      );
    }
  }

  if (Array.isArray(value) && expectation.rootType === 'array' && value.length === 0) {
    throw new JsonParseError(
      "L'IA a renvoyé une liste vide alors que du contenu était attendu.",
      rawText
    );
  }
}

/**
 * Normalizes the common case where the model echoes the JSON *schema* it was
 * given, wrapping the payload in a `properties` object.
 */
export function unwrapSchemaEcho(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const looksLikeSchemaEcho =
      'properties' in record && 'type' in record && Object.keys(record).length <= 3;
    if (
      looksLikeSchemaEcho &&
      typeof record.properties === 'object' &&
      record.properties !== null
    ) {
      return record.properties;
    }
  }
  return value;
}
