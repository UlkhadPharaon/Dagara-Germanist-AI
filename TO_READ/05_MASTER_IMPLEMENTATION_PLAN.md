# 05 — Master Implementation Plan

## 5.1 Target Outcome

By end of implementation, Dagara Germanist AI will be a **deployable multi-tenant SaaS product** accessible at a public domain (e.g., `app.dagara.ai`), featuring:

- User authentication with Supabase (email/password + Google OAuth)
- Cloud-persisted projects with real-time sync
- Vercel-compatible deployment (Edge Functions instead of Express server)
- Marketing landing page at root domain
- Freemium model with usage tracking
- Analytics dashboard
- Production-ready error monitoring (Sentry)
- Comprehensive test suite
- WCAG 2.1 AA accessibility compliance baseline
- Functional Android APK rebuild from updated codebase

**Success Criteria:**
1. Zero data loss risk (cloud persistence)
2. Deployable to Vercel with one-click configuration
3. Landing page converts ≥2% of visitors to signups
4. All five original phases maintain functionality parity
5. No regression on existing working features

---

## 5.2 Implementation Phases

### PHASE 1 — Foundation & Engineering Hygiene

**Objective:** Stabilize the codebase foundation before adding new features.

| Task ID | Objective | Priority | Dependencies | Files Affected | Acceptance Criteria |
|---------|-----------|----------|--------------|----------------|---------------------|
| T1.1 | Enable ESLint + Prettier config | 🔴 High | None | Root directory | `npm run lint` passes with zero errors/warnings on all files |
| T1.2 | Add React Error Boundaries per phase | 🔴 High | T1.1 | Each Phase*.tsx wrapped | Single component crash does not kill entire app; error UI displayed instead |
| T1.3 | Fix JSON parsing reliability in `generateJSON()` | 🔴 High | T1.1 | `src/lib/api.ts` | Test cases with malformed LLM responses parse correctly; corrupted data never returned |
| T1.4 | Remove `dangerouslyAllowBrowser: true` from OpenAI client | 🟡 Medium | T1.1 | `src/lib/api.ts` | Proxy through server only; no browser-side API key exposure possible |
| T1.5 | Extract inline components (Chatbot, QuickOverview, HistoryTab, Toast, ConfirmDialog) into separate component files | 🟡 Medium | T1.1 | `src/components/` structure reorganized | Each extracted component exports independently; App.tsx imports reduced |
| T1.6 | Add TypeScript strict mode configuration | 🟡 Medium | T1.1 | `tsconfig.json` | Strict mode enabled, all type errors resolved, no `any` types except intentional |
| T1.7 | Move magic numbers/constants to typed constants file | 🟢 Low | T1.6 | New `src/lib/constants.ts` | Zero hardcoded magic numbers remain in business logic |

### PHASE 2 — Authentication & Cloud Database Migration

**Objective:** Replace localStorage with Supabase-powered cloud persistence and add user accounts.

| Task ID | Objective | Priority | Dependencies | Files Affected | Acceptance Criteria |
|---------|-----------|----------|--------------|----------------|---------------------|
| T2.1 | Create Supabase project and configure database schema | 🔴 High | None | Supabase console: `projects`, `project_versions`, `generations` tables | Schema migrated successfully; row-level security policies defined per table |
| T2.2 | Implement Supabase SDK integration in frontend | 🔴 High | T2.1 | `src/lib/supabase.ts`, `vite.config.ts` | Supabase client initialized; CRUD operations work for all three tables |
| T2.3 | Build auth context provider | 🔴 High | T2.1 | `src/lib/auth-context.tsx`, `src/main.tsx` | Login/signup flows work; session persists across reload; protected routes enforce auth |
| T2.4 | Migrate localStorage projects to Supabase | 🔴 High | T2.1, T2.2 | `src/lib/migration.ts` | Existing local projects detected and synced to cloud on first login |
| T2.5 | Replace all `localStorage` reads/writes in App.tsx with Supabase calls | 🔴 High | T2.4 | `src/App.tsx`, all Phase components | Zero `localStorage.getItem/setItem` calls remain for project data |
| T2.6 | Implement real-time sync (Supabase Realtime subscriptions) | 🟡 Medium | T2.5 | `src/lib/supabase.ts` | Multiple browser tabs show same project state instantly; conflict resolution works |
| T2.7 | Add project sharing feature (invite by email/link) | 🟢 Low | T2.6 | `src/App.tsx`, new `ProjectShareModal.tsx` | Shared users can view/edit project according to permissions |
| T2.8 | Add version history / project snapshots | 🟢 Low | T2.6 | Supabase: `project_versions` table | Every save creates a snapshot; restore any previous version |

### PHASE 3 — Serverless API Refactoring

