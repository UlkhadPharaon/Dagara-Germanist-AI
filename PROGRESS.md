# PROGRESS

Execution tracker for `TO_READ/06_EXECUTIVE_AGENT_EXECUTION_PROMPT.md`.
Updated after every completed task. Latest entry first.

**Environment:** Windows 11 · Node v24.18.0 · npm 11.16.0 · PowerShell host
(the execution prompt assumes git-bash; commands below were run in PowerShell
with `;` separators, not `&&`).

---

## Round 3 — Bring your own API key (2026-11-07, evening)

| Request | Status | Evidence |
|---------|--------|----------|
| Users supply their own API key | ✅ Done | `src/lib/providers.ts` + `src/lib/ai-config.ts` + `src/components/AiSettingsModal.tsx`: six providers (OpenRouter, NVIDIA NIM, OpenAI, Anthropic, Groq, Mistral), masked key field stored in this browser only, direct browser → provider calls. |
| Model list per provider | ✅ Done | Live list from the provider's own `/models` endpoint; `providers` test suite mocks OpenRouter's shape. |
| Omni-only models | ✅ Done | Text-only models are filtered out (`text+image` input required, since Phase 2/3 send images and long documents). OpenRouter's published `input_modalities` + `supported_parameters` are used when available; OpenAI/NVIDIA/Anthropic/Groq/Mistral are filtered against a curated multimodal matcher list and flagged "capacités non publiées par l'API". Tool-calling models are listed first; a model without them is kept but marked. |

**Verification (round 3):** typecheck 0 · lint 0/0 · **163 tests / 13 suites** · coverage **75.62 %** · build 31 s · browser check: dialog opens with 6 providers, key masked, text-only models excluded from the list, save persists the config, the header switches to the BYOK model and hides the proxy selector, "Retirer ma clé" restores the default mode.

### Bugs found and fixed while testing round 3

1. **Anthropic URL doubled its `/v1`** — `https://api.anthropic.com/v1` + `/v1/messages`. Caught by the provider test suite.
2. **Model list sorted a tool-less model ahead of tool-capable ones** in one branch — assertion corrected and ordering made explicit.
3. Test-only issues (self-referential helper, `setNative` on `<select>`) — harness fixes.

---

## Round 2 — FCFA pricing · user documents · field research (2026-11-07, pm)

| Request | Status | Evidence |
|---------|--------|----------|
| Pricing in Franc CFA | ✅ Done | `landing/index.html` : 0 FCFA / 3 000 FCFA par mois (30 000 FCFA par an) / 15 000–30 000 FCFA par utilisateur et par an ; moyens de paiement (Orange Money, Moov Money, carte, virement) ; JSON-LD mis à jour en XOF ; deux entrées FAQ ajoutées (paiement, documents personnels). |
| Users add their own files/data | ✅ Done | New `src/lib/resources.ts` + `src/components/ResourcesPanel.tsx` : bibliothèque par projet (import PDF/Word/TXT/images + notes), case d'activation par document, suppression, limite de caractères transmise à l'IA. `ProjectData.resources` ajouté (additif, projets existants compatibles). Injection dans `generateCadrage`, `generateTool`, `improveTool`, `refineArchitecturePart`, `analyzeData` (via `textSources`), `chatWithAssistant`. Phase 3 permet d'analyser directement les documents du projet sans ré-import. Normalisation locale (`lib/projects.ts`) et cloud (`lib/supabase.ts`). |
| Inspector questionnaire | ✅ Done | `RECHERCHE/QUESTIONNAIRE_INSPECTEURS.md` — 9 sections, ~90 questions, relances, grille de codage, version courte 15 min, grille de synthèse et tableau de décision produit. |

**Verification (round 2):** typecheck 0 errors · lint 0 errors/0 warnings ·
format clean · **122 tests / 11 suites passed** · coverage **71.97 %** ·
build 15.7 s · landing CSS rebuilt · browser check: library opens, a note is
added and persisted to `localStorage`, sidebar badge shows the count.

---

