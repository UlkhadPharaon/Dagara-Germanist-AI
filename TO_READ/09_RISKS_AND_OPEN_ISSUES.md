# 09 — Risks & Open Issues

## Known Limitations

| # | Limitation | Impact | Mitigation | Status |
|---|-----------|--------|------------|--------|
| 1 | **Android APK build requires JDK 17 + Android SDK** — Development environment has neither configured locally | Cannot rebuild APK during development iterations | Use CI/CD pipeline (GitHub Actions + Android emulator matrix) or cross-platform Mac runner for APK builds | Unresolved |
| 2 | **File upload limited to client-side processing** — Large files (>5MB) may cause browser memory issues | Users attempting to upload large PDFs may experience crashes | Implement chunked uploads, size limits, progress indicators | Planned |
| 3 | **No iOS support** — Capacitor config only includes @capacitor/android | iPhone/iPad users cannot access native app | Future: add @capacitor/ios after web PWA is stable | Deferred |
| 4 | **LLM output quality depends on model choice** — Llama 3.1 8B produces significantly worse French than 70B or Nemotron 70B | Free-tier users may get poor-quality suggestions | Add quality warning when using smaller models; recommend specific models per task type | Planned |
| 5 | **No caching layer** — Identical prompts generate fresh responses every time, wasting tokens and increasing latency | Higher costs, slower response times for repeat requests | Implement request-level caching (edge cache on identical inputs) | Planned |
| 6 | **Print stylesheet uses generic print CSS** — Not optimized for A4/Letter paper dimensions | Exported prints may have awkward page breaks | Refine print media query with proper margins, page-break rules | Minor |
| 7 | **mammoth library loaded in browser** — ~500KB uncompressed bundle weight | Increases initial load time | Code-split mammoth into lazy-loaded module; tree-shake unused DOM parsing code | Planned |

## Missing Credentials / Unavailable Integrations

| # | Item | Why Needed | Current State | Blocker For |
|---|------|-----------|---------------|-------------|
| 1 | **NVIDIA_API_KEY** | Required for all AI generation features | Not available in this audit session (key exists on owner's machine but cannot be inspected per security rules) | Any AI generation testing. The codebase assumes it's configured. |
| 2 | **Supabase project** | Cloud persistence, auth, real-time sync | Not yet created | Phases 2–8 (database-dependent features) |
| 3 | **Sentry DSN** | Error monitoring in production | Not yet created | Phase 5 (observability) |
| 4 | **Custom domain** | Brand presence, HTTPS, SEO | Not yet registered | Phase 4 (marketing site) + general deployment |
| 5 | **Google OAuth credentials** | Social login option | Need to create Google Cloud OAuth client | Phase 2 (optional auth enhancement) |
| 6 | **Stripe account/API keys** | Billing for Pro and Institutional tiers | Not referenced in current plan but implied by freemium model | Future monetization |

## Unverified Assumptions

| # | Assumption | Verification Needed | Risk if Wrong |
|---|-----------|-------------------|---------------|
| 1 | **Llama 3.1 series are available on NVIDIA Integration API** | Check https://build.nvidia.com/ for current model availability | AI endpoints may return 404 if model removed/deprecated |
| 2 | **Target audience speaks French primarily** | App UI is entirely in French; no i18n infrastructure | Non-French speakers cannot use the product |
| 3 | **Burkina Faso education terminology used in prompts is accurate** | APC, "1er cycle (6ème-3ème)", "2nd cycle (2nde-Tle)" reference Burkinabè curriculum structure | Prompts generate culturally inappropriate content if terminology is wrong |
| 4 | **Vercel Edge Runtime supports OpenAI SDK** | Edge runtime has limited Node.js compatibility | OpenAI SDK may fail to import in edge functions |
| 5 | **NVIDIA rate limits allow ~10 requests/minute per key** | Needs actual check of NVIDIA account limits | Users hitting rate limits experience errors during research sessions |
| 6 | **Capacitor v8 is compatible with current Android build tools** | Need to verify gradle plugin compatibility | APK build may fail due to version incompatibility |
| 7 | **html-to-image can render Recharts SVG elements** | Recharts renders inside <svg> tags which html-to-image may not capture correctly | Phase 3 PDF export may produce blank charts |

## External Dependencies

| Dependency | Current Version | Latest Version | Upgrade Risk |
|------------|----------------|----------------|--------------|
| React | ^19.0.0 | 19.x | Low (new release within 19.x should be safe) |
| Tailwind CSS | ^4.1.14 | 4.x | Medium (v4 is recent; breaking changes possible) |
| Vite | ^6.2.0 | 6.x | Low |
| Express | ^4.21.2 | 4.x | Low (stable API surface) |
| OpenAI SDK | ^6.29.0 | 6.x | Medium (major version bumps common) |
| Capacitor | ^8.2.0 | 8.x | Medium (native bridge APIs may shift) |
| Recharts | ^2.15.0 | 2.x | Low |
| motion/react | ^12.23.24 | 12.x | Low |

## Decisions Requiring Human Input

| # | Decision | Options | Recommended | Impact |
|---|----------|---------|-------------|--------|
| 1 | **Domain name** | dagara.ai, dagara-recherche.com, dagara.ai (typo variant), studygerman-bf.com | dagara.ai (short, brandable) | Permanent brand identity |
| 2 | **Pricing structure** | Freemium (proposed), Free trial then paid, Completely free (grant-funded), Paid-only | Freemium with free tier | Revenue model foundation |
| 3 | **Deployment platform priority** | Vercel-first (proposed), Cloudflare Workers-first, Self-hosted VPS | Vercel (fastest path to production) | Infrastructure architecture |
| 4 | **Auth provider primary** | Supabase Auth (proposed), Auth0, Magic.link (passwordless email) | Supabase (already required for database, simpler stack) | Security posture, UX complexity |
| 5 | **Language scope** | French-only (current proposed), French+English bilingual | French-only initially; English add-on post-launch | Market reach vs. maintenance burden |
| 6 | **Goethe-Institut partnership strategy** | Pursue partnership early in roadmap, partner only after MVP proven | Partner only after MVP shows results | Time-to-market vs. credibility |
