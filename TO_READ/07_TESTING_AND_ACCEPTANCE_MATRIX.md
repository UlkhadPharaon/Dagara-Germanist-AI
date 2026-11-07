# 07 — Testing & Acceptance Matrix

## Test Categories Overview

| Category | Scope | Tool | Priority |
|----------|-------|------|----------|
| Unit Tests | api.ts functions, json parser, type guards | Vitest | 🔴 High |
| Integration Tests | Auth flow, Supabase CRUD, edge function proxy | Vitest + MSW | 🔴 High |
| Component Tests | Phase rendering, state updates, interactions | Vitest + @testing-library/react | 🟡 Medium |
| E2E Tests | Full user journeys across multiple pages | Playwright | 🟡 Medium |
| Accessibility | WCAG 2.1 AA compliance | axe-core | 🟡 Medium |
| Performance | Bundle size, Lighthouse scores, load time | Lighthouse | 🟢 Low |
| Security | CSP, header compliance, key exposure | curl audits, security middleware tests | 🟡 Medium |
| Production Smoke | Post-deployment verification | Manual + automated curl | 🔴 High |

---

## Functional Tests

### T-FUNC-01: User Registration
| Test | Steps | Expected Result | Pass/Fail |
|------|-------|-----------------|-----------|
| Register with valid email | Enter email + password ≥8 chars → click Sign Up | Account created, redirected to dashboard | [ ] |
| Register with duplicate email | Same email again → click Sign Up | Error: "Email already registered" | [ ] |
| Register with short password | Password < 8 chars → submit | Error: "Password must be at least 8 characters" | [ ] |
| Register with invalid email | Invalid format → submit | Error: "Invalid email format" | [ ] |

### T-FUNC-02: Project Creation
| Test | Steps | Expected Result | Pass/Fail |
|------|-------|-----------------|-----------|
| Create new project | Click "+" → new row appears in sidebar | New project with default name | [ ] |
| Rename project | Edit name field in header | Name persists on reload | [ ] |
| Switch between projects | Click different project in sidebar | Tab resets to Phase 0, project data loads | [ ] |
| Delete project | Click trash icon → confirm | Project removed; if last remaining, replaced with fresh empty project | [ ] |
| Export projects | Click "Exporter" → download .json file | File contains all projects in correct schema | [ ] |
| Import projects | Click "Importer" → select valid .json | Projects added to list; duplicates ignored | [ ] |
| Import malformed JSON | Select non-JSON file | Error toast: "Format de fichier invalide" | [ ] |

### T-FUNC-03: Phase 0 — Literature Review
| Test | Steps | Expected Result | Pass/Fail |
|------|-------|-----------------|-----------|
| Generate without keywords | Click "Explorer" with empty input | Error toast: "Veuillez entrer au moins un mot-clé" | [ ] |
| Generate with keywords | Enter keywords → click button | Keywords, theories, authors, summary rendered | [ ] |
| Navigate to Phase 1 after generation | Click "Passer au Cadrage" | Active tab switches to phase1 | [ ] |

### T-FUNC-04: Phase 1 — Research Framework
| Test | Steps | Expected Result | Pass/Fail |
|------|-------|-----------------|-----------|
| Fill fields, generate | Subject + cycle → click "Générer" | Hypotheses, questions, objectives rendered | [ ] |
| Edit hypotheses | Modify textarea content → blur | Changes saved to project state | [ ] |
| Refine hypotheses with AI | Enter refinement instruction → submit | Revised hypotheses returned | [ ] |
| Export to Word | Click download icon | .doc file downloaded with framework content | [ ] |
| Print view | Click print icon / Ctrl+P | Clean print layout (controls hidden) | [ ] |

