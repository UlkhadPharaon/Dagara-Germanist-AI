import type { ChangeEvent } from 'react';
import { Check, Cloud, Menu, Sparkles } from 'lucide-react';
import { AI_MODELS, DEFAULT_AI_MODEL } from '../lib/constants';
import { getActiveModelLabel } from '../lib/api';

export type SaveStatus = 'saved' | 'saving';

interface AppHeaderProps {
  activeTabLabel: string;
  projectName: string;
  language: 'fr' | 'de';
  /** Model used by the bundled proxy (ignored when BYOK is active). */
  aiModel: string;
  saveStatus: SaveStatus;
  onOpenSidebar: () => void;
  onModelChange: (model: string) => void;
  onLanguageChange: (language: 'fr' | 'de') => void;
  onProjectNameChange: (name: string) => void;
  onOpenAiSettings: () => void;
  /** Bumped when the BYOK configuration changes, to re-read the active model. */
  aiConfigVersion: number;
}

/** Top bar: identity of the current view, save indicator and the two selectors. */
export default function AppHeader({
  activeTabLabel,
  projectName,
  language,
  aiModel,
  saveStatus,
  onOpenSidebar,
  onModelChange,
  onLanguageChange,
  onProjectNameChange,
  onOpenAiSettings,
  aiConfigVersion,
}: AppHeaderProps) {
  const handleModelChange = (event: ChangeEvent<HTMLSelectElement>) =>
    onModelChange(event.target.value);

  // Re-read on every render bumped by `aiConfigVersion` so the label follows
  // the stored BYOK configuration.
  const activeModel = getActiveModelLabel();
  const isByok = activeModel.providerId !== null;
  void aiConfigVersion;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-8 print:hidden">
      <button
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        onClick={onOpenSidebar}
        aria-label="Ouvrir le menu des projets"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
        <h2 className="truncate text-lg font-semibold text-slate-800">{activeTabLabel}</h2>
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500"
          role="status"
          aria-live="polite"
        >
          {saveStatus === 'saving' ? (
            <>
              <Cloud size={14} className="animate-pulse text-emerald-500" aria-hidden="true" />
              <span>Enregistrement...</span>
            </>
          ) : (
            <>
              <Check size={14} className="text-emerald-600" aria-hidden="true" />
              <span>Enregistré</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none sm:gap-4">
        {/* Bundled-proxy model selector: hidden while a personal key is active. */}
        {!isByok && (
          <>
            <label htmlFor="ai-model-select" className="sr-only">
              Modèle d'intelligence artificielle
            </label>
            <select
              id="ai-model-select"
              value={aiModel || DEFAULT_AI_MODEL}
              onChange={handleModelChange}
              className="hidden shrink-0 cursor-pointer rounded-lg border-none bg-slate-100 px-2 py-1.5 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 sm:px-3 md:block"
              title="Modèle d'Intelligence Artificielle"
            >
              {AI_MODELS.map(model => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </>
        )}

        <button
          onClick={onOpenAiSettings}
          className="inline-flex max-w-[170px] shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
          title={isByok ? 'Modèle et clé personnalisés' : 'Utiliser votre propre clé API'}
          aria-label={
            isByok
              ? `Modèle actif : ${activeModel.model}. Modifier la clé API.`
              : 'Configurer votre propre clé API et choisir un modèle'
          }
        >
          <Sparkles size={13} className="shrink-0 text-emerald-600" aria-hidden="true" />
          <span className="truncate">{isByok ? activeModel.model : 'Ma clé API'}</span>
        </button>

        <label htmlFor="tool-language-select" className="sr-only">
          Langue de génération des outils
        </label>
        <select
          id="tool-language-select"
          value={language}
          onChange={event => onLanguageChange(event.target.value === 'de' ? 'de' : 'fr')}
          className="shrink-0 cursor-pointer rounded-lg border-none bg-slate-100 px-2 py-1.5 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 sm:px-3"
          title="Langue de génération des outils"
        >
          <option value="fr">🇫🇷 FR</option>
          <option value="de">🇩🇪 DE</option>
        </select>

        <label htmlFor="project-name-input" className="sr-only">
          Nom du projet
        </label>
        <input
          id="project-name-input"
          type="text"
          value={projectName}
          onChange={event => onProjectNameChange(event.target.value)}
          className="w-full max-w-[150px] rounded-lg border-none bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 sm:w-48 sm:max-w-none"
          placeholder="Nom du projet..."
        />
      </div>
    </header>
  );
}
