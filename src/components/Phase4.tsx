import { useState } from 'react';
import { ProjectData } from '../types';
import { generateBibliography } from '../lib/api';
import { Loader2, Book, Download, ArrowLeft, FileText, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { exportToWord } from '../lib/export';
import { showToast } from '../lib/toast';

export default function Phase4({ project, setProject, onPrev }: { project: ProjectData, setProject: any, onPrev: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleGenerateBiblio = async () => {
    setLoading(true);
    try {
      const res = await generateBibliography(project);
      setProject({ ...project, bibliography: res });
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erreur lors de la génération de la bibliographie.", "error");
    }
    setLoading(false);
  };

  const handleExportFullProject = () => {
    let content = `<h1>Projet de Recherche : ${project.subject || 'Sans titre'}</h1>`;
    
    // Phase 0
    if (project.literatureReview) {
      content += `<h2>Revue de Littérature</h2>`;
      content += `<h3>Concepts Clés</h3><ul>${Array.isArray(project.literatureReview.keywords) ? project.literatureReview.keywords.map(k => `<li>${k}</li>`).join('') : ''}</ul>`;
      content += `<h3>Théories</h3><ul>${Array.isArray(project.literatureReview.theories) ? project.literatureReview.theories.map(t => `<li>${t}</li>`).join('') : ''}</ul>`;
      content += `<h3>Auteurs</h3><ul>${Array.isArray(project.literatureReview.authors) ? project.literatureReview.authors.map(a => `<li>${a}</li>`).join('') : ''}</ul>`;
      content += `<h3>Résumé</h3><p>${project.literatureReview.summary || ''}</p>`;
    }

    // Phase 1
    content += `<h2>Cadrage de la Recherche</h2>`;
    content += `<h3>Cycle</h3><p>${project.cycle || ''}</p>`;
    content += `<h3>Contexte</h3><p>${project.context || ''}</p>`;
    content += `<h3>Hypothèses</h3><ul>${project.hypotheses?.map(h => `<li>${h}</li>`).join('') || ''}</ul>`;
    content += `<h3>Questions de recherche</h3><ul>${project.questions?.map(q => `<li>${q}</li>`).join('') || ''}</ul>`;
    content += `<h3>Objectif Général</h3><p>${project.objectives?.general || ''}</p>`;
    content += `<h3>Objectifs Spécifiques</h3><ul>${project.objectives?.specific?.map(o => `<li>${o}</li>`).join('') || ''}</ul>`;

    // Phase 2
    if (project.tools && Object.keys(project.tools).length > 0) {
      content += `<h2>Outils de Collecte</h2>`;
      Object.entries(project.tools).forEach(([id, toolContent]) => {
        content += `<h3>Outil : ${id}</h3>`;
        // Convert Markdown to HTML roughly for Word export
        let htmlTool = toolContent
          .replace(/^### (.*$)/gim, '<h4>$1</h4>')
          .replace(/^## (.*$)/gim, '<h3>$1</h3>')
          .replace(/^# (.*$)/gim, '<h2>$1</h2>')
          .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
          .replace(/\*(.*)\*/gim, '<em>$1</em>')
          .replace(/\n/gim, '<br>');
        content += `<div>${htmlTool}</div>`;
      });
    }

    // Phase 3
    if (project.analyses?.length > 0) {
      content += `<h2>Analyses</h2>`;
      project.analyses.forEach(analysis => {
        content += `<h3>${analysis.title}</h3>`;
        let htmlAnalysis = analysis.content
          .replace(/^### (.*$)/gim, '<h4>$1</h4>')
          .replace(/^## (.*$)/gim, '<h3>$1</h3>')
          .replace(/^# (.*$)/gim, '<h2>$1</h2>')
          .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
          .replace(/\*(.*)\*/gim, '<em>$1</em>')
          .replace(/\n/gim, '<br>');
        content += `<div>${htmlAnalysis}</div>`;
      });
    }

    // Phase 4
    if (project.bibliography && Array.isArray(project.bibliography) && project.bibliography.length > 0) {
      content += `<h2>Bibliographie (Norme APA)</h2>`;
      content += `<ul>${project.bibliography.map(b => `<li>${b.citation}</li>`).join('')}</ul>`;
    }

    exportToWord(content, `Projet_Complet_${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
            <FileText size={20} />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">Exportation Globale & Bibliographie</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 flex flex-col items-center text-center">
            <Book size={40} className="text-slate-400 mb-4" />
            <h3 className="font-semibold text-slate-800 mb-2">Générateur de Bibliographie</h3>
            <p className="text-sm text-slate-600 mb-6">
              Générez automatiquement une liste de références au format APA basée sur votre sujet et votre revue de littérature.
            </p>
            <button 
              onClick={handleGenerateBiblio} 
              disabled={loading || !project.subject} 
              className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-orange-700 transition-colors flex items-center gap-2 disabled:opacity-50 w-full justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Book size={18} />}
              Générer la Bibliographie
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 flex flex-col items-center text-center">
            <Download size={40} className="text-slate-400 mb-4" />
            <h3 className="font-semibold text-slate-800 mb-2">Export Global (Word)</h3>
            <p className="text-sm text-slate-600 mb-6">
              Compilez l'ensemble de votre projet (cadrage, outils, analyses, bibliographie) dans un document Word modifiable.
            </p>
            <button 
              onClick={handleExportFullProject} 
              className="bg-slate-800 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-900 transition-colors flex items-center gap-2 w-full justify-center"
            >
              <FileText size={18} />
              Exporter tout le projet
            </button>
          </div>
        </div>

        {project.bibliography && project.bibliography.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-slate-200 pt-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Bibliographie (Norme APA)</h3>
              <button onClick={() => window.print()} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors print:hidden" title="Imprimer">
                <Printer size={18} />
              </button>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <ul className="space-y-4">
                {Array.isArray(project.bibliography) && project.bibliography.map((entry, i) => (
                  <li key={i} className="text-sm text-slate-700 pl-4 -indent-4 leading-relaxed">
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
          className="w-full sm:w-auto text-slate-600 bg-white border border-slate-200 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 hover:scale-105 transform duration-200"
        >
          <ArrowLeft size={20} /> Retour à l'Analyse
        </button>
      </div>
    </div>
  );
}
