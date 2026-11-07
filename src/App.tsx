import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

import Phase0 from './components/Phase0';
import Phase1 from './components/Phase1';
import Phase2 from './components/Phase2';
import Chatbot from './components/Chatbot';
import QuickOverview from './components/QuickOverview';
import HistoryTab from './components/HistoryTab';
import SplashScreen from './components/SplashScreen';
import Toast from './components/Toast';
import ConfirmDialog, { type ConfirmRequest } from './components/ConfirmDialog';
import AppHeader, { type SaveStatus } from './components/AppHeader';
import AppSidebar, { type SortOrder } from './components/AppSidebar';
import ProgressStepper from './components/ProgressStepper';
import PhaseBoundary from './components/PhaseBoundary';
import AuthModal from './components/AuthModal';
import ResourcesPanel from './components/ResourcesPanel';

// Phase 3 (Recharts + html-to-image + jsPDF) and Phase 4 are the heaviest
// screens; loading them on demand keeps the first paint small.
const Phase3 = lazy(() => import('./components/Phase3'));
const Phase4 = lazy(() => import('./components/Phase4'));

/** Shown while a lazily loaded phase chunk is being fetched. */
function PhaseLoading() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={32} className="animate-spin text-emerald-600" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-500">Chargement du module...</p>
    </div>
  );
}

import { createNewProject, parseHistoryLogs, parseProjects } from './lib/projects';
import { getSelectedModel, setSelectedModel } from './lib/api';
import { showToast, toastEventName, toastDurationMs, type ToastNotification } from './lib/toast';
import { readString, storageKeys, writeJson } from './lib/storage';
import { HISTORY_LIMIT, UI_TIMINGS } from './lib/constants';
import { TABS } from './lib/tabs';
import { useAuth } from './lib/auth-context';
import { useProjectSync } from './hooks/useProjectSync';
import type { HistoryLog, ProjectData, ProjectResource } from './types';

/** Parses a stored JSON string without ever throwing at the call site. */
function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    console.error('Données locales illisibles — réinitialisation de cette entrée.', error);
    return null;
  }
}

/** Reads persisted projects, migrating the legacy `fara-*` keys on the way. */
function loadInitialProjects(): ProjectData[] {
  const keys = storageKeys;
  let payload = readString(keys.projects);
  let parsed = payload ? safeParse(payload) : null;

  if (!parsed) {
    payload = readString(keys.legacyProjects);
    parsed = payload ? safeParse(payload) : null;
    if (parsed) writeJson(keys.projects, parsed);
  }

  return parseProjects(parsed) ?? [createNewProject()];
}

function loadInitialHistory(): HistoryLog[] {
  const keys = storageKeys;
  let payload = readString(keys.history);
  let parsed = payload ? safeParse(payload) : null;

  if (!parsed) {
    payload = readString(keys.legacyHistory);
    parsed = payload ? safeParse(payload) : null;
    if (parsed) writeJson(keys.history, parsed);
  }

  return parseHistoryLogs(parsed) ?? [];
}

