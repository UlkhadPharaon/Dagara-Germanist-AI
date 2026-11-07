import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectData } from '../types';
import { createCloudRepository, saveProjectVersion, type ProjectRepository } from '../lib/supabase';
import { readLocalProjects, migrateLocalProjectsToCloud } from '../lib/migration';
import { readJson, storageKeys } from '../lib/storage';
import { createNewProject } from '../lib/projects';
import { showToast } from '../lib/toast';

export type StorageMode = 'local' | 'cloud' | 'loading';

interface UseProjectSyncOptions {
  userId: string | null;
  cloudEnabled: boolean;
}

export interface ProjectSyncResult {
  mode: StorageMode;
  /** True when local projects were pushed to the cloud during this session. */
  migrated: boolean;
  /** Removes a project from the cloud backend (no-op in local mode). */
  deleteRemote: (projectId: string) => Promise<void>;
}

const CLOUD_SAVE_DEBOUNCE_MS = 800;

/**
 * Keeps the project list in sync with the active backend.
 *
 * - No user / no credentials → localStorage (previous behaviour, unchanged).
 * - Signed in → Supabase, with a debounced write per change and a version
 *   snapshot on each save.
 *
 * The hook never throws: a failed write surfaces as a toast so the user knows
 * their work may not be persisted.
 */
export function useProjectSync(
  projects: ProjectData[],
  setProjects: React.Dispatch<React.SetStateAction<ProjectData[]>>,
  { userId, cloudEnabled }: UseProjectSyncOptions
): ProjectSyncResult {
  const [mode, setMode] = useState<StorageMode>('loading');
  const [migrated, setMigrated] = useState(false);
  const repositoryRef = useRef<ProjectRepository | null>(null);
  const pendingRef = useRef<Map<string, ProjectData>>(new Map());
  const flushTimerRef = useRef<number | null>(null);
  const initialLoadDone = useRef(false);

  // --- initial load ---------------------------------------------------------
  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      if (!cloudEnabled || !userId) {
        const local = readLocalProjects();
        if (!active) return;
        setProjects(local.length > 0 ? local : [createNewProject()]);
        repositoryRef.current = null;
        setMode('local');
        initialLoadDone.current = true;
        return;
      }

      setMode('loading');
      const repository = createCloudRepository(userId);
      if (!repository) {
        const local = readLocalProjects();
        if (!active) return;
        setProjects(local.length > 0 ? local : [createNewProject()]);
        setMode('local');
        initialLoadDone.current = true;
        return;
      }

      try {
        const hasLocalData = readLocalProjects().length > 0;
        if (hasLocalData && !hasMigrationMarker(userId)) {
          const report = await migrateLocalProjectsToCloud(userId);
          if (!active) return;
          if (report.uploaded > 0) {
            setMigrated(true);
            showToast(
              `${report.uploaded} projet(s) local(aux) synchronisé(s) avec votre compte.`,
              'success'
            );
          }
          if (report.failures.length > 0) {
            showToast(
              "Certains projets locaux n'ont pas pu être synchronisés. Ils restent disponibles hors ligne.",
              'error'
            );
          }
        }

        const remote = await repository.loadProjects();
        if (!active) return;
        setProjects(remote.length > 0 ? remote : [createNewProject()]);
        repositoryRef.current = repository;
        setMode('cloud');
      } catch (error) {
        console.error('Chargement cloud impossible, bascule sur le stockage local :', error);
        if (!active) return;
        const local = readLocalProjects();
        setProjects(local.length > 0 ? local : [createNewProject()]);
        repositoryRef.current = null;
        setMode('local');
        showToast('Connexion au cloud indisponible — vos projets locaux sont affichés.', 'info');
      } finally {
        initialLoadDone.current = true;
      }
    }

    void load();

    return () => {
      active = false;
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [userId, cloudEnabled, setProjects]);

  // --- persistence ----------------------------------------------------------
  useEffect(() => {
    if (mode !== 'cloud' || !initialLoadDone.current) return;

    const repository = repositoryRef.current;
    if (!repository) return;

    for (const project of projects) pendingRef.current.set(project.id, project);

    if (flushTimerRef.current !== null) window.clearTimeout(flushTimerRef.current);
    flushTimerRef.current = window.setTimeout(() => {
      const queue = [...pendingRef.current.values()];
      pendingRef.current.clear();

      void (async () => {
        for (const project of queue) {
          try {
            await repository.saveProject(project);
          } catch (error) {
            console.error('Enregistrement cloud échoué :', error);
            showToast(
              'Enregistrement cloud échoué — nouvelle tentative à la prochaine modification.',
              'error'
            );
          }
        }
        if (userId && queue.length > 0) {
          const lastProject = queue[queue.length - 1];
          if (lastProject) await saveProjectVersion(lastProject, userId);
        }
      })();
    }, CLOUD_SAVE_DEBOUNCE_MS);

    return () => {
      if (flushTimerRef.current !== null) window.clearTimeout(flushTimerRef.current);
    };
  }, [projects, mode, userId]);

  // --- deletions ------------------------------------------------------------
  const deleteRemote = useCallback(
    async (projectId: string) => {
      const repository = repositoryRef.current;
      if (mode !== 'cloud' || !repository) return;
      try {
        await repository.deleteProject(projectId);
      } catch (error) {
        console.error('Suppression cloud échouée :', error);
        showToast('Suppression cloud échouée — le projet réapparaîtra au rechargement.', 'error');
      }
    },
    [mode]
  );

  return { mode, migrated, deleteRemote };
}

function hasMigrationMarker(userId: string): boolean {
  return readJson<{ userId?: string }>(`${storageKeys.projects}:migrated-to`)?.userId === userId;
}