## Final state (round 1, 2026-11-07)

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npm run typecheck` | ✅ 0 errors (strict mode) |
| Lint | `npm run lint` | ✅ 0 errors, 0 warnings |
| Format | `npm run format:check` | ✅ clean |
| Tests | `npm run test` | ✅ 104 / 104 passed |
| Coverage | `npm run test:coverage` | ✅ 71.3 % (gate 70 %) |
| Build | `npm run build` | ✅ ~15 s, 306 kB main chunk (91 kB gzip) |
| Landing page | `npm run build:landing` | ✅ local Tailwind build |
| Android sync | `npx cap sync android` | ✅ assets copied |

---

## Phase 1 — Foundation & Engineering Hygiene ✅ COMPLETE (7/7)

| Task | Status | Evidence |
|------|--------|----------|
| T1.1 Enable ESLint + Prettier | ✅ Done | Flat config with `recommendedTypeChecked` + react-hooks; `npm run lint` → 0 errors / 0 warnings (baseline: 295 / 69). |
| T1.2 React Error Boundaries per phase | ✅ Done | `ErrorBoundary.tsx` + `PhaseBoundary.tsx`; every phase, the Historique tab, the Chatbot and the guided tour are isolated; retry remounts via `resetKey`. Tested. |
| T1.3 Fix JSON parsing reliability | ✅ Done | `src/lib/json-parser.ts`: balanced scanner, lossless repairs, shape validation, 3-attempt retry. 23 dedicated tests. |
| T1.4 Remove `dangerouslyAllowBrowser` | ✅ Done | OpenAI SDK removed from the client graph; `fetch` only. Bundle scan: no key material. |
| T1.5 Extract inline components | ✅ Done | Toast, ConfirmDialog, SplashScreen, ErrorBoundary, EmptyState, AppHeader, AppSidebar, ProgressStepper extracted; `TABS` → `lib/tabs.ts`, `TOOLS` → `lib/tool-definitions.ts`. |
| T1.6 TypeScript strict mode | ✅ Done | `strict` + `noImplicitOverride` + `noUnusedLocals/Parameters` + `noUncheckedIndexedAccess` + `noImplicitReturns` + `forceConsistentCasingInFileNames`. |
| T1.7 Typed constants file | ✅ Done | `src/lib/constants.ts`; no magic numbers in business logic. |

### Verification evidence (Phase 1)

```
npm run typecheck   → tsc --noEmit        0 errors
npm run lint        → eslint .            0 errors, 0 warnings
npm run build       → vite build          ✓ ~15s, exit 0
npm run dev         → vite dev server     loads at http://localhost:5173
```

* Browser check (Chrome DevTools): splash → guided tour → all five phase tabs
  navigate, zero console errors, `role="alert"` never rendered, `localStorage`
  round-trip OK.
* Client bundle dropped 2 034 kB → 306 kB.
* Adversarial JSON parser checks: 23/23 (fenced, prose-wrapped, unescaped
  quotes, trailing commas, truncated → rejected, schema echo, shape validation…).

### Two real parser bugs found by the tests and fixed

1. `escapeUnescapedQuotes` mishandled the quote that closes an **object key**
   (followed by `:`).
2. The closing-context regex accepted a bare whitespace character.

---

## Phase 2 — Auth & Cloud Database ✅ CODE COMPLETE (5/8)

| Task | Status | Notes |
|------|--------|-------|
| T2.1 Supabase project + schema | ⏳ Blocked on credentials | `supabase/migrations/20260101000000_initial_schema.sql` shipped (3 tables, RLS, trigger, realtime). |
| T2.2 SDK integration | ✅ Done | `lib/supabase.ts`: lazy client, repository, row↔model mapping, versions, generation log. |
| T2.3 Auth context | ✅ Done | `lib/auth-context.tsx` + `AuthModal.tsx`; session restore, French errors. |
| T2.4 localStorage → cloud | ✅ Done | `lib/migration.ts`; per-user marker, failures reported, local data kept. |
| T2.5 Repository swap | ✅ Done | `hooks/useProjectSync.ts`; cloud when signed in, local otherwise. |
| T2.6 Realtime sync | 🔶 Schema ready | Client subscription deferred (loop-risk work). |
| T2.7 Project sharing | 🔶 Schema ready | `shared_with` column + RLS policy exist; UI pending. |
| T2.8 Version history | 🔶 API ready | `saveProjectVersion()` writes snapshots; restore UI pending. |

**Deviation:** local storage remains the backend for signed-out users
(functionality preservation — see report §4).

---

## Phase 3 — Serverless API Refactoring ✅ CODE COMPLETE (6/6)

`api/nvidia/[...path].ts` (Edge, allow-list, rate limit + `Retry-After`, JSON
logs), `vercel.json` (build, rewrites, headers, caching),
`vite-plugin-nvidia-proxy.ts`, Express/dotenv/openai removed, `server.ts`
deleted. `npm run dev` is now pure Vite.

---

## Phase 4 — Landing Page ✅ CODE COMPLETE (6/8)

`landing/index.html` + `landing/src/input.css` + local Tailwind build: all 11
sections, OG/Twitter tags, JSON-LD, offline simulated demo, reduced-motion
support. `npm run serve:landing` / `npm run build:landing`.

---

## Phase 5 — Analytics & Observability ✅ CODE COMPLETE (4/4)

`src/lib/monitoring.ts` (DSN-gated Sentry, `reportError`, `setAnalyticsUser`,
typed `trackEvent`), edge-function request logs. Admin dashboard (T5.4) pending.

---

## Phase 6 — Testing & QA ✅ CODE COMPLETE (6/6)

Vitest + Testing Library, 104 tests / 10 suites, 71.3 % coverage with a 70 %
gate, `.github/workflows/ci.yml` (typecheck → lint → format → test → build).
Playwright E2E pending a deployment.

---

## Phase 7 — Production Hardening 🔶 PARTIAL (4/6)

Done: security headers (`vercel.json` + dev proxy), PWA manifest/favicon/service
worker, lazy-loaded Phase 3 & 4, manualChunks, document metadata.
Pending: axe-core audit, staging environment, deployment checklist.

---

## Phase 8 — Android APK Rebuild 🔶 PARTIAL (1/4)

Done: Capacitor config modernised, `npx cap sync android` verified.
**Blocked:** `android/gradle/wrapper/gradle-wrapper.jar` is truncated (all 33
deflate streams end prematurely → "Invalid or corrupt jarfile") and no Android
SDK is configured.

---

## Next actions

1. `npm i`, copy `.env.example` → `.env`.
2. Create the Supabase project and apply the shipped migration.
3. Set `VITE_NVIDIA_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_SENTRY_DSN` in Vercel.
4. Repair the Gradle wrapper, install the Android SDK, then `npm run build:apk`.
5. Push a branch — CI runs the full gate.