export default function App() {
  const { user, cloudEnabled } = useAuth();

  const [projects, setProjects] = useState<ProjectData[]>(() => loadInitialProjects());
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>(() => loadInitialHistory());
  const { mode: storageMode, deleteRemote } = useProjectSync(projects, setProjects, {
    userId: user?.id ?? null,
    cloudEnabled,
  });
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => projects[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState('phase0');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOrder>('date-desc');
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [aiModel, setAiModel] = useState<string>(() => getSelectedModel());
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmRequest | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showResources, setShowResources] = useState(false);

  // --- Toast plumbing -------------------------------------------------------
  useEffect(() => {
    const handleToast = (event: Event) => {
      setToast((event as CustomEvent<ToastNotification>).detail);
    };
    window.addEventListener(toastEventName, handleToast);
    return () => window.removeEventListener(toastEventName, handleToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toastDurationMs);
    return () => clearTimeout(timer);
  }, [toast]);

  // --- Splash screen + first-run guided tour ---------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
      setShowOverview(true);
    }, UI_TIMINGS.splashDurationMs);
    return () => clearTimeout(timer);
  }, []);

  // --- Save indicator -------------------------------------------------------
  useEffect(() => {
    if (saveStatus !== 'saving') return;
    const timer = setTimeout(() => setSaveStatus('saved'), UI_TIMINGS.saveIndicatorMs);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  const dismissToast = useCallback(() => setToast(null), []);

  // --- Persistence ----------------------------------------------------------
  // Local backend is used only while no cloud session is active; in cloud mode
  // the repository in `useProjectSync` owns the writes.
  useEffect(() => {
    if (storageMode === 'cloud') return;
    writeJson(storageKeys.projects, projects);
  }, [projects, storageMode]);

  useEffect(() => {
    writeJson(storageKeys.history, historyLogs);
  }, [historyLogs]);

  const addLog = useCallback(
    (action: HistoryLog['action'], details: string, projectId?: string, projectName?: string) => {
      setHistoryLogs(previous =>
        [
          {
            id: `${Date.now()}-${previous.length}`,
            action,
            details,
            timestamp: Date.now(),
            ...(projectId ? { projectId } : {}),
            ...(projectName ? { projectName } : {}),
          },
          ...previous,
        ].slice(0, HISTORY_LIMIT)
      );
    },
    []
  );

  const project = useMemo(
    () => projects.find(item => item.id === currentProjectId) ?? projects[0],
    [projects, currentProjectId]
  );

  const setProject = useCallback(
    (updates: Partial<ProjectData>) => {
      setSaveStatus('saving');
      setProjects(previous =>
        previous.map(item =>
          item.id === currentProjectId ? { ...item, ...updates, lastModified: Date.now() } : item
        )
      );
    },
    [currentProjectId]
  );

  const handleModelChange = useCallback((model: string) => {
    setAiModel(model);
    setSelectedModel(model);
  }, []);

  const handleNewProject = useCallback(() => {
    const newProject = createNewProject();
    setProjects(previous => [newProject, ...previous]);
    setCurrentProjectId(newProject.id);
    setActiveTab('phase0');
    setIsSidebarOpen(false);
    addLog('create', 'Nouveau projet créé', newProject.id, newProject.name);
  }, [addLog]);

  const handleExportProjects = useCallback(() => {
    const payload = JSON.stringify(projects, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `dagara-germanist-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog('export', `Exportation de ${projects.length} projets`);
    showToast('Sauvegarde téléchargée.', 'success');
  }, [projects, addLog]);

  const handleImportProjects = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = loadEvent => {
        const content = loadEvent.target?.result;
        if (typeof content !== 'string') {
          showToast('Erreur lors de la lecture du fichier.', 'error');
          return;
        }

        const imported = parseProjects(safeParse(content)) ?? [];
        if (!imported.length) {
          showToast('Format de fichier invalide.', 'error');
          return;
        }

        setProjects(previous => {
          const existingIds = new Set(previous.map(item => item.id));
          const additions = imported.filter(item => !existingIds.has(item.id));

          if (additions.length === 0) {
            showToast("Les projets de ce fichier existent déjà dans l'application.", 'info');
            return previous;
          }

          showToast(`${additions.length} projet(s) importé(s) avec succès.`, 'success');
          addLog('import', `Importation de ${additions.length} projets depuis ${file.name}`);
          return [...additions, ...previous];
        });
      };
      reader.onerror = () => showToast('Erreur lors de la lecture du fichier.', 'error');
      reader.readAsText(file);
      event.target.value = '';
    },
    [addLog]
  );

  const requestDeleteProject = useCallback(
    (projectId: string) => {
      const target = projects.find(item => item.id === projectId);
      setConfirmDialog({
        message: 'Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.',
        confirmLabel: 'Supprimer',
        onConfirm: () => {
          setProjects(previous => {
            const remaining = previous.filter(item => item.id !== projectId);
            if (remaining.length === 0) {
              const fresh = createNewProject();
              setCurrentProjectId(fresh.id);
              return [fresh];
            }
            const [nextActive] = remaining;
            if (currentProjectId === projectId && nextActive) setCurrentProjectId(nextActive.id);
            return remaining;
          });
          void deleteRemote(projectId);
          addLog('delete', 'Projet supprimé', projectId, target?.name);
          setConfirmDialog(null);
          showToast('Projet supprimé.', 'info');
        },
      });
    },
    [projects, currentProjectId, addLog, deleteRemote]
  );

  const sortedProjects = useMemo(() => {
    const byName = (a: ProjectData, b: ProjectData) => {
      const nameA = (a.name || a.subject || 'Projet sans titre').toLowerCase();
      const nameB = (b.name || b.subject || 'Projet sans titre').toLowerCase();
      return nameA.localeCompare(nameB);
    };

    const list = [...projects];
    if (sortBy === 'date-desc') list.sort((a, b) => b.lastModified - a.lastModified);
    if (sortBy === 'date-asc') list.sort((a, b) => a.lastModified - b.lastModified);
    if (sortBy === 'name-asc') list.sort(byName);
    if (sortBy === 'name-desc') list.sort((a, b) => byName(b, a));
    return list;
  }, [projects, sortBy]);

  const activeTabLabel = TABS.find(tab => tab.id === activeTab)?.label ?? '';

  // Derived without touching `project` so this stays above the render guard
  // (hooks must not run conditionally).
  const resourceCount = project?.resources?.length ?? 0;

  /** Replaces the whole library — used by the resources panel. */
  const handleResourcesChange = useCallback(
    (next: ProjectResource[]) => {
      setProject({ resources: next });
    },
    [setProject]
  );

  if (isAppLoading || !project) {
    return <SplashScreen />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <AppSidebar
        tabs={TABS}
        activeTab={activeTab}
        projects={sortedProjects}
        currentProjectId={project.id}
        sortBy={sortBy}
        isOpen={isSidebarOpen}
        storageMode={storageMode}
        accountEmail={user?.email ?? null}
        onSelectTab={tabId => {
          setActiveTab(tabId);
          setIsSidebarOpen(false);
        }}
        onSelectProject={projectId => {
          setCurrentProjectId(projectId);
          setIsSidebarOpen(false);
        }}
        onNewProject={handleNewProject}
        onDeleteProject={requestDeleteProject}
        onSortChange={setSortBy}
        onClose={() => setIsSidebarOpen(false)}
        onExport={handleExportProjects}
        onImport={handleImportProjects}
        onOpenAccount={() => setShowAuth(true)}
        onOpenResources={() => setShowResources(true)}
        resourceCount={resourceCount}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
        <AppHeader
          activeTabLabel={activeTabLabel}
          projectName={project.name}
          language={project.language ?? 'fr'}
          aiModel={aiModel}
          saveStatus={saveStatus}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onModelChange={handleModelChange}
          onLanguageChange={language => setProject({ language })}
          onProjectNameChange={name => setProject({ name })}
        />

        {activeTab !== 'history' && (
          <ProgressStepper tabs={TABS} activeTab={activeTab} onSelectTab={setActiveTab} />
        )}

        <div className="relative flex-1 overflow-x-hidden overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="min-h-full"
            >
              <PhaseBoundary name="Phase 0 : Revue de littérature">
                {activeTab === 'phase0' && (
                  <Phase0
                    project={project}
                    setProject={setProject}
                    onNext={() => setActiveTab('phase1')}
                  />
                )}
              </PhaseBoundary>
              <PhaseBoundary name="Phase 1 : Cadrage">
                {activeTab === 'phase1' && (
                  <Phase1
                    project={project}
                    setProject={setProject}
                    onNext={() => setActiveTab('phase2')}
                  />
                )}
              </PhaseBoundary>
              <PhaseBoundary name="Phase 2 : Outils de collecte">
                {activeTab === 'phase2' && (
                  <Phase2
                    project={project}
                    setProject={setProject}
                    onNext={() => setActiveTab('phase3')}
                    onPrev={() => setActiveTab('phase1')}
                  />
                )}
              </PhaseBoundary>
              <PhaseBoundary name="Phase 3 : Analyse des données">
                {activeTab === 'phase3' && (
                  <Suspense fallback={<PhaseLoading />}>
                    <Phase3
                      project={project}
                      setProject={setProject}
                      onNext={() => setActiveTab('phase4')}
                      onPrev={() => setActiveTab('phase2')}
                    />
                  </Suspense>
                )}
              </PhaseBoundary>
              <PhaseBoundary name="Phase 4 : Export">
                {activeTab === 'phase4' && (
                  <Suspense fallback={<PhaseLoading />}>
                    <Phase4
                      project={project}
                      setProject={setProject}
                      onPrev={() => setActiveTab('phase3')}
                    />
                  </Suspense>
                )}
              </PhaseBoundary>
              <PhaseBoundary name="Historique">
                {activeTab === 'history' && <HistoryTab logs={historyLogs} />}
              </PhaseBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <PhaseBoundary name="Assistant IA">
        <Chatbot project={project} />
      </PhaseBoundary>

      <AnimatePresence>
        {showOverview && (
          <PhaseBoundary name="Guide de démarrage">
            <QuickOverview onClose={() => setShowOverview(false)} />
          </PhaseBoundary>
        )}
      </AnimatePresence>

      <Toast toast={toast} onDismiss={dismissToast} />

      <ConfirmDialog request={confirmDialog} onCancel={() => setConfirmDialog(null)} />

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />

      <ResourcesPanel
        isOpen={showResources}
        project={project}
        onClose={() => setShowResources(false)}
        onChange={handleResourcesChange}
      />
    </div>
  );
}
