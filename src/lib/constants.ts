/**
 * Typed constants for Dagara Germanist AI.
 *
 * Every magic number or literal string that drives behaviour lives here so that
 * the business logic in `api.ts`, `App.tsx` and the phase components stays
 * readable and testable. UI chrome styling stays with Tailwind classes.
 */

// ---------------------------------------------------------------------------
// Storage keys (localStorage — see `src/lib/storage.ts` for the access layer)
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  projects: 'dagara-projects',
  history: 'dagara-history',
  aiModel: 'dagara-ai-model',
  /** Legacy keys from the previous product name, migrated on first load. */
  legacyProjects: 'fara-projects',
  legacyHistory: 'fara-history',
  legacyAiModel: 'fara-ai-model',
} as const;

// ---------------------------------------------------------------------------
// AI provider configuration
// ---------------------------------------------------------------------------

/** Proxy path served by the local dev server / Vercel edge function. */
export const API_BASE_PATH = '/api/nvidia';

/** NVIDIA Integration API upstream, used by the server-side proxy only. */
export const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1';

export const DEFAULT_AI_MODEL = 'meta/llama-3.1-70b-instruct';

/** Model slugs are part of the public contract with NVIDIA — do not rename. */
export const AI_MODELS = [
  { value: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B (Rapide)' },
  { value: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (Très Rapide)' },
  { value: 'mistralai/mistral-large-2-instruct', label: 'Mistral Large 2 (Puissant)' },
  {
    value: 'nvidia/llama-3.1-nemotron-70b-instruct',
    label: 'Nemotron 70B (Précis)',
  },
] as const;

export const GENERATION_SETTINGS = {
  /** Free-form text: creativity matters. */
  text: { temperature: 0.6, topP: 0.95 },
  /** Structured JSON: determinism matters. */
  json: { temperature: 0.2, topP: 0.95 },
  maxTokens: 4096,
} as const;

/** Retry policy for transient upstream errors (rate limits, 5xx). */
export const RETRY_POLICY = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  jitterMs: 1000,
} as const;

/** Maximum attempts (initial + retries) to obtain parsable JSON from the LLM. */
export const JSON_PARSE_MAX_ATTEMPTS = 3;

/** Hard ceiling on the size of a raw LLM response we attempt to parse. */
export const JSON_PARSE_MAX_INPUT_LENGTH = 2_000_000;

// ---------------------------------------------------------------------------
// Project / workflow constants
// ---------------------------------------------------------------------------

export const DEFAULT_PROJECT_NAME = 'Nouveau Projet';

export const DEFAULT_CYCLE = '1er cycle (6ème-3ème)';

export const RESEARCH_CYCLES = [
  '1er cycle (6ème-3ème)',
  'Second cycle (2nde-Tle)',
  'Les deux',
] as const;

/** Most recent action logs kept in memory and in storage. */
export const HISTORY_LIMIT = 50;

/** Restart the app with a fresh empty project when the last one is deleted. */
export const MIN_PROJECTS = 1;

/** Expected text-extraction payload ceiling for uploaded files (Phase 3). */
export const MAX_UPLOAD_FILES = 20;

/** Ceiling on user-supplied resources per project (free tier). */
export const MAX_RESOURCES_PER_PROJECT = 30;

// ---------------------------------------------------------------------------
// UI timings (milliseconds)
// ---------------------------------------------------------------------------

export const UI_TIMINGS = {
  toastDurationMs: 5000,
  splashDurationMs: 1500,
  saveIndicatorMs: 1000,
  /** Debounce applied to project list sorting animations. */
  listItemStaggerMs: 50,
} as const;

// ---------------------------------------------------------------------------
// Visual constants shared by several phases
// ---------------------------------------------------------------------------

export const DEFAULT_TOOL_STYLE = 'Standard / Neutre';

export const CHART_PALETTE = [
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const;

/** Colour used when the model did not pick one for a chart. */
export const DEFAULT_CHART_COLOR = CHART_PALETTE[1];

/** Fixed chart canvas height (px) — Recharts needs an explicit height. */
export const CHART_HEIGHT_PX = 256;

/** Quality/pixel ratio used when rasterising an analysis for PDF export. */
export const PDF_EXPORT = {
  quality: 0.98,
  pixelRatio: 2,
  orientation: 'portrait',
  format: 'a4',
} as const;
