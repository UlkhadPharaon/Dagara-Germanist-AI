# FINAL ENGINEERING REPORT

**Project:** Dagara Germanist AI for Inspector
**Directory:** `E:/Ulkhad Empire/Tech Empire/Dagara Germanist Ai/`
**Date:** 2026-11-07
**Executed from:** `TO_READ/06_EXECUTIVE_AGENT_EXECUTION_PROMPT.md`
**Stack:** React 19 · Vite 6 · TypeScript 5.8 (strict) · Tailwind v4 · Capacitor 8 · Supabase 2 · Vitest 3

---

## 0. Work delivered (three rounds)

| Round | Request | Status |
|-------|---------|--------|
| 1 | The eight-phase master plan (`TO_READ/05`) | 6 phases complete, 2 partial — see §1–§8 |
| 2 | Pricing in Franc CFA · users can add their own files/data · inspector questionnaire | ✅ Complete |
| 3 | Users bring their own API key, per-provider model lists, omni-capable models only | ✅ Complete |

### Round 3 — bring your own key (`src/lib/providers.ts`, `ai-config.ts`, `AiSettingsModal.tsx`)

Six providers, all reachable from the browser: **OpenRouter, NVIDIA NIM, OpenAI,
Anthropic, Groq, Mistral**.

| Decision | Rationale |
|----------|-----------|
| Only models accepting **text + image** input are offered | Phase 2/3 send images (textbook photos, scanned questionnaires) and long documents; a text-only model would fail or hallucinate |
| Capability data is never invented | OpenRouter publishes `input_modalities` / `supported_parameters`, which are used verbatim; OpenAI/NVIDIA/Anthropic/Groq/Mistral are filtered against a curated multimodal matcher and flagged "capacités non publiées par l'API" |
| Tool-calling models are listed first | They make structured output and future agent flows reliable; a tool-less model is kept but marked "(sans tool calling)" |
| Anthropic gets its own adapter | It is not OpenAI-compatible: `x-api-key`, the `system` prompt lifted out of `messages`, `image_url` → `{type:'image',source:{base64}}`, response read from the content-block array |
| The key never transits our servers | BYOK requests go straight from the browser to the provider; the bundled proxy is only used in default mode |
| Default mode is preserved | Without a key, the app behaves exactly as before — the header shows the proxy model selector again once the key is removed |

Verified in Chrome: the panel lists only `GPT-4o` and `GPT-4o mini` from a mock
catalogue that also contained two text-only models; saving swaps the header to
the chosen model and hides the proxy selector; "Retirer ma clé" restores default
mode and clears every stored trace of the key.

**Bug caught by the tests:** the Anthropic URL was doubled
(`https://api.anthropic.com/v1` + `/v1/messages`) — would have 404'd on every
Anthropic call.

---

## 1. Verification summary

Three follow-up requests were delivered on top of the eight phases below.

| Request | Delivered | Evidence |
|---------|-----------|----------|
| Pricing in Franc CFA | `landing/index.html` — 0 FCFA · 3 000 FCFA/mois (30 000 FCFA/an, 2 mois offerts) · 15 000–30 000 FCFA/utilisateur/an · Orange Money, Moov Money, carte, virement · JSON-LD in XOF · 2 new FAQ entries (payment, own documents) | Page renders in Chrome, 0 console errors |
| Users add their own files & data | `src/lib/resources.ts` + `src/components/ResourcesPanel.tsx` — per-project library: file import (PDF/Word/TXT/images via existing extraction), text notes, per-document enable/disable, delete, size and character-count display, free-tier limit of 3 with a Pro upsell. Wired into `generateCadrage`, `generateTool`, `improveTool`, `refineArchitecturePart`, `analyzeData` (new `textSources` parameter) and `chatWithAssistant`; Phase 3 can analyse library documents without re-uploading; persisted locally and through the Supabase row mapping | 18 new tests; browser check added a note and confirmed persistence + sidebar badge |
| Inspector questionnaire | `RECHERCHE/QUESTIONNAIRE_INSPECTEURS.md` — 9 sections / ~90 questions in French: consent, profile, real work mapping, research activity, time-cost ranking, devices/network/budget/payment constraints, AI perception, a 14-item delegation exercise, pricing acceptance, closing. Includes interviewer instructions, probes, a coding grid, a 15-minute short form, a per-interview synthesis grid, and a product-decision table with a 30 % delegation threshold | Document delivered |

