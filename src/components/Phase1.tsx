import { useState } from 'react';
import type { PhaseProps } from '../types';
import { generateCadrage, refineArchitecturePart, type RefinablePart } from '../lib/api';
import { exportToWord } from '../lib/export';
import { DEFAULT_CYCLE, RESEARCH_CYCLES } from '../lib/constants';
import { Loader2, CheckCircle, Edit3, ArrowRight, Printer, Download, Wand2 } from 'lucide-react';
import { motion } from 'motion/react';
import { showToast } from '../lib/toast';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Une erreur inattendue s'est produite.";
}

const PARTS: Array<{ id: RefinablePart; label: string; placeholder: string }> = [
  {
    id: 'hypotheses',
    label: 'hypothèses',
    placeholder: 'Ex: Rends les hypothèses plus opérationnelles...',
  },
  {
    id: 'questions',
    label: 'questions de recherche',
    placeholder: 'Ex: Précise la question principale...',
  },
  {
    id: 'objectives',
    label: 'objectifs',
    placeholder: 'Ex: Ajoute un objectif méthodologique...',
  },
];

export default function Phase1({
  project,
  setProject,
  onNext,
}: PhaseProps & { onNext: () => void }) {
  const [loading, setLoading] = useState(false);
  const [refiningPart, setRefiningPart] = useState<RefinablePart | null>(null);
  const [refineInstructions, setRefineInstructions] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [subject, setSubject] = useState(project.subject);
  const [cycle, setCycle] = useState(project.cycle || DEFAULT_CYCLE);
  const [context, setContext] = useState(project.context);

  const handleGenerate = async () => {
    if (!subject.trim()) {
      showToast('Veuillez saisir un sujet de recherche.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await generateCadrage(subject, cycle, context, project.resources);
      setProject({
        subject,
        cycle,
        context,
        hypotheses: result.hypotheses,
        questions: result.questions,
        objectives: result.objectives,
      });
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error), 'error');
    }
    setLoading(false);
  };

  const handleExportWord = () => {
    const content = `
      <h1>Architecture de Recherche</h1>
      <h2>Sujet</h2><p>${project.subject}</p>
      <h2>Cycle</h2><p>${project.cycle}</p>
      <h2>Contexte</h2><p>${project.context}</p>
      <h2>Hypothèses</h2><ul>${project.hypotheses.map(item => `<li>${item}</li>`).join('')}</ul>
      <h2>Questions de recherche</h2><ul>${project.questions.map(item => `<li>${item}</li>`).join('')}</ul>
      <h2>Objectif Général</h2><p>${project.objectives.general}</p>
      <h2>Objectifs Spécifiques</h2><ul>${project.objectives.specific.map(item => `<li>${item}</li>`).join('')}</ul>
    `;
    exportToWord(content, 'Cadrage_Recherche');
  };

  const handleRefine = async (part: RefinablePart) => {
    if (!refineInstructions.trim()) return;

    setIsRefining(true);
    try {
      const result = await refineArchitecturePart(project, part, refineInstructions);
      if (part === 'objectives') {
        const objectives =
          typeof result === 'object' && !Array.isArray(result)
            ? result
            : { general: '', specific: [] };
        setProject({ objectives });
      } else {
        const list = Array.isArray(result) ? result : [];
        setProject(part === 'hypotheses' ? { hypotheses: list } : { questions: list });
      }
      setRefiningPart(null);
      setRefineInstructions('');
      showToast("Section mise à jour par l'IA.", 'success');
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error), 'error');
    }
    setIsRefining(false);
  };

  const hasFramework = project.hypotheses.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:hidden"
      >
        <h2 className="mb-4 text-xl font-semibold text-slate-800">1. Définition du Sujet</h2>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="phase1-subject"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Sujet ou Thème de recherche
            </label>
            <input
              id="phase1-subject"
              type="text"
              value={subject}
              onChange={event => setSubject(event.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ex: L'impact des supports numériques sur la motivation..."
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="phase1-cycle"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Cycle concerné
              </label>
              <select
                id="phase1-cycle"
                value={cycle}
                onChange={event => setCycle(event.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {RESEARCH_CYCLES.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="phase1-context"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Contexte spécifique (Optionnel)
              </label>
              <input
                id="phase1-context"
                type="text"
                value={context}
                onChange={event => setContext(event.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex: Zone rurale, classes pléthoriques..."
              />
            </div>
          </div>
          <button
            onClick={() => void handleGenerate()}
            disabled={loading || !subject}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} aria-hidden="true" />
            ) : (
              <CheckCircle size={20} aria-hidden="true" />
            )}
            Générer l'Architecture de Recherche
          </button>
        </div>
      </motion.div>

      {hasFramework && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800">2. Architecture Générée</h2>
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                title="Imprimer / PDF"
                aria-label="Imprimer ou exporter en PDF"
              >
                <Printer size={20} aria-hidden="true" />
              </button>
              <button
                onClick={handleExportWord}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
                title="Télécharger Word"
                aria-label="Télécharger au format Word"
              >
                <Download size={20} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-medium text-slate-800">
                <Edit3 size={18} className="text-emerald-600" aria-hidden="true" /> Hypothèses
              </h3>
              <button
                onClick={() => setRefiningPart(refiningPart === 'hypotheses' ? null : 'hypotheses')}
                className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 print:hidden"
                aria-expanded={refiningPart === 'hypotheses'}
              >
                <Wand2 size={14} aria-hidden="true" /> Recadrer avec l'IA
              </button>
            </div>
            <textarea
              aria-label="Hypothèses de recherche"
              className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 p-4"
              value={project.hypotheses.join('\n')}
              onChange={event =>
                setProject({
                  hypotheses: event.target.value.split('\n').filter(line => line.trim()),
                })
              }
            />
            {refiningPart === 'hypotheses' && (
              <RefinementPanel
                placeholder={
                  PARTS[0]?.placeholder ?? 'Ex: Rends les hypothèses plus opérationnelles...'
                }
                value={refineInstructions}
                busy={isRefining}
                onChange={setRefineInstructions}
                onSubmit={() => void handleRefine('hypotheses')}
                onCancel={() => setRefiningPart(null)}
              />
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-medium text-slate-800">
                <Edit3 size={18} className="text-emerald-600" aria-hidden="true" /> Questions de
                recherche
              </h3>
              <button
                onClick={() => setRefiningPart(refiningPart === 'questions' ? null : 'questions')}
                className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 print:hidden"
                aria-expanded={refiningPart === 'questions'}
              >
                <Wand2 size={14} aria-hidden="true" /> Recadrer avec l'IA
              </button>
            </div>
            <textarea
              aria-label="Questions de recherche"
              className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 p-4"
              value={project.questions.join('\n')}
              onChange={event =>
                setProject({
                  questions: event.target.value.split('\n').filter(line => line.trim()),
                })
              }
            />
            {refiningPart === 'questions' && (
              <RefinementPanel
                placeholder={PARTS[1]?.placeholder ?? 'Ex: Précise la question principale...'}
                value={refineInstructions}
                busy={isRefining}
                onChange={setRefineInstructions}
                onSubmit={() => void handleRefine('questions')}
                onCancel={() => setRefiningPart(null)}
              />
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-medium text-slate-800">
                <Edit3 size={18} className="text-emerald-600" aria-hidden="true" /> Objectifs
              </h3>
              <button
                onClick={() => setRefiningPart(refiningPart === 'objectives' ? null : 'objectives')}
                className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 print:hidden"
                aria-expanded={refiningPart === 'objectives'}
              >
                <Wand2 size={14} aria-hidden="true" /> Recadrer avec l'IA
              </button>
            </div>
            <div className="space-y-3">
              <textarea
                aria-label="Objectif général"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4"
                value={project.objectives.general}
                onChange={event =>
                  setProject({ objectives: { ...project.objectives, general: event.target.value } })
                }
                placeholder="Objectif général"
              />
              <textarea
                aria-label="Objectifs spécifiques"
                className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 p-4"
                value={project.objectives.specific.join('\n')}
                onChange={event =>
                  setProject({
                    objectives: {
                      ...project.objectives,
                      specific: event.target.value.split('\n').filter(line => line.trim()),
                    },
                  })
                }
                placeholder="Objectifs spécifiques"
              />
            </div>
            {refiningPart === 'objectives' && (
              <RefinementPanel
                placeholder={PARTS[2]?.placeholder ?? 'Ex: Ajoute un objectif méthodologique...'}
                value={refineInstructions}
                busy={isRefining}
                onChange={setRefineInstructions}
                onSubmit={() => void handleRefine('objectives')}
                onCancel={() => setRefiningPart(null)}
              />
            )}
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-4 print:hidden">
            <button
              onClick={onNext}
              className="flex w-full transform items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-3 font-medium text-white transition-colors duration-200 hover:scale-105 hover:bg-slate-900 sm:w-auto"
            >
              Étape suivante : Outils <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/** Prompt box used to rewrite one section of the framework with the AI. */
function RefinementPanel({
  placeholder,
  value,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
      <label htmlFor="phase1-refine" className="block text-sm font-medium text-emerald-800">
        Instructions de recadrage
      </label>
      <textarea
        id="phase1-refine"
        className="min-h-[80px] w-full rounded-xl border border-emerald-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSubmit();
        }}
      />
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={busy || !value.trim()}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Wand2 size={16} aria-hidden="true" />
          )}
          Appliquer
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
