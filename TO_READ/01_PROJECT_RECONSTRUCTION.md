# 01 — Project Reconstruction

## What the Application Actually Does

**Dagara Germanist AI for Inspector** is an AI-powered research assistant designed for French-speaking educational inspectors, researchers, and graduate students in Burkina Faso who conduct academic research on teaching German as a foreign language (Fremdsprachendidaktik / didactique de l'allemand).

The application guides users through a complete academic research workflow across five sequential phases, leveraging large language models hosted on NVIDIA's cloud inference platform to generate structured academic content at each stage.

### Primary User Journey

```
User starts → Creates project → Phase 0 (Literature Review) 
         → Phase 1 (Research Framework: hypotheses, questions, objectives)
         → Phase 2 (Data Collection Tools: questionnaires, grids)
         → Phase 3 (Data Analysis: upload files → AI analyzes → charts)
         → Phase 4 (Bibliography + Full Project Export to .doc)
         → Save/share locally via .json import/export
```

### Who Uses It

- **Primary:** French-speaking pedagogical inspectors in Burkina Faso writing reports or theses about German language instruction.
- **Secondary:** University students (LMD licence/mastère/master) researching German didactics.
- **Tertiary:** German teachers in Burkina Faso conducting classroom action research.

## Technology Stack (Verified)

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | React | ^19.0.0 |
| Compiler | Vite | ^6.2.0 |
| Styling | Tailwind CSS v4 + @tailwindcss/typography | ^4.1.14 |
| Animations | motion/react (Framer Motion) | ^12.23.24 |
| Charts | Recharts | ^2.15.0 |
| Markdown Rendering | react-markdown + remark-gfm | ^10.1.0 |
| PDF Generation | jsPDF + html-to-image | ^4.2.0 / ^1.11.13 |
| DOCX Reading | mammoth | ^1.11.0 (client-side) |
| UI Icons | lucide-react | ^0.475.0 |
| Type Checking | TypeScript | ~5.8.2 |

### Mobile Wrapper
| Layer | Technology | Version |
|-------|-----------|---------|
| Bridge | Capacitor | ^8.2.0 (Android only) |
| Build | gradlew (Android) | Inherited |

### Backend (Development Proxy)
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Express | ^4.21.2 |
| HTTP Parser | express.json({ limit: '50mb' }) | Built-in |
| Env | dotenv | ^17.2.3 |
| Purpose | NVIDIA NIM proxy endpoint only | Single route |

### AI Backend
| Layer | Technology | Provider |
|-------|-----------|----------|
| SDK | OpenAI JavaScript SDK | ^6.29.0 (for OpenAI-compatible APIs) |
| API | NVIDIA Integration API | https://integrate.api.nvidia.com/v1 |
| Models Available | meta/llama-3.1-8b-instruct, meta/llama-3.1-70b-instruct, mistralai/mistral-large-2-instruct, nvidia/llama-3.1-nemotron-70b-instruct | NVIDIA Cloud GPU |

## Routes / Navigation Structure

The application uses tab-based navigation (not URL routing):

| Tab ID | Label | Component | Purpose |
|--------|-------|-----------|---------|
| `phase0` | Revue de Littérature | `Phase0.tsx` | Keyword → literature concepts, theories, authors, problem statement |
| `phase1` | Cadrage | `Phase1.tsx` | Subject, cycle, context → hypotheses/questions/objectives |
| `phase2` | Outils | `Phase2.tsx` | Generate 4 types of data collection tools |
| `phase3` | Analyse | `Phase3.tsx` | Upload files → AI analysis → charts (bar/pie) |
| `phase4` | Export | `Phase4.tsx` | Bibliography APA + full project Word export |
| `history` | Historique | `HistoryTab.tsx` | Last 50 action logs (create/update/delete/import/export) |

## Data Models (src/types.ts)

```typescript
interface ProjectData {
  id: string;                    // Date.now().toString()
  name: string;
  lastModified: number;
  subject: string;               // Research topic
  cycle: string;                 // Education level
  context: string;               // Geographic/institutional context
  literatureReview?: LiteratureReview;
  hypotheses: string[];          // Array of hypothesis strings
  questions: string[];           // Array of research questions
  objectives: {                  // General + specific objectives
    general: string;
    specific: string[];
  };
  tools: Record<string, string>; // toolId → markdown content
  analyses: AnalysisResult[];    // Generated analyses
  bibliography?: BibliographyEntry[];
  language?: 'fr' | 'de';        // Output language for tools
}

interface LiteratureReview {
  keywords: string[];
  theories: string[];
  authors: string[];
  summary: string;
}

interface AnalysisResult {
  id: string;
  title: string;
  content: string;               // Markdown analysis text
  date: string;
  charts?: ChartData[];          // Recharts-compatible chart data
}

interface HistoryLog {
  id: string;
  projectId?: string;
  projectName?: string;
  action: 'create' | 'update' | 'delete' | 'export' | 'import';
  details: string;
  timestamp: number;
}
```

## Services and Functions (src/lib/api.ts)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `generateText()` | contents, systemInstruction | string | Generic text generation via LLM |
| `generateJSON()` | contents, schema, systemInstruction | object | Structured JSON output with parsing fallbacks |
| `chatWithAI()` | message, history[], systemInstruction | string | Chat with conversation history |
| `generateCadrage()` | subject, cycle, context | {hypotheses, questions, objectives} | Phase 1 framework |
| `generateTool()` | project, toolType, manualName, style, instructions | markdown string | Phase 2 tool generation |
| `improveTool()` | project, toolType, currentContent, instructions | markdown string | Refine existing tool |
| `refineArchitecturePart()` | project, part, instructions | array/object | Rewrite hypotheses/questions/objectives |
| `analyzeData()` | project, files[], analysisType, instructions, chartRequests, referenceTool | {content, charts} | Phase 3 analysis |
| `generateLiteratureReview()` | keywords, context | {keywords, theories, authors, summary} | Phase 0 review |
| `generateBibliography()` | project | BibliographyEntry[] | Phase 4 APA references |
| `extractTextFromFile()` | File | string | Client-side DOCX/PDF text extraction |
| `chatWithAssistant()` | project, message, history[] | string | Contextual chatbot responses |

## Existing Functionality Status

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-project management | ✅ Implemented | Create, switch, delete, sort, import/export |
| Phase 0 literature review | ✅ Working | Generates keywords, theories, authors, summary |
| Phase 1 framework gen | ✅ Working | Hypotheses, questions, objectives generation |
| Phase 1 refinement | ✅ Working | Rewrite individual sections via AI |
| Phase 2 tool generation | ✅ Working | 4 tool types with style selection |
| Phase 2 tool editing | ✅ Manual edit mode | Textarea-based editor |
| Phase 2 AI improvement | ✅ Working | Prompt-driven refinement |
| Phase 2 file import | ✅ Working | DOCX/PDF image upload → OCR via LLM |
| Phase 3 file upload | ✅ Working | Multiple file types |
| Phase 3 AI analysis | ✅ Working | Content + charts generation |
| Phase 3 chart rendering | ✅ Working | Bar + Pie charts via Recharts |
| Phase 3 chart editing | ✅ Partial | Edit labels, data points, colors |
| Phase 3 PDF export | ⚠️ Risky | Uses html-to-image to capture entire analysis including Recharts — may fail with complex DOM |
| Phase 4 bibliography | ✅ Working | APA format generation |
| Phase 4 full export | ✅ Working | Compiles all phases to .doc |
| Chatbot | ✅ Working | Context-aware conversations |
| Toast notifications | ✅ Working | Error/success/info messages |
| Action history | ✅ Working | Last 50 logs, view-only tab |
| Language selector (FR/DE) | ✅ Working | Controls German/French output for tools |
| Print stylesheet | ✅ Basic | `print:hidden` classes on interactive elements |
| Android APK build | ✅ Script exists | `npm run build:apk` |
| Responsive design | ✅ Good | Mobile sidebar overlay, grid layouts adapt |
| Search projects | ❌ Missing | Sort exists but no search/filter |
| User accounts | ❌ Missing | None |
| Cloud sync | ❌ Missing | localStorage only |
| Authentication | ❌ Missing | None |
| Payment/billing | ❌ Missing | None |
| Landing page | ❌ Missing | App IS the page |
| Analytics | ❌ Missing | None |
| Tests | ❌ Missing | None |
| CI/CD | ❌ Missing | None |

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript config (skipLibCheck, ES2022, bundler module resolution) |
| `vite.config.ts` | Tailwind plugin, React plugin, define GEMINI_API_KEY alias, base ./ relative paths |
| `capacitor.config.ts` | com.dagaragermanist.app, webDir: dist |
| `.env.example` | VITE_NVIDIA_API_KEY, NVIDIA_API_KEY |
| `.gitignore` | node_modules, build, dist, .env*, .DS_Store |
| `index.html` | Fetch polyfill workaround, root mount point |
| `server.ts` | Express proxy, single route /api/nvidia/chat/completions |
| `README-APK.md` | Android build instructions |

## Environment Variables

| Variable | Required | Used By | Notes |
|----------|----------|---------|-------|
| `VITE_NVIDIA_API_KEY` | Yes | server.ts, api.ts (injected by server) | NVIDIA GPU Cloud API key, starts with `nvapi-` |
| `NVIDIA_API_KEY` | Alternative | server.ts fallback | Same key, different variable name |

## Build Commands

```bash
npm run dev       # Development: tsx server.ts
npm run build     # Production: vite build → dist/
npm run lint      # TypeScript type check: tsc --noEmit
npm run preview   # Preview production build locally
npm run clean     # Remove dist/
npm run build:apk # Full pipeline: vite build → cap sync android → gradlew assembleDebug
```

## Assumptions Made

1. NVIDIA API key is configured outside the codebase (`.env` or environment).
2. The app runs at `localhost:3000` during development.
3. No CDN assets are used; all styling is self-hosted via Tailwind.
4. The app targets primarily Android mobile due to Capacitor config.