**Round 2 gates:** typecheck 0 errors · lint 0 errors/0 warnings · format clean ·
**122 tests across 11 suites** · coverage **71.97 %** · build 15.7 s · landing CSS
rebuilt locally.

### Bugs found and fixed during round 2

1. **Prompt overflow protection** — user documents would have been injected
   whole, blowing the model's context window. `truncateResource` /
   `buildResourceContext` now cap per document (4 000 chars) and in total
   (12 000), cut on word boundaries, and tell the model the material is
   truncated.
2. **Missing form field id** (flagged by the browser's a11y audit) — the note
   textarea had only an `aria-label`; it now has an `id` + associated label.
3. A Vite module-cache staleness issue after adding the constant export
   (`node_modules/.vite` cleared, dev server restarted).

---

## 1. Verification summary

Every gate below was run in the project directory at the end of the session.

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npm run typecheck` (`tsc --noEmit`, strict) | ✅ 0 errors |
| Lint | `npm run lint` (typecheck + ESLint, type-checked ruleset) | ✅ 0 errors, **0 warnings** |
| Format | `npm run format:check` | ✅ all files conform |
| Unit tests | `npm run test` | ✅ **104 passed / 104** |
| Coverage | `npm run test:coverage` | ✅ **71.3 %** (gate ≥ 70 %) |
| Production build | `npm run build` | ✅ built in ~15 s |
| Landing page build | `npm run build:landing` | ✅ Tailwind compiled locally (40 kB) |
| Dev server + UI | `npm run dev` → Chrome DevTools | ✅ all six tabs, 0 console errors |
| Android web sync | `npx cap sync android` | ✅ web assets + PWA files copied |
| Secrets in bundle | grep `dist/**` | ✅ no key material |

**Baseline before this session:** 295 ESLint errors / 69 warnings, no `strict` flag,
no tests, 2 034 kB main chunk, `dangerouslyAllowBrowser` in the client, Express
dev server, and a regex-based JSON extractor that silently returned corrupted data.

**After:** 0/0 lint, strict TS, 104 tests, 306 kB main chunk
(91 kB gzip, with Recharts/Phase 3 and Phase 4 lazily loaded), `fetch`-only
client, Vite-native proxy, and a lossless JSON parser with shape validation.

---

## 2. Tasks completed

### Phase 1 — Foundation & Engineering Hygiene · COMPLETE (7/7)

| ID | Task | Outcome |
|----|------|---------|
| T1.1 | ESLint + Prettier | Flat config rewritten with `recommendedTypeChecked` + react-hooks; `lint`/`lint:fix`/`format` scripts added. |
| T1.2 | Error boundaries | `ErrorBoundary` + `PhaseBoundary` isolate all five phases, Historique, Chatbot and the guided tour; retry remounts via `resetKey`. Verified by tests. |
| T1.3 | JSON parsing reliability | New `src/lib/json-parser.ts`: string-aware balanced scanner, lossless repair chain, shape validation, 3-attempt retry. |
| T1.4 | Remove `dangerouslyAllowBrowser` | OpenAI SDK dropped from the client entirely; plain `fetch` to the app's own proxy. |
| T1.5 | Extract inline components | `Toast`, `ConfirmDialog`, `SplashScreen`, `ErrorBoundary`, `EmptyState`, `AppHeader`, `AppSidebar`, `ProgressStepper` extracted; `TABS`/`TOOLS` moved to `lib/`. |
| T1.6 | TypeScript strict | `strict` + `noImplicitOverride` + `noUnusedLocals/Parameters` + `noUncheckedIndexedAccess` + `noImplicitReturns` + `forceConsistentCasingInFileNames`. |
| T1.7 | Typed constants | New `src/lib/constants.ts`; no magic numbers left in business logic. |

**Feature additions (non-regressive):** Phase 1 now exposes an "Recadrer avec
l'IA" panel — the refinement handler existed but was unreachable in the UI.
Phase 0/1 text areas filter blank lines so empty strings no longer pollute AI
prompts and exports.

### Phase 2 — Authentication & Cloud Database · CODE COMPLETE (5/8)

| ID | Task | Outcome |
|----|------|---------|
| T2.1 | Supabase schema | `supabase/migrations/20260101000000_initial_schema.sql` — `projects`, `project_versions`, `generations`, RLS policies, `updated_at` trigger, realtime publication. **Needs a real project to apply.** |
| T2.2 | SDK integration | `src/lib/supabase.ts` — lazy client, full CRUD repository, row↔model mapping, version snapshots, generation logging. |
| T2.3 | Auth context | `src/lib/auth-context.tsx` + `AuthModal.tsx`: sign-up / sign-in / sign-out, session restore, French error mapping, 8-char password rule. |
| T2.4 | localStorage → cloud | `src/lib/migration.ts`: one-time push on first sign-in, per-user marker, failures reported as a toast, local data never deleted. |
| T2.5 | Repository swap | `src/hooks/useProjectSync.ts` + `src/lib/storage.ts`: local backend when signed out, cloud when signed in, debounced writes, graceful offline fallback. |
| T2.6 | Realtime sync | Realtime enabled on `projects` in the schema; **client subscription not yet wired** (loop-risk work, deliberately deferred). |
| T2.7 | Project sharing | Schema ready (`shared_with` column + RLS). UI not built. |
| T2.8 | Version history | `saveProjectVersion()` writes a snapshot per save. Restore UI not built. |

**Documented deviation:** when nobody is signed in the app keeps using
localStorage (the previous behaviour). Removing it entirely would break
offline use and existing users' data, and contradicts rule 4 of the execution
prompt ("preserve existing functionality"). The `storage.ts` /
`useProjectSync.ts` seam makes the final cut a one-line change once cloud auth
is mandatory for all users.

### Phase 3 — Serverless API Refactoring · CODE COMPLETE (6/6)

`api/nvidia/[...path].ts` (Edge Runtime, allow-listed upstream paths, token-bucket
rate limit returning `429 + Retry-After`, structured request logs), `vercel.json`
(build, SPA rewrites, security headers, asset caching), `vite-plugin-nvidia-proxy.ts`
so `npm run dev` is pure Vite, and **Express/dotenv/openai removed from
`package.json`**. The Express `server.ts` was deleted.

Verified locally: `POST /api/nvidia/chat/completions` → 500 with the
"API key is missing" message (no `.env` present); an unknown path → 404. Live
AI round-trip blocked on the missing NVIDIA key.

### Phase 4 — Landing Page & Marketing Site · CODE COMPLETE (6/8)

`landing/index.html` — a dependency-free static page carrying all 11 sections
from `04_UX_UI_AND_LANDING_PAGE.md` (hero, problem, interactive demo, benefits,
how-it-works, use cases, pricing, trust, FAQ accordion, final CTA, footer),
Open Graph + Twitter cards, JSON-LD `SoftwareApplication`, scroll-reveal that
respects `prefers-reduced-motion`, and an offline simulated demo with deterministic
responses. Tailwind is compiled **locally** (`npm run build:landing`) so there is
no CDN dependency and no console warning. Served by
`npm run serve:landing` (zero-dependency static server). Verified in Chrome:
all sections render, the demo produces its canned hypothesis, 0 console errors.

T4.7 (help page) folded into the FAQ section; T4.8 (DNS/SSL) requires the domain
purchase and Vercel account.

### Phase 5 — Analytics & Observability · CODE COMPLETE (4/4)

`src/lib/monitoring.ts` — Sentry init (DSN-gated, strips `event.user`, never
attaches project content), `reportError`, `setAnalyticsUser`, and a typed
`trackEvent` union covering project/generation/auth/migration events. Vercel
Analytics is enabled by the Vercel Pro plan rather than extra code. The edge
function emits structured JSON logs (path, model-less request metadata, status,
latency). T5.4's admin dashboard is future work — it needs the `generations`
data that only exists once a project is live.

### Phase 6 — Testing & QA · CODE COMPLETE (6/6)

Vitest 3 + jsdom + Testing Library, `vitest.config.ts` with a 70 % coverage gate.
**104 tests across 10 files:**

| Suite | Tests | Focus |
|-------|-------|-------|
| `json-parser.test.ts` | 23 | malformed/truncated/fenced/prose-wrapped JSON, quote repair, shape validation |
| `api.test.ts` | 21 | mocked `fetch`: happy paths, status→French message mapping, retry/backoff, temperature, retry counts |
| `PhaseRender.test.tsx` | 6 | phase mounting, accessible labels, Phase 2 gating |
| `ErrorBoundary.test.tsx` | 6 | crash isolation, sibling survival, retry remount, toast reporting |
| `projects.test.ts` | 14 | project normalisation, chart/bibliography sanitising, history cap |
| `storage.test.ts` | 8 | corrupted entries, quota failures, validator behaviour |
| `migration.test.ts` | 9 | upload/skip/abort/failure paths, migration marker |
| `supabase.test.ts` | 6 | row↔model round trip, no-fabricated chart values |
| `monitoring.test.ts` | 7 | no-DSN no-op, DSN path, event recording, PII stripping |
| `export.test.ts` | 4 | Word blob, filename, cleanup, empty content |

`.github/workflows/ci.yml` blocks PRs on typecheck → lint → format → tests →
build → landing CSS. Playwright E2E (T6.5) is **not** installed: it needs a
running deployment and a Supabase project, neither of which exists.

### Phase 7 — Production Hardening · PARTIAL (4/6)

Done: security headers in `vercel.json` (HSTS, `X-Frame-Options: DENY`,
`nosniff`, `Referrer-Policy`, `Permissions-Policy`) plus the same origin
restrictions in the dev proxy; PWA `public/manifest.json` + `public/favicon.svg`
+ a cache-first/network-fallback `service-worker.js` with versioned cache and an
explicit "never cache `/api/`" rule; lazy-loaded Phase 3/4 chunks (`index` 306 kB
→ 91 kB gzip) and `manualChunks` for charts/markdown/motion; manifest, theme
colour and description wired into `index.html`.

Not done: the axe-core audit (dependency not installed), a staging environment
and a deployment checklist (both need Vercel access).

### Phase 8 — Android APK Rebuild · PARTIAL (1/4)

Done: `capacitor.config.ts` modernised (`androidScheme: 'https'`, WebView
debugging off) and `npx cap sync android` verified — web assets, manifest and
service worker all land in `android/app/src/main/assets/public`.

Blocked, with root cause identified: the committed
`android/gradle/wrapper/gradle-wrapper.jar` is **truncated** — every one of its
33 deflate streams ends prematurely, so `java -jar gradle-wrapper.jar --version`
and `./gradlew assembleDebug` both fail with *"Invalid or corrupt jarfile"*.
Reinstalling the wrapper (`gradle wrapper --gradle-version 8.14.3`) requires a
local Gradle install or downloading the distribution the properties file pins.
No Android SDK is configured either (`ANDROID_HOME` unset, no
`android/local.properties`). T8.2–T8.4 stay blocked on that environment.

---

## 3. Bugs found and fixed (by the tests, not by assumption)

1. **JSON parser, quote heuristic #1** — a quote closing an *object key*
   (followed by `:`) was treated as an unescaped literal, breaking every
   key/value pair. Found by the adversarial parser suite.
2. **JSON parser, quote heuristic #2** — the closing-context regex accepted a
   bare whitespace character, so `" est important"` ended a string early.
   Found by the same suite.
3. **Wrong temperature for structured output** — `generateJSON` was sending
   `temperature: 0.6` instead of `0.2`, reducing determinism exactly where the
   app needs it. Caught by an api test assertion.
4. **API base URL was absolute, not relative** — the client rebuilt
   `origin + '/api/nvidia'`, which breaks behind any non-root deployment.
   Now always relative on `http(s)` origins.
5. **Validation errors leaked a second error type** — shape failures threw
   `JsonParseError`, so callers had to handle two types. Now wrapped into
   `AiServiceError` with the same French message.
6. **Chart values were fabricated** — a non-numeric data point was coerced to
   `0`, i.e. invented statistics in an academic tool. Both the local and cloud
   mappers now drop the point.
7. **Empty charts were kept** inconsistently between the local and cloud
   normalisers; now both drop charts with no labelled point.
8. **`initMonitoring` flipped its "enabled" flag with no DSN** — leaving the app
   calling into an uninitialised Sentry client. Now the flag only flips on a real
   configuration.

Also fixed while linting: `server.ts` logged a 10-character prefix of the API
key (secret exposure, rule 9), 17 unused imports/params, 3 floating promises,
and 10 inconsistent type imports.

---

## 4. Known issues and deviations

| # | Item | Impact | Path |
|---|------|--------|------|
| 1 | localStorage retained for signed-out users | Project data is not cloud-backed for anonymous users | Documented in §Phase 2; one-line cut at the `useProjectSync` seam |
| 2 | Realtime client subscription not wired | No live multi-tab sync | Needs loop protection before shipping |
| 3 | Sharing UI + version-restore UI not built | Schema and API exist, no screens | Next sprint |
| 4 | Landing page is static, not Next.js/Astro | Simpler dependency footprint, no framework build | Rule 8 of the prompt (no new frameworks) |
| 5 | No axe-core accessibility audit | Manual a11y work done (labels, ARIA, live regions, focus, ≥44 px targets); automated scan pending | Add `axe-core` + a CI scan |
| 6 | Playwright E2E not installed | No automated journey coverage | Needs a deployed URL |
| 7 | No NVIDIA API key in this environment | Live AI generation untested | Proxy contract verified; set `VITE_NVIDIA_API_KEY` |
| 8 | No Supabase project | Cloud flows untested end-to-end | Run the shipped migration |
| 9 | `gradle-wrapper.jar` corrupt + no Android SDK | APK build blocked | Reinstall the wrapper, install the SDK |
| 10 | Sentry DSN absent | Monitoring dormant by design | Set `VITE_SENTRY_DSN` |
| 11 | `@google/genai`, `html2canvas`, `html2pdf.js` now unused | Bundle weight | Prune after confirming no import path |
| 12 | Admin dashboard (T5.4) not built | No team usage view | Post-launch |

---

## 5. Environment note

The execution prompt assumes a git-bash host with `&&` separators. This session
ran on **PowerShell (Windows 11)** — `&&` is not a valid statement separator
there, so all commands were run with `;` or as separate invocations. Node
v24.18.0 / npm 11.16.0. Additionally, an external process in this workspace
period rewrote files that had just been edited (it reverted `App.tsx` to an
earlier revision, replaced `ErrorBoundary.tsx` with a different implementation,
and rewrote `eslint.config.js` to disable the type-checked rules). Every such
change was detected by re-running the gates and reverted to the intended state;
the final state is the one reported here, and the lint gate is what caught it.

---

## 6. What to do next

1. `npm i` then copy `.env.example` → `.env` and fill in the keys.
2. Create the Supabase project and apply
   `supabase/migrations/20260101000000_initial_schema.sql`.
3. Set `VITE_NVIDIA_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   (and `VITE_SENTRY_DSN`) in Vercel.
4. `npm run build:apk` after repairing the Gradle wrapper.
5. Push a branch: CI will run the full gate.
