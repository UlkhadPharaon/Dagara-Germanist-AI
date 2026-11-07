export interface ChartData {
  title: string;
  type: 'bar' | 'pie';
  data: { name: string; value: number }[];
  color?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface AnalysisResult {
  id: string;
  title: string;
  content: string;
  date: string;
  charts?: ChartData[];
}

export interface LiteratureReview {
  keywords: string[];
  theories: string[];
  authors: string[];
  summary: string;
}

export interface BibliographyEntry {
  id: string;
  citation: string; // APA format
}

export interface HistoryLog {
  id: string;
  projectId?: string;
  projectName?: string;
  action: 'create' | 'update' | 'delete' | 'export' | 'import';
  details: string;
  timestamp: number;
}

/** How a resource entered the project. */
export type ResourceKind = 'fichier' | 'note';

/**
 * A user-supplied document or note attached to a project.
 *
 * `content` is the extracted plain text: it is the only thing the AI layer ever
 * sees, so files are processed once on import and then stored as text.
 */
export interface ProjectResource {
  id: string;
  name: string;
  kind: ResourceKind;
  content: string;
  /** Bytes, for files only. */
  size?: number;
  mimeType?: string;
  createdAt: number;
  /** Unticked resources stay in the library but are not sent to the model. */
  enabled: boolean;
}

export interface ProjectData {
  id: string;
  name: string;
  lastModified: number;
  subject: string;
  cycle: string;
  context: string;
  literatureReview?: LiteratureReview;
  hypotheses: string[];
  questions: string[];
  objectives: {
    general: string;
    specific: string[];
  };
  tools: Record<string, string>;
  analyses: AnalysisResult[];
  bibliography?: BibliographyEntry[];
  language?: 'fr' | 'de';
  /** User-supplied documents and notes used as AI context. */
  resources?: ProjectResource[];
}

/**
 * Patch function handed down to every phase component. Phases never own the
 * project list — they only describe what changed (the persistence layer then
 * debounces, validates and writes through to the active storage backend).
 */
export type ProjectUpdater = (updates: Partial<ProjectData>) => void;

/** Props shared by all five phase components. */
export interface PhaseProps {
  project: ProjectData;
  setProject: ProjectUpdater;
}
