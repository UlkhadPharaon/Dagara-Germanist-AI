/**
 * PocketBase client + repository.
 *
 * Cloud mode is opt-in through environment variables. When they are absent (or
 * no user is signed in) every function degrades to the local storage backend,
 * so the app keeps working exactly as before instead of crashing on a missing
 * configuration.
 *
 * Required variables:
 *   VITE_POCKETBASE_URL — instance URL (e.g. https://dagara.185-7-81-99.sslip.io)
 *
 * The instance schema (created by the provisioning script):
 *   users            — auth collection (email/password), PB default
 *   projects         — owner-scoped project rows (owner = users relation)
 *   project_versions — owner-scoped version snapshots
 *   generations      — owner-scoped AI generation log
 */

import PocketBase, { type ClientResponseError } from 'pocketbase';
import type {
  BibliographyEntry,
  ChartData,
  HistoryLog,
  ProjectData,
  ProjectResource,
} from '../types';
import { HISTORY_LIMIT } from './constants';

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL;

/** True when the build carries a usable PocketBase URL. */
export function isPocketBaseConfigured(): boolean {
  return typeof POCKETBASE_URL === 'string' && POCKETBASE_URL.length > 0;
}

let client: PocketBase | null = null;

/** Lazily created singleton — never throws when unconfigured. */
export function getPocketBase(): PocketBase | null {
  if (!isPocketBaseConfigured()) return null;
  if (!client) {
    client = new PocketBase(POCKETBASE_URL);
    // Collapse duplicate in-flight requests (React Strict Mode double-effects).
    client.autoCancellation(true);
  }
  return client;
}

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

/** Error thrown by the PocketBase SDK on a non-2xx response. */
function isClientError(error: unknown): error is ClientResponseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  );
}

function statusOf(error: unknown): number | undefined {
  return isClientError(error) ? error.status : undefined;
}

/** 404 = the record does not exist yet (upsert path inserts instead). */
function isNotFound(error: unknown): boolean {
  return statusOf(error) === 404;
}

// ---------------------------------------------------------------------------
// Row ↔ model mapping
// ---------------------------------------------------------------------------

