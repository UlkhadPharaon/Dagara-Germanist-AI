# 04 — UX, UI & Landing Page Strategy

## Design Direction

### Current State Analysis

The app uses an **emerald-600** primary color palette with a clean card-based layout on a slate-50 background. Components follow consistent visual patterns: rounded-xl cards, shadow-sm borders, motion/react animations for transitions. The design is modern but lacks systematic documentation.

### Proposed System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#059669` (emerald-600) | CTAs, active states, brand identity |
| Secondary | `#6366f1` (indigo-500) | Chatbot, secondary actions |
| Accent | `#7c3aed` (purple-600) | Phase 3 analysis section |
| Warning | `#d97706` (amber-500) | Warnings, info states |
| Error | `#dc2626` (red-600) | Errors, destructive actions |
| Success | `#059669` (emerald-600) | Success confirmations |
| Neutral bg | `#f8fafc` (slate-50) | Page backgrounds |
| Card bg | `#ffffff` | Content surfaces |
| Text primary | `#0f172a` (slate-900) | Headings, important text |
| Text secondary | `#475569` (slate-600) | Body text, labels |
| Border | `#e2e8f0` (slate-200) | Dividers, input borders |
| Font family | System sans-serif stack → upgrade to Inter + source serif for academic content |

### Typography Upgrade

```css
/* Current: system fonts */
/* Propose: */
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-serif: 'Source Serif 4', Georgia, serif; /* For academic text rendering */
--font-mono: 'JetBrains Mono', monospace; /* For code/data display */
```

Page sizes: H1 2rem/semibold, H2 1.5rem/medium, body 1rem/regular, small 0.875rem/medium, label 0.75rem/semibold uppercase tracking-wider.

### Component Library (Proposed Additions)

| Component | Purpose | Notes |
|-----------|---------|-------|
| `BrandLogo` | App logo + wordmark in sidebar header, favicon, PWA manifest | Replace icon-only approach |
| `ProjectCard` | Sidebar project list item (exists inline; extract to component) | Reuse across sidebar and potential dashboard |
| `GenerationProgress` | Multi-step progress indicator during LLM calls | Better than single spinner |
| `ConfirmationDialog` | Confirm dialog for destructive actions (exists inline; extract) | Consistent across app |
| `EmptyState` | Empty state placeholder with illustration + explanation | Used across phases |
| `ErrorBoundary` | React error boundary wrapping each phase | Prevents total app crash |
| `ApiKeyInput` | Modal for entering/managing API key | Currently hidden in .env |
| `UserProfile` | User avatar + name + plan tier in header | Placeholder until auth exists |
| `SearchBar` | Project search/filter input | Currently missing |
| `Toast` | Notification system (exists inline; extract to shared) | Consistent across components |

## Page Architecture

### New Pages Required

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Marketing landing page | ❌ Missing |
| `/app` | Main application (current behavior) | ✅ Exists as single-page root |
| `/dashboard` | Post-login overview of all projects with stats | ❌ Missing |
| `/project/:id` | Deep link to specific project | ❌ Missing (URL not tracked) |
| `/onboarding` | Guided account creation + first-project walkthrough | ❌ Missing |
| `/pricing` | Pricing comparison table + CTA | ❌ Missing |
| `/help` | Documentation, FAQ, video tutorials | ❌ Missing |

### User Journeys

#### Journey 1: First-Time Visitor (Landing Page)
```
Landing page → Read value prop → Click "Try Free" → Enter email → 
Account created → Auto-login → Dashboard shown → 
Quick tour of sample demo project → "Create my first project" → 
Phase 0 with pre-filled example topic → Experience AI generation within 60 seconds
```

#### Journey 2: Returning User (App Direct)
```
Direct URL access → Auth check → If logged in: dashboard view → 
Select existing project → Jump to last-used phase → Continue work → 
Save automatically (real-time sync) → Export when ready
```

#### Journey 3: Institutional Admin
```
Admin receives invitation link → Creates org account → Adds team members → 
Assigns seats → Sets usage limits → Monitors team activity via admin dashboard → 
Generates monthly reports on team productivity
```

## Landing Page Structure (Detailed)

The landing page must convert visitors into trial users within 30 seconds of page load.

### Section-by-Section Copy

#### 1. Hero Section
```
Headline: "Structurez votre recherche en didactique de l'allemand avec l'intelligence artificielle"
Subheadline: "De la revue de littérature à la bibliographie — un assistant IA conçu spécifiquement pour les chercheurs et inspecteurs pédagogiques au Burkina Faso."
Primary CTA: "Commencer gratuitement" → /onboarding
Secondary CTA: "Voir une démo" → scrolls to interactive demo
Visual: Screen mockup of Phase 3 showing AI-generated analysis with charts
```

#### 2. Problem Statement
```
Heading: "La recherche en didactique est longue. Elle ne devrait pas être impossible."
Content: 3 pain points with icons:
- "Revue de littérature: heures passées sur Google Scholar" → "Obtenez des concepts clés, théories et auteurs pertinents en 30 secondes."
- "Conception de questionnaires: structuration complexe" → "Générez des outils valides basés sur vos hypothèses de recherche."
- "Analyse des données: compétences statistiques requises" → "Importez vos résultats — l'IA produit analyses et graphiques automatiquement."
```