### T-FUNC-05: Phase 2 — Data Collection Tools
| Test | Steps | Expected Result | Pass/Fail |
|------|-------|-----------------|-----------|
| Generate teacher questionnaire | Select "Questionnaire Enseignants" → click generate | Markdown content rendered in preview pane | [ ] |
| Generate student questionnaire | Same for "Questionnaire Élèves" | Content generated with appropriate context | [ ] |
| Generate inspector questionnaire | Same for "Questionnaire Inspecteurs" | Content generated with appropriate context | [ ] |
| Generate textbook analysis grid | Enter manual name, select "Grille d'Analyse de Manuel" → generate | Content includes manual reference | [ ] |
| Change tool style | Expand settings → select "Approche projective" → regenerate | Content reflects chosen psychological approach | [ ] |
| Add custom instructions | Enter custom text → regenerate | Instructions incorporated into output | [ ] |
| Manual edit | Click edit → modify content → save | Edited content displayed and persisted | [ ] |
| Improve with AI | Enter improvement instruction → click "Améliorer" | Updated content rendered | [ ] |
| Import DOCX file | Upload .docx in edit mode → text extracted and shown | File content visible in textarea | [ ] |

### T-FUNC-06: Phase 3 — Data Analysis
| Test | Steps | Expected Result | Pass/Fail |
|------|-------|-----------------|-----------|
| Upload files | Drag/drop or click to upload | Files appear in upload list with remove buttons | [ ] |
| Analyze without files | Click "Lancer l'Analyse" with no files | Error toast: "Veuillez ajouter au moins un fichier" | [ ] |
| Analyze with files | Upload + select analysis type + click analyze | Analysis content + charts rendered | [ ] |
| Edit chart title | Hover chart → click edit pencil → change title → save | New title displayed | [ ] |
| Edit chart data points | Click edit → modify label/value pairs → save | Chart re-renders with updated data | [ ] |
| Change chart color | Select color swatch | Chart fills update to selected color | [ ] |
| Export PDF | Click download/PDF button | PDF file downloads (may render as image-based PDF) | [ ] |

### T-FUNC-07: Phase 4 — Export
| Test | Steps | Expected Result | Pass/Fail |
|------|-------|-----------------|-----------|
| Generate bibliography | Click "Générer la Bibliographie" | APA-formatted references rendered | [ ] |
| Export full project | Click "Exporter tout le projet" | .doc file with all phases compiled | [ ] |

### T-FUNC-08: Chatbot
| Test | Steps | Expected Result | Pass/Fail |
|------|-------|-----------------|-----------|
| Open chatbot | Click floating message button | Chat window opens, greeting message visible | [ ] |
| Send message | Type message → press Enter or send button | Response received within timeout | [ ] |
| Send contextual question about research | Mention hypothesis/question in message | Response references project context | [ ] |
| Close chatbot | Click X button | Window closes | [ ] |

---

## Regression Tests

| Test ID | Description | Regressed Feature | Pass/Fail |
|---------|-------------|-------------------|-----------|
| REG-01 | Five-phase workflow navigable in order | App.tsx TABS navigation | [ ] |
| REG-02 | Language selector affects Phase 2 output | api.ts language branch | [ ] |
| REG-03 | Save status indicator updates correctly | App.tsx saveStatus state | [ ] |
| REG-04 | Toast notifications dismiss automatically after 5s | toast.ts → App.tsx integration | [ ] |
| REG-05 | Confirm dialog blocks interaction until resolved | ConfirmDialog modal | [ ] |
| REG-06 | QuickOverview tour completes after 8 steps | QuickOverview component | [ ] |
| REG-07 | History tab shows last 50 actions chronologically | HistoryTab + addLog() | [ ] |
| REG-08 | Sidebar collapses on mobile with hamburger menu | CSS responsive breakpoints | [ ] |
| REG-09 | Animation transitions fire on tab switch | motion/react AnimatePresence | [ ] |
| REG-10 | Multiple projects coexist with independent states | ProjectData per-id scoping | [ ] |

---

## API Tests

