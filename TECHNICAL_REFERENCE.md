# TECHNICAL REFERENCE

Living technical map of the Dagara Germanist AI codebase. Kept in sync with the
implementation; update after each phase.

## 1. Stack (verified)

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | React | ^19.0.0 |
| Build | Vite | ^6.2.0 |
| Language | TypeScript | ~5.8.3 (strict mode) |
| Styling | Tailwind CSS v4 + @tailwindcss/typography | ^4.1.14 |
| Animation | motion/react | ^12.23.24 |
| Charts | Recharts | ^2.15.0 |
| Markdown | react-markdown + remark-gfm | ^10.1.0 |
| Icons | lucide-react | ^0.475.0 |
| DOCX read | mammoth | ^1.11.0 (dynamically imported, typed via `src/types/mammoth.d.ts`) |
| Lint | ESLint 10 (flat, type-checked) + Prettier 3 | ^10.14.0 / ^3.9.10 |
| Mobile | Capacitor | ^8.2.0 (Android only) |

The OpenAI SDK and Express are **no longer part of the client graph**.
AI calls go through `fetch` to the app's own proxy.

## 2. Commands

```bash
npm run dev           # vite dev server (proxies /api/nvidia → NVIDIA)
npm run build         # vite build → dist/
npm run preview       # serve the production build
npm run typecheck     # tsc --noEmit
npm run lint          # typecheck + eslint (zero warnings allowed)
npm run lint:fix      # eslint --fix
npm run format        # prettier --write .
npm run format:check  # prettier --check .
npm run test          # vitest run
npm run build:apk     # vite build → cap sync android → gradlew assembleDebug
```

## 3. Directory map

```
src/
  App.tsx                     App shell: state, persistence, tab routing
  main.tsx                    React root
  types.ts                    Data models + PhaseProps / ProjectUpdater
  types/mammoth.d.ts          Minimal typings for mammoth (no bundled types)
  components/
    Phase0..Phase4.tsx        The five research phases
    HistoryTab.tsx            Action log
    Chatbot.tsx               Contextual AI assistant
    QuickOverview.tsx         First-run guided tour (8 steps)
    AppHeader.tsx             Header: model selector, FR/DE, project name, save status
    AppSidebar.tsx            Phase nav, project list, import/export
    ProgressStepper.tsx       Five-step phase indicator
    ErrorBoundary.tsx         Class boundary (per-section crash isolation)
    PhaseBoundary.tsx         Named wrapper around ErrorBoundary
    Toast.tsx / ConfirmDialog.tsx / SplashScreen.tsx / EmptyState.tsx
  lib/
    api.ts                    AI provider abstraction (fetch-based)
    json-parser.ts            Tolerant LLM-JSON extraction + validation
    projects.ts               Project normalisation / validation
    resources.ts              User documents & notes: context building, truncation
    storage.ts                Typed localStorage access (Supabase swap point)
    constants.ts              All magic values
    tabs.ts                   Workflow tab definitions
    tool-definitions.ts       Phase 2 tool catalogue + styles
    toast.ts / export.ts / monitoring.ts / supabase.ts / migration.ts / auth-context.tsx
  hooks/
    useProjectSync.ts         Local/cloud persistence selection
scripts/                      Node diagnostics (tsx)
supabase/migrations/          Database schema (Phase 2)
```

## 4. AI layer

### Two modes

| Mode | Trigger | Where the request goes |
|------|---------|------------------------|
| **Default** | no personal key | the app's `/api/nvidia` proxy (Vite plugin in dev, `api/nvidia/[...path].ts` Edge function on Vercel), which holds the key server-side |
| **BYOK** | provider + key + model configured | **straight from the browser to the provider** — the key is never sent to our servers |

The BYOK configuration lives in `localStorage` (`dagara-ai-model:byok`) and is
read through `src/lib/ai-config.ts`. Removing the key restores default mode; the
header then shows the bundled model selector again.

Proxy path: `/api/nvidia/chat/completions` (OpenAI-compatible body). The
bundled model list lives in `src/lib/constants.ts` → `AI_MODELS` and is
persisted under `dagara-ai-model`; the BYOK model comes from the stored config.

