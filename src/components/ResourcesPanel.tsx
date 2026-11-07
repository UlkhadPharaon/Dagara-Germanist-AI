import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, FileText, Loader2, Paperclip, StickyNote, Trash2, UploadCloud } from 'lucide-react';
import type { ProjectData, ProjectResource } from '../types';
import { extractTextFromFile } from '../lib/api';
import {
  ACCEPTED_FILE_TYPES,
  createResourceId,
  formatFileSize,
  FREE_TIER_MAX_RESOURCES,
  isSupportedFile,
  MAX_CHARS_PER_RESOURCE,
  truncateResource,
} from '../lib/resources';
import { MAX_RESOURCES_PER_PROJECT } from '../lib/constants';
import { showToast } from '../lib/toast';

/**
 * Project resource library: the user's own documents and notes.
 *
 * Files are read once (DOCX locally, other formats through the model's OCR) and
 * stored as text, so they can be re-used offline in every phase without paying
 * for extraction again.
 */
export default function ResourcesPanel({
  isOpen,
  project,
  onClose,
  onChange,
}: {
  isOpen: boolean;
  project: ProjectData;
  onClose: () => void;
  onChange: (resources: ProjectResource[]) => void;
}) {
  const resources = project.resources ?? [];
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atFreeLimit = resources.length >= FREE_TIER_MAX_RESOURCES;
  const atHardLimit = resources.length >= MAX_RESOURCES_PER_PROJECT;

  const addResource = (resource: ProjectResource): void => {
    onChange([...resources, resource]);
  };

  const removeResource = (id: string): void => {
    onChange(resources.filter(resource => resource.id !== id));
  };

  const toggleResource = (id: string): void => {
    onChange(
      resources.map(resource =>
        resource.id === id ? { ...resource, enabled: !resource.enabled } : resource
      )
    );
  };

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    if (files.length === 0) return;

    if (atHardLimit) {
      showToast(
        `Limite de ${MAX_RESOURCES_PER_PROJECT} documents atteinte pour ce projet.`,
        'error'
      );
      return;
    }

    for (const file of files) {
      if (!isSupportedFile(file.name)) {
        showToast(`Format non pris en charge : ${file.name}`, 'error');
        continue;
      }
      if (resources.length + 1 > MAX_RESOURCES_PER_PROJECT) break;

      setImporting(file.name);
      try {
        const content = await extractTextFromFile(file);
        if (content.trim().length === 0) {
          showToast(`Aucun texte extrait de ${file.name}.`, 'error');
          continue;
        }
        addResource({
          id: createResourceId(),
          name: file.name,
          kind: 'fichier',
          content,
          size: file.size,
          mimeType: file.type,
          createdAt: Date.now(),
          enabled: true,
        });
        showToast(`${file.name} ajouté à la bibliothèque.`, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Extraction impossible.';
        console.error(error);
        showToast(`${file.name} : ${message}`, 'error');
      } finally {
        setImporting(null);
      }
    }
  };

  const handleAddNote = (event: React.FormEvent): void => {
    event.preventDefault();

    const title = noteTitle.trim();
    const body = noteBody.trim();
    if (!title || !body) {
      showToast('Un titre et un contenu sont requis pour une note.', 'error');
      return;
    }
    if (atHardLimit) {
      showToast(`Limite de ${MAX_RESOURCES_PER_PROJECT} documents atteinte.`, 'error');
      return;
    }

    addResource({
      id: createResourceId(),
      name: title,
      kind: 'note',
      content: body,
      createdAt: Date.now(),
      enabled: true,
    });
    setNoteTitle('');
    setNoteBody('');
    showToast('Note ajoutée à la bibliothèque.', 'success');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resources-title"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className="my-auto w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="resources-title" className="text-xl font-semibold text-slate-800">
                  Mes documents &amp; notes
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Importez vos rapports, transcriptions, photos de manuels ou notes : l'IA s'en
                  servira comme référence dans toutes les phases.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fermer la bibliothèque"
              >
                ✕
              </button>
            </div>

            {atFreeLimit && (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Le tiers gratuit est limité à {FREE_TIER_MAX_RESOURCES} documents par projet. Le
                tiers Pro n'impose aucune limite.
              </p>
            )}

            {/* Import */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition-colors hover:bg-slate-50">
                <UploadCloud size={28} className="mb-2 text-slate-400" aria-hidden="true" />
                <span className="text-sm font-medium text-slate-700">Importer des fichiers</span>
                <span className="mt-1 text-xs text-slate-400">PDF, Word, TXT, images</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_FILE_TYPES}
                  className="hidden"
                  onChange={event => void handleFiles(event)}
                  aria-label="Importer des documents dans la bibliothèque"
                />
              </label>

              <form
                onSubmit={handleAddNote}
                className="space-y-2 rounded-xl border border-slate-200 p-4"
              >
                <label htmlFor="note-title" className="block text-xs font-medium text-slate-700">
                  Ajouter une note
                </label>
                <input
                  id="note-title"
                  type="text"
                  value={noteTitle}
                  onChange={event => setNoteTitle(event.target.value)}
                  placeholder="Titre (ex: Compte rendu de visite)"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-emerald-500"
                />
                <textarea
                  id="note-body"
                  aria-label="Contenu de la note"
                  value={noteBody}
                  onChange={event => setNoteBody(event.target.value)}
                  placeholder="Collez ici vos observations, un extrait d'entretien, une consigne..."
                  className="h-20 w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!noteTitle.trim() || !noteBody.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
                >
                  <StickyNote size={15} aria-hidden="true" /> Ajouter la note
                </button>
              </form>
            </div>

            {importing && (
              <p
                className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"
                role="status"
                aria-live="polite"
              >
                <Loader2 size={16} className="animate-spin text-emerald-600" aria-hidden="true" />
                Extraction de « {importing} » en cours…
              </p>
            )}

            {/* List */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  Bibliothèque du projet ({resources.length})
                </h3>
                <p className="text-xs text-slate-400">
                  {MAX_CHARS_PER_RESOURCE.toLocaleString('fr-FR')} caractères max. par document
                </p>
              </div>

              {resources.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                  Aucun document pour l'instant. Importez un fichier ou ajoutez une note pour
                  enrichir le contexte de l'IA.
                </p>
              ) : (
                <ul className="space-y-2">
                  {resources.map(resource => {
                    const kept = truncateResource(resource.content, MAX_CHARS_PER_RESOURCE);
                    return (
                      <li
                        key={resource.id}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <input
                          type="checkbox"
                          checked={resource.enabled}
                          onChange={() => toggleResource(resource.id)}
                          className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
                          aria-label={`Utiliser « ${resource.name} » comme référence`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-800">
                            {resource.kind === 'note' ? (
                              <StickyNote
                                size={14}
                                className="shrink-0 text-indigo-500"
                                aria-hidden="true"
                              />
                            ) : (
                              <Paperclip
                                size={14}
                                className="shrink-0 text-emerald-600"
                                aria-hidden="true"
                              />
                            )}
                            {resource.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {resource.kind === 'note' ? 'Note' : 'Fichier'}
                            {resource.size ? ` · ${formatFileSize(resource.size)}` : ''} ·{' '}
                            {new Date(resource.createdAt).toLocaleDateString('fr-FR')} ·{' '}
                            {kept.truncated
                              ? `${kept.keptChars} car. transmis (tronqué)`
                              : `${resource.content.length} car.`}
                          </p>
                        </div>
                        <button
                          onClick={() => removeResource(resource.id)}
                          className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label={`Retirer « ${resource.name} » de la bibliothèque`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Check size={14} className="text-emerald-600" aria-hidden="true" />
                Décochez un document pour le conserver sans l'envoyer à l'IA.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Fermer
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Small badge used in the sidebar to show how many resources are attached. */
export function ResourcesBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
      {count}
    </span>
  );
}

/** Exported for the Phase 3 picker icon reuse. */
export const ResourceIcon = FileText;