**Objective:** Replace Express proxy with Vercel Edge Functions for NVIDIA NIM API calls.

| Task ID | Objective | Priority | Dependencies | Files Affected | Acceptance Criteria |
|---------|-----------|----------|--------------|----------------|---------------------|
| T3.1 | Create Vercel Edge Function for NVIDIA proxy | 🔴 High | None | `src/routes/api/nvidia/[...proxy].ts` | Endpoint mirrors OpenAI `/chat/completions` API; works on Vercel Edge Runtime |
| T3.2 | Update `api.ts` client baseURL to use Vercel edge function path | 🔴 High | T3.1 | `src/lib/api.ts` | All AI calls route through edge function without code changes |
| T3.3 | Remove Express `server.ts` dependency entirely | 🔴 High | T3.1, T3.2 | Root scripts updated | `npm run dev` uses Vite dev server directly; no Express process needed |
| T3.4 | Configure Vercel CLI build/deploy settings | 🟡 Medium | T3.3 | `vercel.json` | `vercel deploy` builds and deploys successfully with all assets |
| T3.5 | Add rate limiting at edge function level | 🟡 Medium | T3.1 | Edge function code | Rate limit enforced per-user; returns 429 with retry-after header |
| T3.6 | Add request logging/analytics for API calls | 🟢 Low | T3.1 | Edge function, analytics service | Usage metrics captured: model, tokens, latency, success/fail per user |

### PHASE 4 — Landing Page & Marketing Site

**Objective:** Build conversion-focused marketing website with integrated app access.

| Task ID | Objective | Priority | Dependencies | Files Affected | Acceptance Criteria |
|---------|-----------|----------|--------------|----------------|---------------------|
| T4.1 | Setup Next.js (or Astro) project alongside existing React app | 🟡 Medium | None | New `marketing/` directory | Dev server runs at localhost:3001; builds to static output |
| T4.2 | Implement all landing page sections from 04_UX_UI_AND_LANDING_PAGE.md | 🔴 High | T4.1 | `marketing/app/page.tsx` + components | All 11 sections rendered with copy matching spec; responsive at 320px |
| T4.3 | Create interactive demo section with simulated AI responses | 🟡 Medium | T4.1 | `marketing/components/SimulatedDemo.tsx` | Typing any topic shows realistic AI-generated output (pre-canned responses) |
| T4.4 | Connect "Sign Up" / "Log In" buttons to auth context | 🔴 High | T2.3, T4.2 | `marketing/components/AuthButtons.tsx` | Click redirects to app auth flow; returns to landing page after login |
| T4.5 | Add SEO metadata, Open Graph tags, structured data | 🟡 Medium | T4.2 | `marketing/app/layout.tsx` | Google Search Console accepts site; OG preview renders correctly |
| T4.6 | Add pricing page with subscription tiers | 🟡 Medium | T4.2 | `marketing/app/pricing/page.tsx` | Three pricing columns render; "Upgrade" button links to checkout |
| T4.7 | Add help/documentation page | 🟢 Low | T4.2 | `marketing/app/help/page.tsx` | FAQ accordion works; markdown content renders properly |
| T4.8 | Configure domain DNS and SSL | 🟡 Medium | T4.1, T4.4 | Vercel project settings | Custom domain resolves; HTTPS works; www redirect configured |

### PHASE 5 — Analytics & Observability

**Objective:** Add usage tracking, error monitoring, and performance metrics.

| Task ID | Objective | Priority | Dependencies | Files Affected | Acceptance Criteria |
|---------|-----------|----------|--------------|----------------|---------------------|
| T5.1 | Integrate Sentry for error monitoring | 🔴 High | None | `sentry.client.config.ts`, `sentry.edge.config.ts`, `sentry.server.config.ts` | Errors reported to Sentry dashboard; source maps uploaded on build |
| T5.2 | Integrate Vercel Analytics for page/view tracking | 🟡 Medium | None | Vercel dashboard; `middleware.ts` | Dashboard shows page views, geographic distribution, device breakdown |
| T5.3 | Track custom events (generation count, export count, feature usage) | 🟡 Medium | T2.3, T3.6 | `src/lib/analytics.ts` | Custom events fire at defined triggers; visible in Vercel/Sentry dashboards |
| T5.4 | Build admin dashboard showing team usage (institutional tier) | 🟢 Low | T2.7, T5.3 | `src/app/admin/dashboard/page.tsx` | Admin sees all team members, their project counts, generation quotas, usage stats |

### PHASE 6 — Testing & Quality Assurance

**Objective:** Establish comprehensive test coverage for critical paths.