Retry policy (`RETRY_POLICY`): exponential backoff, max 3 retries, 1 s base,
15 s cap, jitter. JSON generation retries up to
`JSON_PARSE_MAX_ATTEMPTS` (3) total attempts, appending a stricter instruction
on each retry.

Every business function validates its payload before returning it
(`generateCadrage`, `generateLiteratureReview`, `analyzeData`,
`generateBibliography`, `refineArchitecturePart`). No partial or malformed LLM
output reaches application state.

### Providers (`src/lib/providers.ts`)

| id | Provider | Dialect | Key prefix |
|----|----------|---------|------------|
| `openrouter` | OpenRouter | openai | `sk-or-v1-` |
| `nvidia` | NVIDIA NIM | openai | `nvapi-` |
| `openai` | OpenAI | openai | `sk-` |
| `anthropic` | Anthropic | **anthropic** | `sk-ant-` |
| `groq` | Groq | openai | `gsk_` |
| `mistral` | Mistral | openai | — |

**Omni filter:** a model is offered only when it accepts `text` **and** `image`
input — Phase 2/3 send images and long documents, so a text-only model would
fail or hallucinate. When the provider publishes capability data (OpenRouter's
`input_modalities` / `supported_parameters`) it is used verbatim; otherwise the
local curated `omniModelMatchers` list filters the provider's own ids and the
model is flagged `verified: false`, which the UI surfaces as
"capacités non publiées par l'API".

**Anthropic adapter:** `x-api-key` + `anthropic-version` headers, the `system`
prompt is lifted out of `messages`, image parts are converted from
`image_url` to `{ type: 'image', source: { base64 } }`, and the response is read
from the content-block array.

## 5. Data model

`ProjectData` (see `src/types.ts`) — field names are a compatibility contract:
existing saved projects must keep loading, so only additive changes are allowed.

Tool IDs (`enseignants`, `eleves`, `inspecteurs`, `grille`) are keys inside
`ProjectData.tools` and must not be renamed. Tab IDs (`phase0`…`phase4`,
`history`) are the routing contract.

## 6. Storage keys

| Key | Contents |
|-----|----------|
| `dagara-projects` | `ProjectData[]` |
| `dagara-history` | `HistoryLog[]` (max 50, newest first) |
| `dagara-ai-model` | selected model slug |
| `fara-*` | legacy equivalents, migrated on first load |

## 6b. User resources (documents & notes)

`ProjectData.resources?: ProjectResource[]` — a per-project library of the
user's own files and notes.

| Field | Meaning |
|-------|---------|
| `kind` | `'fichier'` \| `'note'` |
| `content` | extracted plain text — the only form the AI ever sees |
| `enabled` | `false` keeps the document but excludes it from prompts |
| `size` / `mimeType` | metadata for files only |

Files are read **once** on import: DOCX locally via `mammoth`, other formats
through the model's OCR (`extractTextFromFile`). `buildResourceContext()` then
assembles the prompt block with `MAX_CHARS_PER_RESOURCE` (4 000) per document
and `MAX_TOTAL_CONTEXT_CHARS` (12 000) overall, truncating on word boundaries
and flagging the truncation so the model knows the material is incomplete.
Phase 3 sends selected resources as `textSources` to `analyzeData`, so library
documents are analysed without re-uploading.

## 7. Conventions

* UI language is **French** — do not translate user-facing strings.
* Tailwind utility classes only; no CSS-in-JS. Primary `emerald-600`,
  accent `indigo-600`, analysis `purple-600`.
* Icons: lucide-react, always `aria-hidden="true"` when decorative.
* Every interactive element needs a visible label (`aria-label` when the icon
  carries the meaning).
* Comments and identifiers in English; user-facing copy in French.
* No `any`, no `@ts-ignore`, no `eslint-disable` as a permanent escape hatch.
  Root causes are fixed; the `src/types/mammoth.d.ts` declaration is the only
  place where an untyped dependency is bridged.
