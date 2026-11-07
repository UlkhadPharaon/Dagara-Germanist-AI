import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, Eye, EyeOff, Loader2, Sparkles, Trash2 } from 'lucide-react';
import {
  describeCapabilities,
  fetchProviderModels,
  FALLBACK_PROVIDER,
  PROVIDERS,
  type AiModel,
  type ProviderDefinition,
} from '../lib/providers';
import { clearAiConfig, getAiConfig, getLastSelection, setAiConfig } from '../lib/ai-config';
import { getSelectedModel, setSelectedModel } from '../lib/api';
import { AI_MODELS } from '../lib/constants';
import { showToast } from '../lib/toast';

/**
 * "Bring your own key" settings.
 *
 * The user picks a provider, pastes their key, and we fetch only the models
 * that can read images (required by Phase 2/3). Without a key the app keeps
 * using its own proxy and the built-in model list.
 */
export default function AiSettingsModal({
  isOpen,
  onClose,
  onConfigChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: () => void;
}) {
  const active = getAiConfig();
  const lastSelection = getLastSelection();

  const [providerId, setProviderId] = useState(active?.providerId ?? lastSelection.providerId);
  const [apiKey, setApiKey] = useState(active?.apiKey ?? '');
  const [models, setModels] = useState<AiModel[]>([]);
  const [modelId, setModelId] = useState(active?.modelId ?? lastSelection.modelId ?? '');
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const provider = PROVIDERS.find(item => item.id === providerId) ?? FALLBACK_PROVIDER;
  const selectedModel = models.find(model => model.id === modelId) ?? models[0];

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    // Re-read the stored configuration each time the panel opens.
    const stored = getAiConfig();
    if (stored) {
      setProviderId(stored.providerId);
      setApiKey(stored.apiKey);
      setModelId(stored.modelId);
    }
  }, [isOpen]);

  const loadModels = async (target: ProviderDefinition = provider, key: string = apiKey) => {
    if (!key.trim()) {
      setError('Saisissez votre clé API pour lister les modèles.');
      return;
    }

    setLoadingModels(true);
    setError(null);

    try {
      const list = await fetchProviderModels(target, key.trim());
      if (list.length === 0) {
        setModels([]);
        setError(
          `Aucun modèle multimodal trouvé sur ${target.label}. Seuls les modèles acceptant le texte et les images sont listés.`
        );
        return;
      }
      setModels(list);
      const firstModel = list[0];
      setModelId(previous =>
        firstModel && list.some(model => model.id === previous) ? previous : (firstModel?.id ?? '')
      );
    } catch (loadError) {
      setModels([]);
      setError(
        loadError instanceof Error ? loadError.message : 'Chargement des modèles impossible.'
      );
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();

    if (!apiKey.trim()) {
      setError('Saisissez votre clé API.');
      return;
    }
    if (!modelId) {
      setError('Sélectionnez un modèle.');
      return;
    }

    try {
      setAiConfig({ providerId: provider.id, apiKey: apiKey.trim(), modelId });
      onConfigChange();
      showToast(`Clé ${provider.label} enregistrée. Modèle : ${modelId}`, 'success');
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Enregistrement impossible.');
    }
  };

  const handleRemove = () => {
    clearAiConfig();
    setApiKey('');
    setModels([]);
    setModelId('');
    setError(null);
    onConfigChange();
    showToast('Clé supprimée — retour au mode par défaut.', 'info');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-settings-title"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className="my-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="ai-settings-title"
                  className="flex items-center gap-2 text-xl font-semibold text-slate-800"
                >
                  <Sparkles size={18} className="text-emerald-600" aria-hidden="true" />
                  Modèle d'IA &amp; clé API
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Utilisez votre propre clé pour choisir votre fournisseur et votre modèle, ou
                  laissez l'application utiliser sa configuration par défaut.
                </p>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fermer les réglages IA"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor="ai-provider"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Fournisseur
                </label>
                <select
                  id="ai-provider"
                  value={providerId}
                  onChange={event => {
                    setProviderId(event.target.value);
                    setModels([]);
                    setModelId('');
                    setError(null);
                  }}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-emerald-500"
                >
                  {PROVIDERS.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Clé attendue :{' '}
                  <a
                    href={provider.keyHelpUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-emerald-600 underline"
                  >
                    {provider.keyHelpUrl.replace(/^https?:\/\//, '')}
                  </a>
                  {provider.keyPrefix ? ` (commence par ${provider.keyPrefix})` : ''}
                </p>
              </div>

              <div>
                <label htmlFor="ai-key" className="mb-1 block text-sm font-medium text-slate-700">
                  Votre clé API
                </label>
                <div className="flex gap-2">
                  <input
                    id="ai-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={event => setApiKey(event.target.value)}
                    placeholder={provider.keyPrefix ?? 'Collez votre clé'}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 rounded-xl border border-slate-300 p-3 font-mono text-sm outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(previous => !previous)}
                    className="rounded-xl border border-slate-300 px-3 text-slate-500 transition-colors hover:bg-slate-50"
                    aria-label={showKey ? 'Masquer la clé' : 'Afficher la clé'}
                  >
                    {showKey ? (
                      <EyeOff size={16} aria-hidden="true" />
                    ) : (
                      <Eye size={16} aria-hidden="true" />
                    )}
                  </button>
                </div>
                <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  La clé est enregistrée dans ce navigateur uniquement et envoyée directement à{' '}
                  {provider.label} — jamais à nos serveurs.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadModels()}
                  disabled={loadingModels || !apiKey.trim()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {loadingModels ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Check size={15} aria-hidden="true" />
                  )}
                  {loadingModels ? 'Chargement…' : 'Lister les modèles multimodaux'}
                </button>
                {models.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {models.length} modèle(s) compatible(s)
                  </span>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              {models.length > 0 && (
                <div>
                  <label
                    htmlFor="ai-model"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Modèle
                  </label>
                  <select
                    id="ai-model"
                    value={modelId}
                    onChange={event => setModelId(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-emerald-500"
                  >
                    {models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                        {model.supportsTools ? '' : ' (sans tool calling)'}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedModel ? describeCapabilities(selectedModel) : ''}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={!active}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                >
                  <Trash2 size={15} aria-hidden="true" /> Retirer ma clé
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!modelId || !apiKey.trim()}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
              <p className="mb-1 font-medium text-slate-700">Mode par défaut (sans clé)</p>
              <p>
                L'application utilise alors son propre intermédiaire et l'un de ces modèles :{' '}
                {AI_MODELS.map(model => model.label).join(', ')}. Modèle actif :{' '}
                <span className="font-mono">{getSelectedModel()}</span>.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Small trigger used in the app header. */
export function AiSettingsButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
      title="Choisir le fournisseur, la clé API et le modèle"
      aria-label={label}
    >
      <Sparkles size={13} className="text-emerald-600" aria-hidden="true" />
      {label}
    </button>
  );
}

export { setSelectedModel };