| Task ID | Objective | Priority | Dependencies | Files Affected | Acceptance Criteria |
|---------|-----------|----------|--------------|----------------|---------------------|
| T6.1 | Setup Vitest + @testing-library/react | 🟡 Medium | None | `vitest.config.ts`, setup files | `npm run test` runs and discovers all test files |
| T6.2 | Write unit tests for `api.ts` functions (mock network calls) | 🔴 High | T6.1 | `src/lib/__tests__/api.test.ts` | All six wrapper functions tested; edge cases covered |
| T6.3 | Write unit tests for `generateJSON()` parser | 🔴 High | T6.1, T1.3 | `src/lib/__tests__/json-parser.test.ts` | Valid JSON, malformed JSON, markdown-wrapped JSON, brace-extracted JSON all handled |
| T6.4 | Write component snapshot tests for each Phase | 🟡 Medium | T6.1 | `src/components/__tests__/Phase{0-4}.test.tsx` | Snapshots match current rendering; easy to update as UI evolves |
| T6.5 | Write E2E tests with Playwright for core user journeys | 🟡 Medium | T6.1, T2.3 | `playwright.config.ts`, `e2e/` folder | Journey 1 (signup→create→generate→export) passes; journey 2 (edit→save→reload) passes |
| T6.6 | Add CI pipeline (GitHub Actions) with lint+build+test gates | 🟡 Medium | T6.1-T6.5 | `.github/workflows/ci.yml` | PRs blocked if lint fails, build fails, or tests fail |

### PHASE 7 — Production Hardening

**Objective:** Security, performance, and deployment readiness.

| Task ID | Objective | Priority | Dependencies | Files Affected | Acceptance Criteria |
|---------|-----------|----------|--------------|----------------|---------------------|
| T7.1 | Add Helmet.js security headers (or equivalent Vercel middleware) | 🔴 High | T3.4 | Security middleware | CSP, X-Frame-Options, X-Content-Type-Options, HSTS present |
| T7.2 | Audit and fix all accessibility issues (WCAG 2.1 AA) | 🟡 Medium | T6.1 | Throughout app | axe-core automated scan passes with zero violations; manual keyboard testing complete |
| T7.3 | Implement PWA (service worker, manifest, offline caching) | 🟡 Medium | T3.4 | `public/manifest.json`, `service-worker.ts` | Installable on Android/iOS; loads offline; fast initial paint |
| T7.4 | Performance optimization: lazy-load phase components, optimize bundle | 🟢 Low | T7.3 | `src/App.tsx` (dynamic imports) | Lighthouse score ≥90 on Performance; bundle size <300KB gzipped |
| T7.5 | Set up staging environment on Vercel | 🟡 Medium | T3.4 | Vercel project settings | Staging URL accessible; auto-deploys from `develop` branch; production from `main` |
| T7.6 | Document full deployment checklist | 🟢 Low | T7.5 | `DEPLOYMENT.md` | Checklist covers: env vars, DB migration, DNS, monitoring setup, rollback procedure |

### PHASE 8 — Android APK Rebuild & Distribution

**Objective:** Rebuild and distribute the Android application with new features.

| Task ID | Objective | Priority | Dependencies | Files Affected | Acceptance Criteria |
|---------|-----------|----------|--------------|----------------|---------------------|
| T8.1 | Verify Capacitor sync with new Vercel-deployed web build | 🟡 Medium | T3.4 | `capacitor.config.ts` | `npx cap sync android` produces working app pointing to deployed URL |
| T8.2 | Rebuild APK with Gradle | 🟡 Medium | T8.1 | `android/` build files | `gradlew assembleDebug` completes successfully |
| T8.3 | Test APK on physical Android devices (various OS versions) | 🟢 Low | T8.2 | Physical devices | Auth works, project sync works, AI generation works, PDF export works |
| T8.4 | Prepare Google Play Store listing (description, screenshots, privacy policy) | 🟢 Low | T8.3, T7.1 | Play Console | Listing optimized for keywords; screenshots cover all phases |

---

## 5.3 Protecting Existing Functionality

### What Must Remain Unchanged

| Feature | File | Constraint |
|---------|------|------------|
| Five-phase tab navigation | `src/App.tsx` TABS array | Tab IDs (`phase0`–`phase4`) must stay constant for routing compatibility |
| AI model selector dropdown values | `src/App.tsx` lines 442-446 | Model slugs must remain compatible with NVIDIA Integration API |
| Project data type shape | `src/types.ts` | Adding fields is safe; renaming/removing breaks migration logic |
| Tool type IDs | `src/components/Phase2.tsx` TOOLS array | Tool IDs (`enseignants`, `eleves`, `inspecteurs`, `grille`) are referenced by users in saved projects |
| French language throughout UI | Throughout | Do NOT translate UI strings — user's audience is Francophone |
| Language selector FR/DE scope | Only Phase 2 output | Do not extend DE language to other phases unless explicitly requested |
| Expression pattern in `generateTool()` prompts | `src/lib/api.ts` | Prompt templates drive quality of generated content — preserve exact wording |

