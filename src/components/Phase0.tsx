import { useState } from 'react';
import type { PhaseProps } from '../types';
import { generateLiteratureReview } from '../lib/api';
import { Loader2, Search, ArrowRight, BookOpen, User, Lightbulb } from 'lucide-react';
import { motion } from 'motion/react';
import { showToast } from '../lib/toast';

/** Extracts a human-readable message from any thrown value. */
function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Une erreur inattendue s'est produite.";
}

export default function Phase0({
  project,
  setProject,
  onNext,
}: PhaseProps & { onNext: () => void }) {
  const [keywords, setKeywords] = useState(
    Array.isArray(project.literatureReview?.keywords)
      ? project.literatureReview.keywords.join(', ')
      : ''
  );
  const [context, setContext] = useState(project.context || '');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!keywords.trim()) {
      showToast('Veuillez entrer au moins un mot-clé.', 'error');
      return;
    }

    setLoading(true);
    try {
      const review = await generateLiteratureReview(keywords, context);
      setProject({ context, literatureReview: review });
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error), 'error');
    }
    setLoading(false);
  };

  const review = project.literatureReview;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Search size={20} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">
            Phase 0 : Assistant de Revue de Littérature
          </h2>
        </div>

        <p className="mb-6 text-sm text-slate-600">
          Avant de définir votre problématique, explorez les concepts clés et les théories
          didactiques pertinentes pour votre sujet.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="phase0-keywords"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Mots-clés de votre recherche
            </label>
            <input
              id="phase0-keywords"
              type="text"
              value={keywords}
              onChange={event => setKeywords(event.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: motivation, numérique, expression orale, classes pléthoriques..."
            />
          </div>
          <div>
            <label
              htmlFor="phase0-context"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Contexte spécifique (Optionnel)
            </label>
            <input
              id="phase0-context"
              type="text"
              value={context}
              onChange={event => setContext(event.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: Enseignement au Burkina Faso, zone rurale..."
            />
          </div>
          <button
            onClick={() => void handleGenerate()}
            disabled={loading || !keywords}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} aria-hidden="true" />
            ) : (
              <Search size={20} aria-hidden="true" />
            )}
            Explorer la littérature
          </button>
        </div>
      </motion.div>

      {review && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-slate-800">
                <Lightbulb size={18} className="text-amber-500" aria-hidden="true" /> Concepts Clés
              </h3>
              <ul className="space-y-2">
                {review.keywords.map((keyword, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 text-amber-500" aria-hidden="true">
                      •
                    </span>{' '}
                    {keyword}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-slate-800">
                <BookOpen size={18} className="text-blue-500" aria-hidden="true" /> Théories
                Didactiques
              </h3>
              <ul className="space-y-2">
                {review.theories.map((theory, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 text-blue-500" aria-hidden="true">
                      •
                    </span>{' '}
                    {theory}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-slate-800">
              <User size={18} className="text-emerald-500" aria-hidden="true" /> Auteurs de
              Référence
            </h3>
            <div className="flex flex-wrap gap-2">
              {review.authors.map((author, index) => (
                <span
                  key={index}
                  className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"
                >
                  {author}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-2 text-lg font-medium text-slate-800">
              Résumé de la problématique potentielle
            </h3>
            <p className="text-sm leading-relaxed text-slate-700">{review.summary}</p>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={onNext}
              className="flex w-full transform items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-3 font-medium text-white transition-colors duration-200 hover:scale-105 hover:bg-slate-900 sm:w-auto"
            >
              Passer au Cadrage (Phase 1) <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
