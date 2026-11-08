import { describe, expect, it } from 'vitest';
import { isPocketBaseConfigured, projectToRow, rowToProject } from '../pocketbase';
import { createNewProject } from '../projects';
import { first } from '../../test/helpers';
import type { ProjectData } from '../../types';

/**
 * The row ↔ model mapping is the contract that makes cloud and local storage
 * interchangeable. It is tested without a network client.
 */

const USER_ID = '11111111-2222-3333-4444-555555555555';

const sampleProject = (): ProjectData => ({
  ...createNewProject(),
  id: '1700000000000',
  name: 'Mémoire',
  lastModified: 1_700_000_000_000,
  subject: 'Sujet',
  cycle: 'Second cycle (2nde-Tle)',
  context: 'Contexte',
  language: 'de',
  hypotheses: ['H1', 'H2'],
  questions: ['Q1'],
  objectives: { general: 'G', specific: ['S1'] },
  tools: { enseignants: 'contenu' },
  analyses: [
    {
      id: 'a1',
      title: 'Analyse',
      content: 'texte',
      date: '2026-01-01T00:00:00.000Z',
      charts: [
        { title: 'G', type: 'bar', data: [{ name: 'A', value: 2 }], color: '#10b981' },
        { title: 'Vide', type: 'pie', data: [] },
      ],
    },
  ],
  literatureReview: { keywords: ['k'], theories: ['t'], authors: ['a'], summary: 'résumé' },
  bibliography: [{ id: 'r1', citation: 'A. Auteur (2020). Titre.' }],
});

describe('isPocketBaseConfigured', () => {
  it('is false in the test environment (no credentials)', () => {
    expect(isPocketBaseConfigured()).toBe(false);
  });
});

describe('projectToRow / rowToProject', () => {
  it('round-trips a fully populated project', () => {
    const row = projectToRow(sampleProject(), USER_ID);
    const restored = rowToProject({
      ...row,
      last_modified: new Date(sampleProject().lastModified).toISOString(),
      updated: new Date(sampleProject().lastModified).toISOString(),
      created: new Date(sampleProject().lastModified).toISOString(),
    } as Parameters<typeof rowToProject>[0]);

    expect(restored.id).toBe('1700000000000');
    expect(restored.name).toBe('Mémoire');
    expect(restored.subject).toBe('Sujet');
    expect(restored.cycle).toBe('Second cycle (2nde-Tle)');
    expect(restored.language).toBe('de');
    expect(restored.hypotheses).toEqual(['H1', 'H2']);
    expect(restored.objectives).toEqual({ general: 'G', specific: ['S1'] });
    expect(restored.tools).toEqual({ enseignants: 'contenu' });
    expect(restored.literatureReview).toEqual({
      keywords: ['k'],
      theories: ['t'],
      authors: ['a'],
      summary: 'résumé',
    });
    expect(restored.bibliography).toEqual([{ id: 'r1', citation: 'A. Auteur (2020). Titre.' }]);
    expect(restored.lastModified).toBe(1_700_000_000_000);
  });

  it('writes the owner into the row', () => {
    const row = projectToRow(sampleProject(), USER_ID);
    expect(row.owner).toBe(USER_ID);
    expect(row.id).toBe('1700000000000');
    expect(row.language).toBe('de');
  });

  it('drops charts without data points on the way back from the cloud', () => {
    const row = projectToRow(sampleProject(), USER_ID);
    const restored = rowToProject({
      ...row,
      last_modified: new Date(0).toISOString(),
      updated: new Date(0).toISOString(),
      created: new Date(0).toISOString(),
    } as Parameters<typeof rowToProject>[0]);

    expect(first(restored.analyses).charts).toHaveLength(1);
    expect(first(first(restored.analyses).charts)).toEqual({
      title: 'G',
      type: 'bar',
      data: [{ name: 'A', value: 2 }],
      color: '#10b981',
    });
  });

  it('omits optional sections that are null in the database', () => {
    const row = projectToRow(createNewProject(), USER_ID);
    const restored = rowToProject({
      ...row,
      literature_review: null,
      bibliography_json: null,
      last_modified: new Date(0).toISOString(),
      updated: new Date(0).toISOString(),
      created: new Date(0).toISOString(),
    } as Parameters<typeof rowToProject>[0]);

    expect(restored).not.toHaveProperty('literatureReview');
    expect(restored).not.toHaveProperty('bibliography');
    expect(restored.analyses).toEqual([]);
    expect(restored.tools).toEqual({});
  });

  it('never fabricates a chart value from a non-numeric entry', () => {
    const row = projectToRow(sampleProject(), USER_ID);
    const restored = rowToProject({
      ...row,
      analyses_json: [
        {
          id: 'a1',
          title: 'Analyse',
          content: 'texte',
          date: '2026-01-01T00:00:00.000Z',
          charts: [
            {
              title: 'G',
              type: 'bar',
              data: [
                { name: 'A', value: 'inconnu' },
                { name: 'B', value: 4 },
              ],
            },
          ],
        },
      ],
      last_modified: new Date(0).toISOString(),
      updated: new Date(0).toISOString(),
      created: new Date(0).toISOString(),
    } as Parameters<typeof rowToProject>[0]);

    expect(first(first(restored.analyses).charts).data).toEqual([{ name: 'B', value: 4 }]);
  });
});
