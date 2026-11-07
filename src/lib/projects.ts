/**
 * Project model helpers: construction, validation and import parsing.
 *
 * localStorage (and later Supabase) can contain hand-edited or legacy entries,
 * so every payload read from storage goes through {@link parseProjects} — this
 * is what stops a corrupted import from blanking the workspace.
 */

import type { HistoryLog, ProjectData } from '../types';
import { DEFAULT_CYCLE, DEFAULT_PROJECT_NAME, HISTORY_LIMIT } from './constants';
import { normalizeResources } from './resources';

export function createNewProject(): ProjectData {
  const timestamp = Date.now();
  return {
    id: timestamp.toString(),
    name: DEFAULT_PROJECT_NAME,
    lastModified: timestamp,
    subject: '',
    cycle: DEFAULT_CYCLE,
    context: '',
    hypotheses: [],
    questions: [],
    objectives: { general: '', specific: [] },
    tools: {},
    analyses: [],
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

/** Normalises one project entry, filling in every field the UI relies on. */
export function normalizeProject(value: unknown): ProjectData | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string' && value.id.length > 0 ? value.id : null;
  if (!id) return null;

  const objectives = isRecord(value.objectives) ? value.objectives : {};

  return {
    id,
    name: typeof value.name === 'string' ? value.name : DEFAULT_PROJECT_NAME,
    lastModified: typeof value.lastModified === 'number' ? value.lastModified : Date.now(),
    subject: typeof value.subject === 'string' ? value.subject : '',
    cycle: typeof value.cycle === 'string' && value.cycle ? value.cycle : DEFAULT_CYCLE,
    context: typeof value.context === 'string' ? value.context : '',
    hypotheses: stringArray(value.hypotheses),
    questions: stringArray(value.questions),
    objectives: {
      general: typeof objectives.general === 'string' ? objectives.general : '',
      specific: stringArray(objectives.specific),
    },
    tools: isRecord(value.tools)
      ? Object.fromEntries(
          Object.entries(value.tools).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string'
          )
        )
      : {},
    analyses: Array.isArray(value.analyses)
      ? value.analyses.filter(isRecord).map((analysis, index) => ({
          id:
            typeof analysis.id === 'string' && analysis.id.length > 0
              ? analysis.id
              : `${id}-analysis-${index}`,
          title: typeof analysis.title === 'string' ? analysis.title : 'Analyse',
          content: typeof analysis.content === 'string' ? analysis.content : '',
          date: typeof analysis.date === 'string' ? analysis.date : new Date().toISOString(),
          ...(Array.isArray(analysis.charts)
            ? {
                charts: analysis.charts
                  .filter(isRecord)
                  .map(chart => ({
                    title: typeof chart.title === 'string' ? chart.title : 'Graphique',
                    type: chart.type === 'pie' ? ('pie' as const) : ('bar' as const),
                    data: Array.isArray(chart.data)
                      ? chart.data
                          .filter(isRecord)
                          .map(point => ({
                            name: typeof point.name === 'string' ? point.name : '',
                            value: point.value,
                          }))
                          // Never invent a number: a non-numeric value is dropped.
                          .filter(
                            (point): point is { name: string; value: number } =>
                              point.name.length > 0 &&
                              typeof point.value === 'number' &&
                              Number.isFinite(point.value)
                          )
                      : [],
                    ...(typeof chart.color === 'string' ? { color: chart.color } : {}),
                    ...(typeof chart.xAxisLabel === 'string'
                      ? { xAxisLabel: chart.xAxisLabel }
                      : {}),
                    ...(typeof chart.yAxisLabel === 'string'
                      ? { yAxisLabel: chart.yAxisLabel }
                      : {}),
                  }))
                  // A chart without a single labelled point renders nothing.
                  .filter(chart => chart.data.length > 0),
              }
            : {}),
        }))
      : [],
    ...(isRecord(value.literatureReview)
      ? {
          literatureReview: {
            keywords: stringArray(value.literatureReview.keywords),
            theories: stringArray(value.literatureReview.theories),
            authors: stringArray(value.literatureReview.authors),
            summary:
              typeof value.literatureReview.summary === 'string'
                ? value.literatureReview.summary
                : '',
          },
        }
      : {}),
    ...(Array.isArray(value.bibliography)
      ? {
          bibliography: value.bibliography
            .filter(isRecord)
            .map((entry, index) => ({
              id: typeof entry.id === 'string' && entry.id ? entry.id : `ref-${index + 1}`,
              citation: typeof entry.citation === 'string' ? entry.citation : '',
            }))
            .filter(entry => entry.citation.trim().length > 0),
        }
      : {}),
    ...(value.language === 'de' || value.language === 'fr' ? { language: value.language } : {}),
    ...(normalizeResources(value.resources).length > 0
      ? { resources: normalizeResources(value.resources) }
      : {}),
  };
}

/** Parses a projects payload (storage or imported .json). Empty array = invalid. */
export function parseProjects(value: unknown): ProjectData[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const projects = value
    .map(normalizeProject)
    .filter((project): project is ProjectData => project !== null);

  return projects.length > 0 ? projects : null;
}

export function parseHistoryLogs(value: unknown): HistoryLog[] | null {
  if (!Array.isArray(value)) return null;

  const logs = value
    .filter(isRecord)
    .filter(log => typeof log.id === 'string' && typeof log.action === 'string')
    .map(log => ({
      id: log.id as string,
      action: log.action as HistoryLog['action'],
      details: typeof log.details === 'string' ? log.details : '',
      timestamp: typeof log.timestamp === 'number' ? log.timestamp : Date.now(),
      ...(typeof log.projectId === 'string' ? { projectId: log.projectId } : {}),
      ...(typeof log.projectName === 'string' ? { projectName: log.projectName } : {}),
    }))
    .slice(0, HISTORY_LIMIT);

  return logs.length > 0 ? logs : null;
}
