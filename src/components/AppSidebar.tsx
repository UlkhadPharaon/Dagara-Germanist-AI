import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpDown,
  Check,
  Cloud,
  CloudOff,
  Download,
  HardDrive,
  LayoutDashboard,
  Library,
  Plus,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import type { ProjectData } from '../types';
import type { StorageMode } from '../hooks/useProjectSync';

export interface WorkflowTab {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  color: string;
  bg: string;
}

export type SortOrder = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

const SORT_LABELS: Record<SortOrder, string> = {
  'date-desc': 'Plus récents',
  'date-asc': 'Plus anciens',
  'name-asc': 'Nom (A-Z)',
  'name-desc': 'Nom (Z-A)',
};

interface AppSidebarProps {
  tabs: WorkflowTab[];
  activeTab: string;
  projects: ProjectData[];
  currentProjectId: string;
  sortBy: SortOrder;
  isOpen: boolean;
  /** Where project data currently lives — drives the badge and account hint. */
  storageMode: StorageMode;
  accountEmail: string | null;
  /** Number of user documents attached to the current project. */
  resourceCount: number;
  onSelectTab: (tabId: string) => void;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onSortChange: (sort: SortOrder) => void;
  onClose: () => void;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenAccount: () => void;
  onOpenResources: () => void;
}

const STORAGE_LABELS: Record<
  StorageMode,
  { label: string; icon: typeof Cloud; className: string }
> = {
  local: {
    label: 'Stockage local',
    icon: HardDrive,
    className: 'text-slate-500 bg-slate-100',
  },
  cloud: {
    label: 'Synchronisé (cloud)',
    icon: Cloud,
    className: 'text-emerald-600 bg-emerald-50',
  },
  loading: {
    label: 'Chargement...',
    icon: CloudOff,
    className: 'text-slate-400 bg-slate-100',
  },
};

/** Left rail: workflow navigation, project list and the backup controls. */
export default function AppSidebar({
  tabs,
  activeTab,
  projects,
  currentProjectId,
  sortBy,
  isOpen,
  storageMode,
  accountEmail,
  resourceCount,
  onSelectTab,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  onSortChange,
  onClose,
  onExport,
  onImport,
  onOpenAccount,
  onOpenResources,
}: AppSidebarProps) {
  const storage = STORAGE_LABELS[storageMode];
  const StorageIcon = storage.icon;
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-72 transform flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 print:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'} `}
      aria-label="Navigation principale"
    >
      <div className="flex items-center justify-between border-b border-slate-100 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <LayoutDashboard size={20} aria-hidden="true" />
          </div>
          <div>
            <h1 className="leading-tight font-bold text-slate-800">Dagara Germanist AI</h1>
            <p className="text-xs text-slate-500">for Inspector</p>
          </div>
        </div>
        <button className="text-slate-400 lg:hidden" onClick={onClose} aria-label="Fermer le menu">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <nav aria-label="Phases de recherche">
          <div className="mb-4 px-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Workflows
          </div>
          {tabs.map((tab, index) => (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-100 font-medium text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div
                className={`rounded-lg p-2 ${activeTab === tab.id ? tab.bg : 'bg-slate-50'} ${tab.color}`}
              >
                <tab.icon size={18} aria-hidden="true" />
              </div>
              {tab.label}
            </motion.button>
          ))}
        </nav>

        <section aria-label="Mes projets">
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Mes Projets
            </div>
            <button
              onClick={onNewProject}
              className="rounded-md bg-emerald-50 p-1 text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
              title="Nouveau projet"
              aria-label="Créer un nouveau projet"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="mb-3 px-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
              <ArrowUpDown size={14} className="ml-1 shrink-0 text-slate-400" aria-hidden="true" />
              <label htmlFor="project-sort" className="sr-only">
                Trier les projets
              </label>
              <select
                id="project-sort"
                value={sortBy}
                onChange={event => onSortChange(event.target.value as SortOrder)}
                className="flex-1 cursor-pointer border-none bg-transparent text-xs text-slate-600 outline-none"
              >
                {(Object.keys(SORT_LABELS) as SortOrder[]).map(order => (
                  <option key={order} value={order}>
                    {SORT_LABELS[order]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <AnimatePresence>
              {projects.map((project, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={`group flex w-full cursor-pointer items-center justify-between rounded-xl p-3 text-left transition-colors ${
                    currentProjectId === project.id
                      ? 'border border-emerald-100 bg-emerald-50'
                      : 'border border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${
                        currentProjectId === project.id
                          ? 'font-semibold text-emerald-900'
                          : 'font-medium text-slate-700'
                      }`}
                    >
                      {project.name || project.subject || 'Projet sans titre'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {new Date(project.lastModified).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={event => {
                      event.stopPropagation();
                      onDeleteProject(project.id);
                    }}
                    className="rounded-lg p-2 text-slate-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                    title="Supprimer le projet"
                    aria-label={`Supprimer le projet ${project.name || project.subject || 'sans titre'}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      </div>

      <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center justify-between px-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${storage.className}`}
            role="status"
            aria-live="polite"
          >
            <StorageIcon size={12} aria-hidden="true" />
            {storage.label}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenResources}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700"
              aria-label={
                resourceCount > 0
                  ? `Bibliothèque de documents (${resourceCount})`
                  : 'Ouvrir la bibliothèque de documents'
              }
            >
              <Library size={13} aria-hidden="true" />
              Documents
              {resourceCount > 0 && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {resourceCount}
                </span>
              )}
            </button>
            <button
              onClick={onOpenAccount}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700"
              aria-label={accountEmail ? `Compte : ${accountEmail}` : 'Ouvrir le panneau de compte'}
            >
              <UserRound size={13} aria-hidden="true" />
              {accountEmail ?? 'Compte'}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-3 px-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Sauvegarde & Restauration
          </div>
          <div className="flex gap-2">
            <button
              onClick={onExport}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-emerald-600"
              title="Exporter tous les projets"
            >
              <Download size={14} aria-hidden="true" /> Exporter
            </button>
            <label
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-emerald-600"
              title="Importer des projets"
            >
              <Upload size={14} aria-hidden="true" /> Importer
              <input
                type="file"
                accept=".json"
                onChange={onImport}
                className="hidden"
                aria-label="Importer des projets depuis un fichier JSON"
              />
            </label>
          </div>
          <p className="mt-2 flex items-start gap-1.5 px-2 text-[11px] text-slate-400">
            <Check size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            L'export .json reste la sauvegarde de secours, même en mode cloud.
          </p>
        </div>
      </div>
    </aside>
  );
}

/** Storage badge copy shared with the account panel. */
export const STORAGE_BADGE: Record<StorageMode, string> = {
  local: 'Stockage local',
  cloud: 'Synchronisé (cloud)',
  loading: 'Chargement...',
};
