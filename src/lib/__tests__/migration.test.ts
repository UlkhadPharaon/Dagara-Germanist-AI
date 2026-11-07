import { beforeEach, describe, expect, it, vi } from 'vitest';

// The migration must be testable without a real Supabase project, so the client
// factory is mocked.
const saveProject = vi.fn(() => Promise.resolve(undefined));
const deleteProject = vi.fn(() => Promise.resolve(undefined));
const loadProjects = vi.fn(() => Promise.resolve([]) as Promise<unknown[]>);

vi.mock('../supabase', () => ({
  createCloudRepository: () => ({ loadProjects, saveProject, deleteProject }),
  saveProjectVersion: vi.fn(() => Promise.resolve(undefined)),
  logGeneration: vi.fn(() => Promise.resolve(undefined)),
  isSupabaseConfigured: () => true,
  getSupabase: () => null,
  historyLogsLocalOnly: () => [],
  historyLimit: 50,
  projectToRow: (project: unknown) => project,
  rowToProject: (row: unknown) => row,
}));

const { hasMigratedFor, migrateLocalProjectsToCloud, readLocalProjects } =
  await import('../migration');
const { writeJson, storageKeys } = await import('../storage');
const { createNewProject } = await import('../projects');

const USER_ID = '11111111-2222-3333-4444-555555555555';

const localProject = (id: string) => ({ ...createNewProject(), id, name: `Projet ${id}` });

describe('readLocalProjects', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns an empty list when nothing is stored', () => {
    expect(readLocalProjects()).toEqual([]);
  });

  it('ignores corrupted storage entries', () => {
    window.localStorage.setItem(storageKeys.projects, '{corrompu');
    expect(readLocalProjects()).toEqual([]);
  });

  it('reads stored projects', () => {
    writeJson(storageKeys.projects, [localProject('1'), localProject('2')]);
    expect(readLocalProjects().map(project => project.id)).toEqual(['1', '2']);
  });
});

describe('migrateLocalProjectsToCloud', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('reports nothing to do when there are no local projects', async () => {
    const report = await migrateLocalProjectsToCloud(USER_ID);
    expect(report).toEqual({ localCount: 0, uploaded: 0, failures: [] });
    expect(saveProject).not.toHaveBeenCalled();
  });

  it('uploads every local project that is missing remotely', async () => {
    writeJson(storageKeys.projects, [localProject('1'), localProject('2')]);

    const report = await migrateLocalProjectsToCloud(USER_ID);

    expect(report.localCount).toBe(2);
    expect(report.uploaded).toBe(2);
    expect(saveProject).toHaveBeenCalledTimes(2);
    expect(report.failures).toEqual([]);
  });

  it('skips projects that already exist in the cloud', async () => {
    writeJson(storageKeys.projects, [localProject('1')]);
    loadProjects.mockResolvedValueOnce([{ id: '1' }]);

    const report = await migrateLocalProjectsToCloud(USER_ID);

    expect(report.uploaded).toBe(0);
    expect(saveProject).not.toHaveBeenCalled();
  });

  it('aborts instead of duplicating when the cloud cannot be read', async () => {
    writeJson(storageKeys.projects, [localProject('1')]);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loadProjects.mockRejectedValueOnce(new Error('offline'));

    const report = await migrateLocalProjectsToCloud(USER_ID);

    expect(report.uploaded).toBe(0);
    expect(report.failures).toEqual(['cloud-unreachable']);
    expect(saveProject).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('records a failing upload and keeps going', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    writeJson(storageKeys.projects, [localProject('1'), localProject('2')]);
    saveProject.mockRejectedValueOnce(new Error('refusé')).mockResolvedValueOnce(undefined);

    const report = await migrateLocalProjectsToCloud(USER_ID);

    expect(report.uploaded).toBe(1);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toContain('refusé');

    consoleError.mockRestore();
  });

  it('leaves a marker so the migration runs only once per user', async () => {
    writeJson(storageKeys.projects, [localProject('1')]);

    expect(hasMigratedFor(USER_ID)).toBe(false);
    await migrateLocalProjectsToCloud(USER_ID);
    expect(hasMigratedFor(USER_ID)).toBe(true);
    expect(hasMigratedFor('autre-utilisateur')).toBe(false);
  });
});
