/**
 * User-supplied resources: documents and notes attached to a project.
 *
 * Two rules drive this module:
 *
 *  1. **The prompt must never explode.** Long inspection reports would blow the
 *     model's context window, so every resource is truncated to
 *     {@link MAX_CHARS_PER_RESOURCE} and the whole context to
 *     {@link MAX_TOTAL_CONTEXT_CHARS}, with an explicit marker where text was
 *     cut so the model knows the material is incomplete.
 *  2. **Nothing is silently dropped.** The counting helpers are shared with the
 *     UI, which shows exactly how much of each document is used.
 */

import type { ProjectResource } from '../types';

/** Per-document ceiling for the AI context (≈ 1 000 tokens). */
export const MAX_CHARS_PER_RESOURCE = 4000;

/** Total ceiling for the concatenated context (≈ 3 000 tokens). */
export const MAX_TOTAL_CONTEXT_CHARS = 12000;

/** Documents accepted by the import button. */
export const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif';

/** Free-tier ceiling on resources per project (mirrors the pricing page). */
export const FREE_TIER_MAX_RESOURCES = 3;

/** Builds an id for a new resource. */
export function createResourceId(): string {
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Human-readable size for the resource list. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** True when the file extension is one the app knows how to read. */
export function isSupportedFile(fileName: string): boolean {
  const extension = fileName.toLowerCase().split('.').pop() ?? '';
  return ['pdf', 'doc', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(
    extension
  );
}

/**
 * Cuts a document at a word boundary and reports how much was kept, so the
 * caller can tell the user the document was truncated.
 */
export function truncateResource(
  text: string,
  limit = MAX_CHARS_PER_RESOURCE
): {
  text: string;
  truncated: boolean;
  keptChars: number;
} {
  if (text.length <= limit) return { text, truncated: false, keptChars: text.length };

  const slice = text.slice(0, limit);
  const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
  const cut = lastBreak > limit * 0.6 ? slice.slice(0, lastBreak) : slice;

  return { text: `${cut}\n[…]`, truncated: true, keptChars: cut.length };
}

/**
 * Assembles the "documents de référence" block injected into the prompts.
 * Returns an empty string when nothing usable is enabled.
 */
export function buildResourceContext(resources: ProjectResource[] | undefined): string {
  if (!resources || resources.length === 0) return '';

  const enabled = resources.filter(
    resource => resource.enabled && resource.content.trim().length > 0
  );
  if (enabled.length === 0) return '';

  let used = 0;
  const blocks: string[] = [];

  for (const resource of enabled) {
    if (used >= MAX_TOTAL_CONTEXT_CHARS) break;

    const remaining = MAX_TOTAL_CONTEXT_CHARS - used;
    const limit = Math.min(MAX_CHARS_PER_RESOURCE, remaining);
    const { text, truncated } = truncateResource(resource.content, limit);
    if (text.trim().length === 0) continue;

    used += text.length;
    blocks.push(
      `### Document : ${resource.name}\n${text}${
        truncated ? '\n(document tronqué — seule une partie est transmise)' : ''
      }`
    );
  }

  if (blocks.length === 0) return '';

  return `
DOCUMENTS DE RÉFÉRENCE FOURNIS PAR L'UTILISATEUR :
Appuie-toi en priorité sur ces documents. Ne les inventes pas, ne les contredit pas sans le signaler, et cite-les quand tu t'en sers.
${blocks.join('\n\n')}`;
}

/** Number of characters actually sent to the model for a project. */
export function resourceContextSize(resources: ProjectResource[] | undefined): number {
  return buildResourceContext(resources).length;
}

/** Normalises a resource read from storage (imports, cloud rows). */
export function normalizeResource(value: unknown): ProjectResource | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' && record.id.length > 0 ? record.id : null;
  if (!id) return null;

  return {
    id,
    name: typeof record.name === 'string' && record.name ? record.name : 'Document',
    kind: record.kind === 'note' ? 'note' : 'fichier',
    content: typeof record.content === 'string' ? record.content : '',
    ...(typeof record.size === 'number' && record.size > 0 ? { size: record.size } : {}),
    ...(typeof record.mimeType === 'string' ? { mimeType: record.mimeType } : {}),
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
    enabled: record.enabled !== false,
  };
}

/** Normalises the whole list, dropping unusable entries. */
export function normalizeResources(value: unknown): ProjectResource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeResource)
    .filter((resource): resource is ProjectResource => resource !== null);
}
