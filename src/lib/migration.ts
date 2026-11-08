/**
 * One-time migration of locally stored projects into the cloud.
 *
 * Runs on the first successful sign-in. Local records are never deleted —
 * they stay as the offline fallback and the recovery path if the cloud write
 * fails.
 */

import type { ProjectData } from '../types';
import { createCloudRepository } from './pocketbase';
import { readJson, storageKeys, writeJson } from './storage';
import { parseProjects } from './projects';

export interface MigrationReport {
  localCount: number;
  uploaded: number;
  failures: string[];
}

/**
 * Ids already present in the cloud, or `null` when the cloud could not be
 * read (in which case the caller must abort to avoid duplicating work).
 */
async function loadRemoteProjectIds(
  repository: ReturnType<typeof createCloudRepository>
): Promise<Set<string> | null> {
  if (!repository) return new Set<string>();

  try {
    const remote = await repository.loadProjects();
    return new Set(remote.map(project => project.id));
  } catch (error) {
    console.error('Lecture des projets cloud impossible avant migration :', error);
    return null;
  }
}

/** Projects currently held in localStorage (already normalised). */
export function readLocalProjects(): ProjectData[] {
  const raw = readJson<unknown>(storageKeys.projects);
  return parseProjects(raw) ?? [];
}

/**
 * Pushes every local project to the cloud, skipping ids that already exist
 * remotely. Returns a report instead of throwing so the caller can inform the
 * user without blocking the session.
 */
export async function migrateLocalProjectsToCloud(userId: string): Promise<MigrationReport> {
  const local = readLocalProjects();
  const report: MigrationReport = { localCount: local.length, uploaded: 0, failures: [] };

  const repository = createCloudRepository(userId);
  if (!repository || local.length === 0) return report;

  const remote = await loadRemoteProjectIds(repository);
  if (remote === null) {
    report.failures.push('cloud-unreachable');
    return report;
  }

  const existingIds = remote;
  for (const project of local) {
    if (existingIds.has(project.id)) continue;
    try {
      await repository.saveProject(project);
      report.uploaded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Migration du projet ${project.id} échouée :`, error);
      report.failures.push(`${project.name || project.id}: ${message}`);
    }
  }

  if (report.uploaded > 0) {
    // Marker so the migration is not repeated on every sign-in.
    writeJson(`${storageKeys.projects}:migrated-to`, { userId, at: Date.now() });
  }

  return report;
}

/** True when the local projects have already been pushed for this user. */
export function hasMigratedFor(userId: string): boolean {
  const marker = readJson<{ userId?: string }>(`${storageKeys.projects}:migrated-to`);
  return marker?.userId === userId;
}
