import { describe, expect, it } from 'vitest';
import {
  buildResourceContext,
  createResourceId,
  formatFileSize,
  FREE_TIER_MAX_RESOURCES,
  isSupportedFile,
  MAX_CHARS_PER_RESOURCE,
  MAX_TOTAL_CONTEXT_CHARS,
  normalizeResource,
  normalizeResources,
  resourceContextSize,
  truncateResource,
} from '../resources';
import type { ProjectResource } from '../../types';

const resource = (overrides: Partial<ProjectResource> = {}): ProjectResource => ({
  id: 'r1',
  name: 'Rapport inspection.pdf',
  kind: 'fichier',
  content: 'Contenu du rapport.',
  createdAt: 1_700_000_000_000,
  enabled: true,
  ...overrides,
});

describe('isSupportedFile', () => {
  it('accepts the formats the extractor handles', () => {
    for (const name of ['a.pdf', 'a.docx', 'a.doc', 'a.txt', 'a.md', 'a.png', 'a.JPG']) {
      expect(isSupportedFile(name)).toBe(true);
    }
  });

  it('rejects unknown formats', () => {
    for (const name of ['a.exe', 'a.zip', 'a', 'a.mp4']) {
      expect(isSupportedFile(name)).toBe(false);
    }
  });
});

describe('formatFileSize', () => {
  it('scales the unit', () => {
    expect(formatFileSize(512)).toBe('512 o');
    expect(formatFileSize(2048)).toBe('2 Ko');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 Mo');
  });
});

describe('truncateResource', () => {
  it('leaves short text untouched', () => {
    const result = truncateResource('court texte', 100);
    expect(result).toEqual({ text: 'court texte', truncated: false, keptChars: 11 });
  });

  it('cuts on a word boundary and marks the truncation', () => {
    const text = `${'mot '.repeat(2000)}fin`; // ~8 000 chars
    const result = truncateResource(text, MAX_CHARS_PER_RESOURCE);

    expect(result.truncated).toBe(true);
    expect(result.keptChars).toBeLessThanOrEqual(MAX_CHARS_PER_RESOURCE);
    expect(result.text.endsWith('\n[…]')).toBe(true);
  });

  it('falls back to a hard cut when there is no nearby boundary', () => {
    const result = truncateResource('x'.repeat(9000), 100);
    expect(result.truncated).toBe(true);
    expect(result.keptChars).toBe(100);
  });
});

describe('buildResourceContext', () => {
  it('returns an empty string without resources', () => {
    expect(buildResourceContext(undefined)).toBe('');
    expect(buildResourceContext([])).toBe('');
  });

  it('ignores disabled and blank resources', () => {
    const resources = [resource({ enabled: false }), resource({ id: 'r2', content: '   ' })];
    expect(buildResourceContext(resources)).toBe('');
  });

  it('embeds the document name and content', () => {
    const context = buildResourceContext([resource()]);
    expect(context).toContain('Rapport inspection.pdf');
    expect(context).toContain('Contenu du rapport.');
    expect(context).toContain("DOCUMENTS DE RÉFÉRENCE FOURNIS PAR L'UTILISATEUR");
  });

  it('honours the per-document ceiling and flags the truncation', () => {
    const context = buildResourceContext([
      resource({ content: 'a'.repeat(MAX_CHARS_PER_RESOURCE * 3) }),
    ]);
    expect(context).toContain('document tronqué');
    expect(context).toContain('[…]');
  });

  it('honours the total ceiling across documents', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      resource({
        id: `r${index}`,
        name: `doc-${index}.pdf`,
        content: 'b'.repeat(MAX_CHARS_PER_RESOURCE),
      })
    );

    const context = buildResourceContext(many);
    expect(context.length).toBeLessThanOrEqual(MAX_TOTAL_CONTEXT_CHARS + 400);
    // Later documents are dropped once the budget is spent.
    expect(context).not.toContain('doc-9.pdf');
  });

  it('reports the exact size sent to the model', () => {
    const resources = [resource()];
    expect(resourceContextSize(resources)).toBe(buildResourceContext(resources).length);
    expect(resourceContextSize(undefined)).toBe(0);
  });
});

describe('normalizeResource / normalizeResources', () => {
  it('round-trips a valid resource', () => {
    expect(normalizeResource(resource())).toEqual(resource());
  });

  it('defaults missing fields', () => {
    expect(normalizeResource({ id: 'x' })).toMatchObject({
      id: 'x',
      name: 'Document',
      kind: 'fichier',
      content: '',
      enabled: true,
    });
  });

  it('rejects entries without an id', () => {
    expect(normalizeResource({ name: 'sans id' })).toBeNull();
    expect(normalizeResource(null)).toBeNull();
    expect(normalizeResource('texte')).toBeNull();
  });

  it('filters unusable entries from a list', () => {
    const list = normalizeResources([resource(), { name: 'cassé' }, null, resource({ id: 'r2' })]);
    expect(list.map(item => item.id)).toEqual(['r1', 'r2']);
    expect(normalizeResources('nope')).toEqual([]);
  });
});

describe('limits', () => {
  it('keeps the free-tier ceiling in sync with the pricing page', () => {
    expect(FREE_TIER_MAX_RESOURCES).toBe(3);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createResourceId()));
    expect(ids.size).toBe(50);
  });
});