#### 3. Interactive Demo
```
A live, read-only mini-app that lets visitors:
1. Type any German didactics topic
2. See generated hypotheses in real-time (simulated, not actual API call)
3. Understand the workflow without needing to register
```

#### 4. Core Benefits (Three Column Grid)
```
Column 1: ⏱️ Gagnez du temps
"Il faut généralement 3 semaines pour concevoir un questionnaire valide. Avec Dagara, obtenez une version brute en 5 minutes, puis affinez-la avec l'IA."

Column 2: 📚 Expertise intégrée
"L'IA connaît l'APC, la pédagogie différenciée, les manuels Ihr und Wir et Wege, le contexte scolaire burkinabè — et applique ces connaissances à chaque génération."

Column 3: 📊 Analyse intelligente
"Importez PDF, DOCX ou images. L'IA identifie les tendances, extraits les données quantitatives, et produit des graphiques prêts à intégrer dans votre mémoire."
```

#### 5. How It Works (Four Steps)
```
Step 1: Définissez votre sujet — Choisissez un thème de recherche et le cycle concerné.
Step 2: Générez votre cadre — L'IA propose hypothèses, questions et objectifs.
Step 3: Concevez vos outils — Questionnaires, grilles d'analyse, guides d'entretien.
Step 4: Analysez et exportez — Upload des données → analyse IA → rapport Word/PDF complet.
```

#### 6. Target Use Cases
```
- Mémoire de master en didactique de l'allemand
- Rapport d'inspection pédagogique
- Recherche-action en classe de langue
- Évaluation de manuel scolaire
- Thèse doctorale en sciences de l'éducation
```

#### 7. Pricing Section
```
Three-column pricing cards (Free, Pro, Institutionnel). 
Highlight recommended plan. Include toggle Monthly/Annual with annual discount.
CTA on each card.
```

#### 8. Trust Signals
```
"Pensé pour les inspecteurs pédagogiques du Burkina Faso"
"Sécurisé — vos données restent confidentielles"
Compatible avec les exigences méthodologiques des universités ouest-africaines
```

#### 9. FAQ
```
Q: "Est-ce que l'IA remplace le travail de recherche ?"
A: "Non. Dagara accélère les tâches répétitives (formulation, formatage, analyse initiale) mais vous gardez le contrôle décisionnel sur tout contenu généré. Les suggestions doivent être vérifiées et adaptées avant publication."

Q: "Mes données sont-elles sécurisées ?"
A: "En version gratuite, vos projets sont stockés localement sur votre appareil. En version cloud, les données sont chiffrées et hébergées conformément aux normes de protection des données."

Q: "Fonctionne-t-il sans internet ?"
A: "L'application peut charger une interface de base hors ligne. La génération IA nécessite une connexion active."

Q: "Peut-on collaborer à plusieurs sur un projet ?"
A: "Oui, en version institutionnelle : partage de projets, commentaires, révision par pairs."
```

#### 10. Final CTA
```
Heading: "Prêt à accélérer votre recherche ?"
Subtext: "Rejoignez les chercheurs qui utilisent Dagara pour structurer leur travail académique."
Primary CTA: "Créer mon compte gratuit"
Secondary CTA: "Contacter l'équipe pour un essai institutionnel"
```

#### 11. Footer
```
Links: À propos · Confidentialité · Conditions · Support · GitHub
Social: Twitter/X, LinkedIn (when accounts exist)
Copyright © 2026 Dagara Germanist AI
```

## Conversion Strategy

### Primary Conversion Action
**Create an account and generate first hypothesis set.** This is the activation event — it demonstrates immediate value and creates data lock-in.

### Activation Events Defined
| Event | Threshold | Significance |
|-------|-----------|--------------|
| A1: Account created | Email verified | Entry point |
| A2: First project created | Subject entered | Commitment |
| A3: First AI generation | Hypotheses received | Value demonstration |
| A4: Full five-phase completion | Project exported | Retention trigger |
| A5: Second project started | >1 project | Habit formation |
| A6: Upgrade prompt | 5 free generations used | Monetization |

### Onboarding Flow

```
1. Landing page → "Commencer gratuitement"
2. Signup: email + password (Google/Apple OAuth optional)
3. Welcome screen: brief intro with option to skip or take guided tour
4. Pre-populated demo project appears (not empty) — shows realistic research topic
5. Tour highlights: click-to-follow tooltips on main features
6. Prompt: "Créer votre premier projet réel" → redirect to Phase 0 with fresh project
```

## Accessibility Requirements

Per WCAG 2.1 AA (target compliance):

- [ ] All interactive elements have focus indicators (`outline` visible on focus)
- [ ] Color contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- [ ] All non-text content has text alternatives (ARIA labels)
- [ ] Keyboard navigation fully functional (Tab order matches visual flow)
- [ ] Form inputs have associated `<label>` elements (currently many are just `placeholder`)
- [ ] Error messages programmatically associated with form fields
- [ ] Live regions announce dynamic updates (toast notifications, generation progress)
- [ ] No auto-playing media without user control
- [ ] Screen reader tested at every phase

## Responsive Requirements

- Mobile-first: all layouts work at 320px width (iPhone SE / low-end Android)
- Touch targets minimum 44×44px
- Sidebar collapses to overlay below 1024px (lg breakpoint) — currently works
- Charts resize fluidly on smaller screens
- File upload area usable with touch (no hover-dependent interactions)
- Print stylesheet: hide all controls, show only content, landscape orientation where appropriate