| Test ID | Endpoint | Method | Payload | Expected Response | Pass/Fail |
|---------|----------|--------|---------|-------------------|-----------|
| API-01 | `/api/health` | GET | {} | `{status: "ok"}` | [ ] |
| API-02 | `/api/nvidia/chat/completions` | POST | Valid OpenAI body with NVIDIA key | OpenAI-format completions response | [ ] |
| API-03 | `/api/nvidia/chat/completions` | POST | Missing/invalid API key | `{error: "API key is missing..."}` with 500 status | [ ] |
| API-04 | `/api/nvidia/chat/completions` | POST | Model not available | Appropriate error from NVIDIA (4xx) forwarded to client | [ ] |
| API-05 | `generateText()` wrapper | Client | Valid system prompt + user content | String response, no exception | [ ] |
| API-06 | `generateJSON()` wrapper | Client | Valid schema + user content | Parsed object matching schema shape | [ ] |
| API-07 | `generateJSON()` wrapper | Client | Malformed JSON from LLM | Retry succeeds OR throws clear error | [ ] |
| API-08 | Rate limit handling | Client | Rapid successive requests | Exponential backoff retry, eventually succeeds or reports quota exceeded | [ ] |

---

## Responsive Tests

| Breakpoint | Viewport Width | Devices | Pass/Fail |
|------------|---------------|---------|-----------|
| Mobile | 320–374px | iPhone SE, small Android | [ ] |
| Small mobile | 375–428px | iPhone 12/13/14, Pixel 5 | [ ] |
| Medium mobile | 429–767px | Large phones, tablets portrait | [ ] |
| Tablet landscape | 768–1023px | iPad, tablets landscape | [ ] |
| Desktop | 1024–1439px | Laptop screens | [ ] |
| Desktop wide | 1440px+ | Desktop monitors | [ ] |

Checklist per breakpoint:
- [ ] Sidebar accessible (overlay on mobile, fixed on desktop)
- [ ] Tab labels readable (no truncation, proper wrapping)
- [ ] Form inputs usable (touch targets ≥44px)
- [ ] Content readable (font sizes ≥14px, line height ≥1.5)
- [ ] Charts render properly (no overflow, proportional sizing)
- [ ] Header fits without horizontal scroll
- [ ] No horizontal scrollbar at any viewport width

---

## Accessibility Requirements

Per WCAG 2.1 AA:

| Criterion | Test | Pass/Fail |
|-----------|------|-----------|
| 1.1.1 Non-text Content | All icons/images have alt text or ARIA labels | [ ] |
| 1.3.1 Info Relationships | Form labels properly associated with inputs | [ ] |
| 2.1.1 Keyboard | All interactive elements reachable via Tab | [ ] |
| 2.4.3 Focus Order | Logical tab order matches visual flow | [ ] |
| 2.4.7 Focus Visible | Focus indicators clearly visible (outline) | [ ] |
| 3.2.2 On Input | Forms don't change context unexpectedly | [ ] |
| 4.1.2 Name Role Value | Dynamic elements expose state to assistive tech | [ ] |
| Contrast Min | Text contrast ≥4.5:1, large text ≥3:1 | [ ] |
| 1.4.11 Non-text Contrast | UI component borders/foregrounds ≥3:1 | [ ] |

Tool: axe-core (automated) + manual keyboard/screen reader testing.

---

## Production Smoke Tests

Run immediately after deployment:

| # | Action | Expected Result | Pass/Fail |
|---|--------|-----------------|-----------|
| 1 | Load landing page URL | Hero section renders, CTA buttons clickable | [ ] |
| 2 | Click "Try Free" | Redirects to signup form | [ ] |
| 3 | Create account | Success redirect to app/dashboard | [ ] |
| 4 | Load Phase 0 | Literacy review interface renders | [ ] |
| 5 | Generate literature review | Response received, content displayed | [ ] |
| 6 | Navigate to Phase 1 | Tab switch animation plays, Phase 1 renders | [ ] |
| 7 | Generate framework | Response received, editable fields populated | [ ] |
| 8 | Generate a tool | Response received, markdown rendered | [ ] |
| 9 | Upload file for analysis | File accepted, processing indicator shown | [ ] |
| 10 | Analyze data | Analysis + charts displayed | [ ] |
| 11 | Generate bibliography | References listed | [ ] |
| 12 | Export project | .doc file downloads | [ ] |
| 13 | Check Sentry dashboard | Zero unexpected errors since deployment | [ ] |
| 14 | Check Lighthouse | Performance ≥70, Best Practices ≥90, SEO ≥90 | [ ] |