### Data That Must Be Preserved

| Data | Source | Migration Path |
|------|--------|---------------|
| All existing projects | localStorage (`dagara-projects`) | One-time sync to Supabase `projects` table on first login (T2.4) |
| All existing history logs | localStorage (`dagara-history`) | Optional: migrate to `project_versions` table |
| Selected AI model preference | localStorage (`dagara-ai-model`) | Migrate to user profile in Supabase |
| Legacy project keys (`fara-projects`, `fara-history`) | localStorage | Detect during migration (already implemented in App.tsx lines 33-36); flag old entries |

### Functional Workflows That Must Not Regress

All six verified workflows listed in Project Reconstruction must maintain parity:
1. Literature review generation (Phase 0)
2. Framework generation + refinement (Phase 1)
3. Four tool types with style selection (Phase 2)
4. Manual editing + AI improvement of tools (Phase 2)
5. File upload + analysis + chart rendering (Phase 3)
6. Bibliography generation + full export (Phase 4)
7. Chatbot contextual conversations (Chatbot)
8. Import/export JSON projects
9. Sort and filter projects list
10. Print stylesheet functionality

---

## 5.4 Measurable Acceptance Criteria

| Category | Criterion | Verification Method |
|----------|-----------|-------------------|
| Authentication | Any user can create account with email/password | Manual test |
| Authentication | Session survives page reload and browser restart | Manual test |
| Authentication | Unauthenticated users redirected to login | Manual test |
| Persistence | Project created in Browser A appears instantly in Browser B | Two-tab test |
| Persistence | Deleted project cannot be recovered (except through version history) | Manual test |
| AI Generation | All six api.ts functions return valid responses under normal conditions | Unit tests + manual |
| JSON Parsing | Malformed LLM output is caught and retries gracefully (max 3 attempts) | Unit test with crafted inputs |
| Deployment | `vercel deploy --prod` succeeds with zero warnings | CI pipeline |
| Deployment | App loads correctly on custom domain over HTTPS | Manual test |
| Landing Page | Page renders in <2s on 3G simulation | Lighthouse audit |
| Accessibility | axe-core reports zero violations | Automated scan |
| Mobile | All interactive elements ≥44×44px touch target | Visual inspection |
| Offline | App loads cached shell without network connection | Chrome DevTools offline mode |
| Error Monitoring | Intentional error appears in Sentry dashboard within 60s | Manual trigger + verify |
| Performance | Lighthouse Performance ≥85, Best Practices ≥95, SEO ≥95 | Lighthouse audit |
| Tests | `npm run test` passes with ≥70% code coverage | CI pipeline |
| Security | No API keys exposed in client-side bundles | `npm run build` + grep for keys |

---

## 5.5 Final Production Requirements

### Platform Selection: Vercel

**Rationale:** React/Vite app + Next.js marketing site + Edge Functions + Analytics + Git integration = Vercel's native ecosystem. Supabase integration is straightforward. Deployment is simplest possible path.

### Production Build Configuration

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ],
  "functions": {
    "src/routes/api/ninja/[...proxy].ts": {
      "runtime": "vercel-edge"
    }
  }
}
```

### Environment Variables (by name, not values)

| Variable | Scope | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Vercel project | Supabase project URL |
| `SUPABASE_ANON_KEY` | Vercel project | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel only (edge) | Server-side RLS bypass for migrations |
| `NVIDIA_API_KEY` | Vercel edge function | NVIDIA GPU Cloud inference key |
| `SENTRY_DSN` | Vercel project | Sentry error monitoring |
| `NEXT_PUBLIC_SITE_URL` | Next.js marketing | Canonical URL for SEO |

### Domain Setup

1. Purchase domain (recommend: `dagara.ai` or `dagara-recherche.com`)
2. Point DNS to Vercel (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`)
3. Configure subdomains: `app.dagara.ai` (web app), `www.dagara.ai` (redirect), `api.dagara.ai` (optional)
4. Enable automatic HTTPS via Vercel's managed certificates

### Smoke Tests (Post-Deployment)

1. Navigate to landing page → verify hero section renders
2. Click "Commencer" → see signup form
3. Create test account → redirected to dashboard
4. Create new project → saves to cloud
5. Generate literature review → receives response
6. Complete all 5 phases → export .doc file downloads
7. Check Sentry dashboard → zero unexpected errors

### Rollback Strategy

- Vercel keeps last 10 successful deployments available for instant rollback
- GitHub tag (`v1.x.x`) marks known-good commits
- Database migrations are forward-only; keep migration script for revert if critical bug found
- Rollback decision threshold: P0 (data loss, security breach) → immediate rollback; P1-P3 → patch next release
