import { describe, expect, it } from 'vitest';
import { createNewProject, normalizeProject, parseHistoryLogs, parseProjects } from '../projects';
import { DEFAULT_CYCLE, HISTORY_LIMIT } from '../constants';
import { first, withoutKey } from '../../test/helpers';

/** A minimal valid stored project, as written by a previous version. */
const baseProject = () => ({
  id: '1700000000000',
  name: 'Mon mémoire',
  lastModified: 1700000000000,
  subject: "Le numérique en classe d'allemand",
  cycle: '1er cycle (6ème-3ème)',
  context: 'Ouagadougou',
  hypotheses: ['H1', 'H2'],
  questions: ['Q1'],
  objectives: { general: 'Objectif', specific: ['S1', 'S2'] },
  tools: { enseignants: '# Questionnaire', eleves: 42 },
  analyses: [
    {
      id: 'a1',
      title: 'Analyse',
      content: 'contenu',
      date: '2026-01-01T00:00:00.000Z',
      charts: [
        {
          title: 'Graphique',
          type: 'pie',
          data: [{ name: 'A', value: 3 }, { name: 'B', value: 'not-a-number' }, { junk: true }],
          color: '#ff0000',
        },
        { title: 'Sans données', type: 'bar', data: [] },
      ],
    },
  ],
  literatureReview: {
    keywords: ['motivation'],
    theories: ['APC'],
    authors: ['X'],
    summary: 'Bref.',
  },
  bibliography: [
    { id: 'r1', citation: 'A. Auteur (2020). Titre.' },
    { id: 'r2', citation: '' },
  ],
  language: 'de',
});

describe('createNewProject', () => {
  it('fills every field the UI relies on', () => {
    const project = createNewProject();
    expect(project).toMatchObject({
      name: 'Nouveau Projet',
      cycle: DEFAULT_CYCLE,
      subject: '',
      hypotheses: [],
      questions: [],
      objectives: { general: '', specific: [] },
      tools: {},
      analyses: [],
    });
    expect(typeof project.id).toBe('string');
    expect(project.id.length).toBeGreaterThan(0);
  });
});

describe('normalizeProject', () => {
  it('keeps a valid project intact', () => {
    const project = normalizeProject(baseProject());
    expect(project).not.toBeNull();
    expect(project?.name).toBe('Mon mémoire');
    expect(project?.language).toBe('de');
    expect(project?.hypotheses).toEqual(['H1', 'H2']);
    expect(project?.tools).toEqual({ enseignants: '# Questionnaire' });
  });

  it('drops non-string tool content instead of rendering objects', () => {
    const project = normalizeProject(baseProject());
    expect(project?.tools).not.toHaveProperty('eleves');
  });

  it('keeps only charts with at least one usable data point', () => {
    const project = normalizeProject(baseProject());
    expect(first(project?.analyses).charts).toHaveLength(1);
    const chart = first(first(project?.analyses).charts);
    expect(chart?.type).toBe('pie');
    expect(chart?.data).toEqual([{ name: 'A', value: 3 }]);
  });

  it('falls back to an id when an analysis has none', () => {
    const payload = baseProject();
    first(payload.analyses).id = '';
    const project = normalizeProject(payload);
    expect(first(project?.analyses).id).toBe('1700000000000-analysis-0');
  });

  it('drops blank bibliography entries and defaults the annotated id', () => {
    const project = normalizeProject(baseProject());
    expect(project?.bibliography).toEqual([{ id: 'r1', citation: 'A. Auteur (2020). Titre.' }]);
  });

  it('applies defaults for missing fields', () => {
    const project = normalizeProject({ id: 'x' });
    expect(project).toMatchObject({
      id: 'x',
      name: 'Nouveau Projet',
      cycle: DEFAULT_CYCLE,
      hypotheses: [],
      objectives: { general: '', specific: [] },
    });
  });

  it('rejects payloads without an id', () => {
    expect(normalizeProject({ name: 'sans id' })).toBeNull();
    expect(normalizeProject(null)).toBeNull();
    expect(normalizeProject('string')).toBeNull();
    expect(normalizeProject([])).toBeNull();
  });

  it('omits optional sections that are absent', () => {
    const payload = baseProject();
    const trimmed = withoutKey(withoutKey(payload, 'literatureReview'), 'bibliography');
    const project = normalizeProject(trimmed);
    expect(project).not.toHaveProperty('literatureReview');
    expect(project).not.toHaveProperty('bibliography');
  });
});

describe('parseProjects', () => {
  it('normalises every entry and skips the broken ones', () => {
    const payload = [baseProject(), { name: 'cassé' }, null];
    const projects = parseProjects(payload);
    expect(projects).toHaveLength(1);
    expect(first(projects ?? [])?.id).toBe('1700000000000');
  });

  it('returns null when nothing is usable', () => {
    expect(parseProjects([{ name: 'x' }, null])).toBeNull();
    expect(parseProjects([])).toBeNull();
    expect(parseProjects({})).toBeNull();
    expect(parseProjects(null)).toBeNull();
  });
});

describe('parseHistoryLogs', () => {
  it('parses logs and drops the unusable ones', () => {
    const logs = parseHistoryLogs([
      { id: '1', action: 'create', details: 'ok', timestamp: 1 },
      { id: '2', action: 'update' },
      { action: 'delete' },
      'nope',
    ]);
    expect(logs).toHaveLength(2);
    expect(logs?.[1]).toMatchObject({ id: '2', action: 'update', details: '' });
  });

  it('caps the log list at the retention limit', () => {
    const many = Array.from({ length: 90 }, (_, index) => ({
      id: String(index),
      action: 'update',
      details: 'x',
      timestamp: index,
    }));
    expect(parseHistoryLogs(many)).toHaveLength(HISTORY_LIMIT);
  });

  it('returns null when no entry is usable', () => {
    expect(parseHistoryLogs([{ nope: true }])).toBeNull();
    expect(parseHistoryLogs('nope')).toBeNull();
  });
});
