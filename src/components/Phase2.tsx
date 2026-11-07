import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { PhaseProps } from '../types';
import { generateTool, improveTool, extractTextFromFile } from '../lib/api';
import { exportToWord } from '../lib/export';
import { DEFAULT_TOOL_STYLE } from '../lib/constants';
import {
  Loader2,
  FileText,
  Check,
  ArrowLeft,
  ArrowRight,
  Printer,
  Download,
  Settings,
  Edit3,
  Save,
  Wand2,
  Upload,
  UploadCloud,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { showToast } from '../lib/toast';
import { TOOLS, TOOL_STYLES, toolLabel } from '../lib/tool-definitions';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Une erreur inattendue s'est produite.";
}

export default function Phase2({
  project,
  setProject,
  onNext,
  onPrev,
}: PhaseProps & { onNext: () => void; onPrev: () => void }) {
  const [manualName, setManualName] = useState('');
  const [toolStyles, setToolStyles] = useState<Record<string, string>>({});
  const [toolInstructions, setToolInstructions] = useState<Record<string, string>>({});
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [improveInstruction, setImproveInstruction] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasTools = Object.keys(project.tools).length > 0;

  const handleGenerate = async (toolId: string) => {
    setLoading(toolId);
    setActiveTab(toolId);
    try {
      const result = await generateTool(
        project,
        toolLabel(toolId),
        toolId === 'grille' ? manualName : undefined,
        toolStyles[toolId] || DEFAULT_TOOL_STYLE,
        toolInstructions[toolId] || ''
      );
      setProject({ tools: { ...project.tools, [toolId]: result } });
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error), 'error');
    }
    setLoading(null);
  };

  const handleExportWord = () => {
    if (!activeTab || !project.tools[activeTab]) return;
    const element = document.getElementById(`tool-content-${activeTab}`);
    if (element) {
      exportToWord(element.innerHTML, `Outil_${activeTab}`);
    }
  };

  const handleStartEdit = () => {
    if (activeTab) {
      setEditContent(project.tools[activeTab] ?? '');
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (activeTab) {
      setProject({ tools: { ...project.tools, [activeTab]: editContent } });
      setIsEditing(false);
    }
  };

  const handleImport = (toolId: string) => {
    setActiveTab(toolId);
    setEditContent('');
    setIsEditing(true);
  };

  const handleImprove = async () => {
    if (!activeTab || !improveInstruction.trim() || !project.tools[activeTab]) return;

    setIsImproving(true);
    try {
      const result = await improveTool(
        project,
        toolLabel(activeTab),
        project.tools[activeTab],
        improveInstruction
      );
      setProject({ tools: { ...project.tools, [activeTab]: result } });
      setImproveInstruction('');
      showToast("Outil amélioré par l'IA.", 'success');
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error), 'error');
    }
    setIsImproving(false);
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(activeTab);
    try {
      const extracted = await extractTextFromFile(file);
      setEditContent(extracted);
      showToast('Contenu du fichier importé.', 'success');
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error), 'error');
    }
    setLoading(null);
    event.target.value = '';
  };

  if (!project.subject || project.hypotheses.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-12 text-center text-slate-500"
      >
        <FileText size={48} className="mx-auto mb-4 opacity-20" aria-hidden="true" />
        <p className="text-lg">
          Veuillez d'abord valider la Phase 1 (Cadrage) pour générer des outils pertinents.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 lg:grid-cols-3">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 lg:col-span-1 print:hidden"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">Outils à générer</h2>

          <div className="space-y-3">
            {TOOLS.map(tool => {
              const isGenerating = loading === tool.id;
              const isGenerated = !!project.tools[tool.id];
              const isExpanded = expandedConfig === tool.id;

              return (
                <div
                  key={tool.id}
                  className={`relative flex flex-col gap-3 overflow-hidden rounded-xl border p-4 transition-all duration-300 ${
                    isGenerating
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-md ring-2 ring-emerald-200'
                      : isGenerated
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {isGenerating && (
                    <motion.div
                      className="absolute bottom-0 left-0 h-1 bg-emerald-500"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-between">
                    <span
                      className={`font-medium ${isGenerating ? 'text-emerald-700' : 'text-slate-700'}`}
                    >
                      {tool.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {isGenerated && !isGenerating && (
                        <div className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
                          <Check size={14} aria-hidden="true" /> Prêt
                        </div>
                      )}
                      {isGenerating && (
                        <Loader2
                          size={18}
                          className="animate-spin text-emerald-500"
                          aria-hidden="true"
                        />
                      )}
                      <button
                        onClick={() => setExpandedConfig(isExpanded ? null : tool.id)}
                        className={`rounded-md p-1.5 transition-colors ${
                          isExpanded
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                        }`}
                        title="Configurer l'approche"
                        aria-label={`Configurer l'approche pour ${tool.label}`}
                        aria-expanded={isExpanded}
                      >
                        <Settings size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 space-y-3 border-t border-slate-100 pt-2 pb-1">
                          <div>
                            <label
                              htmlFor={`style-${tool.id}`}
                              className="mb-1 block text-xs font-medium text-slate-700"
                            >
                              Approche / Biais psychologique
                            </label>
                            <select
                              id={`style-${tool.id}`}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                              value={toolStyles[tool.id] || DEFAULT_TOOL_STYLE}
                              onChange={event =>
                                setToolStyles({ ...toolStyles, [tool.id]: event.target.value })
                              }
                              disabled={isGenerating}
                            >
                              {TOOL_STYLES.map(style => (
                                <option key={style} value={style}>
                                  {style}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label
                              htmlFor={`instructions-${tool.id}`}
                              className="mb-1 block text-xs font-medium text-slate-700"
                            >
                              Directives personnalisées
                            </label>
                            <textarea
                              id={`instructions-${tool.id}`}
                              className="min-h-[60px] w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="Ex: Ajoute des questions spécifiques sur..."
                              value={toolInstructions[tool.id] || ''}
                              onChange={event =>
                                setToolInstructions({
                                  ...toolInstructions,
                                  [tool.id]: event.target.value,
                                })
                              }
                              disabled={isGenerating}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {tool.id === 'grille' && (
                    <div>
                      <label
                        htmlFor="phase2-manual-name"
                        className="mb-1 block text-xs font-medium text-slate-700"
                      >
                        Nom du manuel
                      </label>
                      <input
                        id="phase2-manual-name"
                        type="text"
                        placeholder="Ex: Ihr und Wir"
                        value={manualName}
                        onChange={event => setManualName(event.target.value)}
                        disabled={isGenerating}
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:opacity-50"
                      />
                    </div>
                  )}

                  <button
                    onClick={() => void handleGenerate(tool.id)}
                    disabled={loading !== null}
                    className={`relative z-10 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                      isGenerating
                        ? 'animate-pulse cursor-wait bg-emerald-100 text-emerald-700'
                        : isGenerated
                          ? 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          : 'bg-slate-800 text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        Génération...
                      </>
                    ) : isGenerated ? (
                      "Régénérer l'outil"
                    ) : (
                      "Générer l'outil"
                    )}
                  </button>

                  {!isGenerated && !isGenerating && (
                    <button
                      onClick={() => void handleImport(tool.id)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Upload size={16} aria-hidden="true" /> Importer / Saisir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="lg:col-span-2"
      >
        {hasTools || loading !== null || isEditing ? (
          <div className="flex h-[800px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:h-auto print:border-none print:shadow-none">
            <div className="flex overflow-x-auto border-b border-slate-200 print:hidden">
              {TOOLS.filter(
                tool =>
                  project.tools[tool.id] ||
                  loading === tool.id ||
                  (isEditing && activeTab === tool.id)
              ).map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTab(tool.id)}
                  className={`border-b-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tool.id
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700'
                      : 'border-transparent text-slate-600 hover:bg-slate-50'
                  }`}
                  aria-current={activeTab === tool.id ? 'true' : undefined}
                >
                  {tool.label}
                </button>
              ))}
              <div className="flex-1" />
              {activeTab && !loading && (project.tools[activeTab] || isEditing) && (
                <div className="flex items-center gap-1 pr-4">
                  {isEditing ? (
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      <Save size={16} aria-hidden="true" /> Enregistrer
                    </button>
                  ) : (
                    <button
                      onClick={handleStartEdit}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                      title="Éditer l'outil"
                      aria-label="Éditer l'outil"
                    >
                      <Edit3 size={18} aria-hidden="true" />
                    </button>
                  )}
                  <div className="mx-1 h-6 w-px bg-slate-200" />
                  <button
                    onClick={() => window.print()}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Imprimer / PDF"
                    aria-label="Imprimer ou exporter en PDF"
                  >
                    <Printer size={18} aria-hidden="true" />
                  </button>
                  <button
                    onClick={handleExportWord}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    title="Télécharger Word"
                    aria-label="Télécharger au format Word"
                  >
                    <Download size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            <div
              className="flex-1 overflow-y-auto bg-slate-50/50 p-8 print:bg-white print:p-0"
              id={`tool-content-${activeTab ?? ''}`}
            >
              {loading === activeTab || isImproving ? (
                <div className="flex h-full flex-col items-center justify-center space-y-6 p-8 text-slate-400">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 shadow-inner"
                  >
                    <Loader2 size={32} className="text-emerald-600" aria-hidden="true" />
                  </motion.div>
                  <div className="space-y-2 text-center">
                    <h3 className="text-xl font-semibold text-slate-800">
                      {isImproving
                        ? "Amélioration de l'outil..."
                        : `Génération de ${toolLabel(activeTab ?? '')}...`}
                    </h3>
                    <p className="mx-auto max-w-md text-sm text-slate-500">
                      {isImproving
                        ? "L'IA applique vos modifications..."
                        : "L'IA analyse votre cadrage et conçoit les questions les plus pertinentes selon l'approche psychologique choisie."}
                    </p>
                  </div>

                  <div className="mt-8 w-full max-w-2xl space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="h-6 w-1/3 animate-pulse rounded-md bg-slate-200" />
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded-md bg-slate-100" />
                      <div className="h-4 w-5/6 animate-pulse rounded-md bg-slate-100" />
                      <div className="h-4 w-4/6 animate-pulse rounded-md bg-slate-100" />
                    </div>
                    <div className="mt-6 h-5 w-1/4 animate-pulse rounded-md bg-slate-200" />
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded-md bg-slate-100" />
                      <div className="h-4 w-full animate-pulse rounded-md bg-slate-100" />
                    </div>
                  </div>
                </div>
              ) : activeTab && (project.tools[activeTab] || isEditing) ? (
                <div className="flex h-full flex-col">
                  {isEditing ? (
                    <div className="flex flex-1 flex-col gap-4">
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100 p-3">
                        <span className="text-sm font-medium text-slate-700">Édition manuelle</span>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700">
                          <UploadCloud size={16} aria-hidden="true" />
                          Importer un fichier (PDF/Word)
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.txt"
                            onChange={event => {
                              void handleFileUpload(event);
                            }}
                          />
                        </label>
                      </div>
                      <textarea
                        aria-label="Contenu de l'outil"
                        value={editContent}
                        onChange={event => setEditContent(event.target.value)}
                        placeholder="Collez ou rédigez votre outil ici (supporte le format Markdown)..."
                        className="w-full flex-1 resize-none rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <div className="prose prose-slate prose-headings:text-emerald-800 prose-a:text-emerald-600 max-w-none flex-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {project.tools[activeTab] ?? ''}
                      </ReactMarkdown>
                    </div>
                  )}

                  {!isEditing && project.tools[activeTab] && (
                    <div className="mt-8 border-t border-slate-200 pt-6 print:hidden">
                      <label
                        htmlFor="phase2-improve"
                        className="mb-2 block flex items-center gap-2 text-sm font-medium text-slate-700"
                      >
                        <Wand2 size={16} className="text-emerald-600" aria-hidden="true" />
                        Demander une modification à l'IA
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="phase2-improve"
                          type="text"
                          value={improveInstruction}
                          onChange={event => setImproveInstruction(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') void handleImprove();
                          }}
                          placeholder="Ex: Rends les questions plus ouvertes, ajoute une section sur..."
                          className="flex-1 rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          onClick={() => void handleImprove()}
                          disabled={!improveInstruction.trim() || isImproving}
                          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Améliorer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
            Sélectionnez un outil à générer dans le panneau de gauche. L'IA concevra un
            questionnaire ou une grille sur mesure basé sur votre cadrage.
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-4 flex flex-col-reverse items-center justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row lg:col-span-3 print:hidden"
      >
        <button
          onClick={onPrev}
          className="flex w-full transform items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-600 transition-colors duration-200 hover:scale-105 hover:bg-slate-50 sm:w-auto"
        >
          <ArrowLeft size={20} aria-hidden="true" /> Retour au Cadrage
        </button>
        <button
          onClick={onNext}
          className="flex w-full transform items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-3 font-medium text-white transition-colors duration-200 hover:scale-105 hover:bg-slate-900 sm:w-auto"
        >
          Étape suivante : Analyse <ArrowRight size={20} aria-hidden="true" />
        </button>
      </motion.div>
    </div>
  );
}
