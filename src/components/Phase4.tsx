import { useState } from 'react';
import type { PhaseProps } from '../types';
import { generateBibliography } from '../lib/api';
import { Loader2, Book, Download, ArrowLeft, FileText, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { exportToWord } from '../lib/export';
import { showToast } from '../lib/toast';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Une erreur inattendue s'est produite.";
}

/** Minimal Markdown → HTML for the Word export (headings, bold, italic, breaks). */
function markdownToHtml(markdown: string): string {
  return markdown
    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^## (.*$)/gim, '<h3>$1</h3>')
    .replace(/^# (.*$)/gim, '<h2>$1</h2>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\n/gim, '<br>');
}

const listItems = (items: string[]): string => items.map(item => `<li>${item}</li>`).join('');

export default function Phase4({
  project,
  setProject,
  onPrev,
}: PhaseProps & { onPrev: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleGenerateBiblio = async () => {
    setLoading(true);
    try {
      const bibliography = await generateBibliography(project);
      setProject({ bibliography });
      showToast('Bibliographie générée.', 'success');
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error), 'error');
    }
    setLoading(false);
  };

  const handleExportFullProject = () => {
    let content = `<h1>Projet de Recherche : ${project.subject || 'Sans titre'}</h1>`;

    if (project.literatureReview) {
      const review = project.literatureReview;
      content += '<h2>Revue de Littérature</h2>';
      content += `<h3>Concepts Clés</h3><ul>${listItems(review.keywords)}</ul>`;
      content += `<h3>Théories</h3><ul>${listItems(review.theories)}</ul>`;
      content += `<h3>Auteurs</h3><ul>${listItems(review.authors)}</ul>`;
      content += `<h3>Résumé</h3><p>${review.summary}</p>`;
    }

    content += '<h2>Cadrage de la Recherche</h2>';
    content += `<h3>Cycle</h3><p>${project.cycle}</p>`;
    content += `<h3>Contexte</h3><p>${project.context}</p>`;
    content += `<h3>Hypothèses</h3><ul>${listItems(project.hypotheses)}</ul>`;
    content += `<h3>Questions de recherche</h3><ul>${listItems(project.questions)}</ul>`;
    content += `<h3>Objectif Général</h3><p>${project.objectives.general}</p>`;
    content += `<h3>Objectifs Spécifiques</h3><ul>${listItems(project.objectives.specific)}</ul>`;

    const toolEntries = Object.entries(project.tools);
    if (toolEntries.length > 0) {
      content += '<h2>Outils de Collecte</h2>';
      for (const [id, toolContent] of toolEntries) {
        content += `<h3>Outil : ${id}</h3>`;
        content += `<div>${markdownToHtml(toolContent)}</div>`;
      }
    }

    if (project.analyses.length > 0) {
      content += '<h2>Analyses</h2>';
      for (const analysis of project.analyses) {
        content += `<h3>${analysis.title}</h3>`;
        content += `<div>${markdownToHtml(analysis.content)}</div>`;
      }
    }

    const bibliography = project.bibliography ?? [];
    if (bibliography.length > 0) {
      content += '<h2>Bibliographie (Norme APA)</h2>';
      content += `<ul>${bibliography.map(entry => `<li>${entry.citation}</li>`).join('')}</ul>`;
    }

    exportToWord(
      content,
      `Projet_Complet_${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
    );
    showToast('Document Word généré.', 'success');
  };

  const bibliography = project.bibliography ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <FileText size={20} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">
            Exportation Globale & Bibliographie
          </h2>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <Book size={40} className="mb-4 text-slate-400" aria-hidden="true" />
            <h3 className="mb-2 font-semibold text-slate-800">Générateur de Bibliographie</h3>
            <p className="mb-6 text-sm text-slate-600">
              Générez automatiquement une liste de références au format APA basée sur votre sujet et
              votre revue de littérature.
            </p>
            <button
              onClick={() => void handleGenerateBiblio()}
              disabled={loading || !project.subject}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <Book size={18} aria-hidden="true" />
              )}
              Générer la Bibliographie
            </button>
          </div>

          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <Download size={40} className="mb-4 text-slate-400" aria-hidden="true" />
            <h3 className="mb-2 font-semibold text-slate-800">Export Global (Word)</h3>
            <p className="mb-6 text-sm text-slate-600">
              Compilez l'ensemble de votre projet (cadrage, outils, analyses, bibliographie) dans un
              document Word modifiable.
            </p>
            <button
              onClick={handleExportFullProject}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-2.5 font-medium text-white transition-colors hover:bg-slate-900"
            >
              <FileText size={18} aria-hidden="true" />
              Exporter tout le projet
            </button>
          </div>
        </div>

        {bibliography.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-slate-200 pt-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Bibliographie (Norme APA)</h3>
              <button
                onClick={() => window.print()}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 print:hidden"
                title="Imprimer"
                aria-label="Imprimer la bibliographie"
              >
                <Printer size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <ul className="space-y-4">
                {bibliography.map((entry, index) => (
                  <li
                    key={entry.id || index}
                    className="pl-4 -indent-4 text-sm leading-relaxed text-slate-700"
                  >
                    {entry.citation}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </motion.div>

      <div className="flex justify-start pt-4 print:hidden">
        <button
          onClick={onPrev}
          className="flex w-full transform items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-600 transition-colors duration-200 hover:scale-105 hover:bg-slate-50 sm:w-auto"
        >
          <ArrowLeft size={20} aria-hidden="true" /> Retour à l'Analyse
        </button>
      </div>
    </div>
  );
}