interface ProjectRow {
  id: string;
  /** Relation to the `users` collection (replaces Supabase's user_id column). */
  owner: string;
  name: string;
  last_modified: string;
  subject: string;
  cycle: string;
  context: string;
  language: 'fr' | 'de';
  literature_review: unknown;
  hypotheses: string[];
  questions: string[];
  objectives_json: unknown;
  tools_json: unknown;
  analyses_json: unknown;
  bibliography_json: unknown;
  resources_json: unknown;
  created?: string;
  updated?: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const asChart = (value: unknown): ChartData | null => {
  const record = asRecord(value);
  if (typeof record.title !== 'string') return null;

  const data = Array.isArray(record.data) ? record.data : [];
  const points = data
    .filter(entry => typeof entry === 'object' && entry !== null)
    .map(entry => asRecord(entry))
    .map(entry => ({ name: entry.name, value: entry.value }))
    // Never invent a number: a non-numeric value is dropped, not coerced to 0.
    .filter(
      (point): point is { name: string; value: number } =>
        typeof point.name === 'string' &&
        point.name.length > 0 &&
        typeof point.value === 'number' &&
        Number.isFinite(point.value)
    );

  return {
    title: record.title,
    type: record.type === 'pie' ? 'pie' : 'bar',
    data: points,
    ...(typeof record.color === 'string' ? { color: record.color } : {}),
    ...(typeof record.xAxisLabel === 'string' ? { xAxisLabel: record.xAxisLabel } : {}),
    ...(typeof record.yAxisLabel === 'string' ? { yAxisLabel: record.yAxisLabel } : {}),
  };
};

/** A chart without a single labelled point renders nothing — drop it. */
function hasData(value: ChartData | null): value is ChartData {
  return value !== null && value.data.length > 0;
}

const asAnalyses = (value: unknown): ProjectData['analyses'] =>
  (Array.isArray(value) ? value : [])
    .map((entry, index) => {
      const record = asRecord(entry);
      const id = typeof record.id === 'string' && record.id ? record.id : `analysis-${index}`;
      return {
        id,
        title: typeof record.title === 'string' ? record.title : 'Analyse',
        content: typeof record.content === 'string' ? record.content : '',
        date: typeof record.date === 'string' ? record.date : new Date().toISOString(),
        ...(Array.isArray(record.charts)
          ? {
              charts: record.charts.map(asChart).filter(hasData),
            }
          : {}),
      };
    })
    .filter(analysis => analysis.content.length > 0 || analysis.charts?.length);

const asBibliography = (value: unknown): BibliographyEntry[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const entries = value
    .map((entry, index) => {
      const record = asRecord(entry);
      const id = typeof record.id === 'string' && record.id ? record.id : `ref-${index + 1}`;
      const citation = typeof record.citation === 'string' ? record.citation : '';
      return { id, citation };
    })
    .filter(entry => entry.citation.trim().length > 0);
  return entries.length > 0 ? entries : undefined;
};

export function rowToProject(row: ProjectRow): ProjectData {
  const literature = asRecord(row.literature_review);
  const objectives = asRecord(row.objectives_json);

  return {
    id: row.id,
    name: row.name,
    lastModified: new Date(row.last_modified ?? row.updated).getTime(),
    subject: row.subject,
    cycle: row.cycle,
    context: row.context,
    ...(Object.keys(literature).length > 0
      ? {
          literatureReview: {
            keywords: asStringArray(literature.keywords),
            theories: asStringArray(theoriesOf(literature)),
            authors: asStringArray(literature.authors),
            summary: typeof literature.summary === 'string' ? literature.summary : '',
          },
        }
      : {}),
    hypotheses: asStringArray(row.hypotheses),
    questions: asStringArray(row.questions),
    objectives: {
      general: typeof objectives.general === 'string' ? objectives.general : '',
      specific: asStringArray(objectives.specific),
    },
    tools: Object.fromEntries(
      Object.entries(asRecord(row.tools_json)).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    ),
    analyses: asAnalyses(row.analyses_json),
    ...(asBibliography(row.bibliography_json)
      ? { bibliography: asBibliography(row.bibliography_json) }
      : {}),
    ...(asResources(row.resources_json).length > 0
      ? { resources: asResources(row.resources_json) }
      : {}),
    language: row.language === 'de' ? 'de' : 'fr',
  };
}

/** Normalises the resource list stored in `projects.resources_json`. */
function asResources(value: unknown): ProjectResource[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(entry => typeof entry === 'object' && entry !== null)
    .map((entry, index) => {
      const record = entry as Record<string, unknown>;
      return {
        id: typeof record.id === 'string' && record.id ? record.id : `res-${index}`,
        name: typeof record.name === 'string' && record.name ? record.name : 'Document',
        kind: record.kind === 'note' ? ('note' as const) : ('fichier' as const),
        content: typeof record.content === 'string' ? record.content : '',
        ...(typeof record.size === 'number' && record.size > 0 ? { size: record.size } : {}),
        ...(typeof record.mimeType === 'string' ? { mimeType: record.mimeType } : {}),
        createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
        enabled: record.enabled !== false,
      };
    })
    .filter(resource => resource.content.trim().length > 0);
}

function theoriesOf(literature: Record<string, unknown>): unknown {
  return literature.theories;
}

export function projectToRow(project: ProjectData, userId: string): Record<string, unknown> {
  return {
    id: project.id,
    // PocketBase relation column (replaces Supabase's user_id)
    owner: userId,
    name: project.name,
    last_modified: new Date(project.lastModified).toISOString(),
    subject: project.subject,
    cycle: project.cycle,
    context: project.context,
    language: project.language ?? 'fr',
    literature_review: project.literatureReview ?? null,
    hypotheses: project.hypotheses,
    questions: project.questions,
    objectives_json: project.objectives,
    tools_json: project.tools,
    analyses_json: project.analyses,
    bibliography_json: project.bibliography ?? null,
    resources_json: project.resources ?? [],
  };
}

// ---------------------------------------------------------------------------
// Repository operations (cloud)
// ---------------------------------------------------------------------------

export interface ProjectRepository {
  loadProjects(): Promise<ProjectData[]>;
  saveProject(project: ProjectData): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
}

/** Creates the cloud repository for a signed-in user. */
export function createCloudRepository(userId: string): ProjectRepository | null {
  const pocketbase = getPocketBase();
  if (!pocketbase) return null;

  return {
    async loadProjects(): Promise<ProjectData[]> {
      try {
        const records = await pocketbase.collection('projects').getFullList({
          sort: '-last_modified',
        });
        return records.map(record => rowToProject(record as unknown as ProjectRow));
      } catch (error) {
        throw new Error(`Chargement des projets impossible : ${messageOf(error)}`, { cause: error });
      }
    },

    async saveProject(project: ProjectData): Promise<void> {
      const row = projectToRow(project, userId);
      try {
        // PocketBase has no native upsert: update, and insert when the record
        // does not exist yet (404).
        await pocketbase.collection('projects').update(project.id, row);
      } catch (error) {
        if (!isNotFound(error)) {
          throw new Error(`Enregistrement du projet impossible : ${messageOf(error)}`, {
            cause: error,
          });
        }
        try {
          await pocketbase.collection('projects').create(row);
        } catch (createError) {
          throw new Error(`Enregistrement du projet impossible : ${messageOf(createError)}`, {
            cause: createError,
          });
        }
      }
    },

    async deleteProject(projectId: string): Promise<void> {
      try {
        await pocketbase.collection('projects').delete(projectId);
      } catch (error) {
        throw new Error(`Suppression du projet impossible : ${messageOf(error)}`, { cause: error });
      }
    },
  };
}

/** Writes a full snapshot so any previous version can be restored. */
export async function saveProjectVersion(project: ProjectData, userId: string): Promise<void> {
  const pocketbase = getPocketBase();
  if (!pocketbase) return;

  try {
    const page = await pocketbase.collection('project_versions').getList(1, 1, {
      filter: `project_id = "${project.id}"`,
    });

    await pocketbase.collection('project_versions').create({
      project_id: project.id,
      owner: userId,
      snapshot: project,
      version_number: page.totalItems + 1,
    });
  } catch (error) {
    console.error('Enregistrement de la version impossible :', messageOf(error));
  }
}

/** Records one AI generation for usage tracking / future quotas. */
export async function logGeneration(entry: {
  userId: string;
  projectId?: string;
  phase: 'phase0' | 'phase1' | 'phase2' | 'phase3' | 'phase4';
  toolType?: string;
  modelUsed?: string;
  tokensEstimated?: number;
  status: 'success' | 'failed' | 'cancelled';
  errorMessage?: string;
}): Promise<void> {
  const pocketbase = getPocketBase();
  if (!pocketbase) return;

  try {
    await pocketbase.collection('generations').create({
      owner: entry.userId,
      project_id: entry.projectId ?? '',
      phase: entry.phase,
      tool_type: entry.toolType ?? '',
      model_used: entry.modelUsed ?? '',
      tokens_estimated: entry.tokensEstimated ?? 0,
      status: entry.status,
      error_message: entry.errorMessage ?? '',
    });
  } catch (error) {
    console.error('Journalisation de génération impossible :', messageOf(error));
  }
}

/** Most recent action logs. Diagnostic history stays device-local for now. */
export function historyLogsLocalOnly(): HistoryLog[] {
  return [];
}

export const historyLimit = HISTORY_LIMIT;

/** Human-readable message for any thrown value (PB errors carry a message). */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isClientError(error)) return error.message;
  return String(error);
}
