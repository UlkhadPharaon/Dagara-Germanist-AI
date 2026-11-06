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
}
