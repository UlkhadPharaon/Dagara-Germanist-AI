import { useState } from 'react';
import { ProjectData } from '../types';
import { generateLiteratureReview } from '../lib/api';
import { Loader2, Search, ArrowRight, BookOpen, User, Lightbulb } from 'lucide-react';
import { motion } from 'motion/react';
import { showToast } from '../lib/toast';

export default function Phase0({ project, setProject, onNext }: { project: ProjectData, setProject: any, onNext: () => void }) {
  const [keywords, setKeywords] = useState(Array.isArray(project.literatureReview?.keywords) ? project.literatureReview.keywords.join(', ') : '');
  const [context, setContext] = useState(project.context || '');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!keywords.trim()) return showToast("Veuillez entrer au moins un mot-clé.", "error");
    setLoading(true);
    try {
      const res = await generateLiteratureReview(keywords, context);
      setProject({ 
        ...project, 
        context,
        literatureReview: res 
      });
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erreur lors de la génération de la revue de littérature.", "error");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Search size={20} />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">Phase 0 : Assistant de Revue de Littérature</h2>
        </div>
        
        <p className="text-slate-600 mb-6 text-sm">
          Avant de définir votre problématique, explorez les concepts clés et les théories didactiques pertinentes pour votre sujet.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mots-clés de votre recherche</label>
            <input 
              type="text" 
              value={keywords} 
              onChange={e => setKeywords(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="Ex: motivation, numérique, expression orale, classes pléthoriques..." 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contexte spécifique (Optionnel)</label>
            <input 
              type="text" 
              value={context} 
              onChange={e => setContext(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="Ex: Enseignement au Burkina Faso, zone rurale..." 
            />
          </div>
          <button 
            onClick={handleGenerate} 
            disabled={loading || !keywords} 
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            Explorer la littérature
          </button>
        </div>
      </motion.div>

      {project.literatureReview && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-medium text-slate-800 mb-4 flex items-center gap-2">
                <Lightbulb size={18} className="text-amber-500"/> Concepts Clés
              </h3>
              <ul className="space-y-2">
                {Array.isArray(project.literatureReview.keywords) && project.literatureReview.keywords.map((kw, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-amber-500 mt-0.5">•</span> {kw}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-medium text-slate-800 mb-4 flex items-center gap-2">
                <BookOpen size={18} className="text-blue-500"/> Théories Didactiques
              </h3>
              <ul className="space-y-2">
                {Array.isArray(project.literatureReview.theories) && project.literatureReview.theories.map((th, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-blue-500 mt-0.5">•</span> {th}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-medium text-slate-800 mb-4 flex items-center gap-2">
              <User size={18} className="text-emerald-500"/> Auteurs de Référence
            </h3>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(project.literatureReview.authors) && project.literatureReview.authors.map((author, i) => (
                <span key={i} className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium border border-emerald-100">
                  {author}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-medium text-slate-800 mb-2">Résumé de la problématique potentielle</h3>
            <p className="text-slate-700 text-sm leading-relaxed">{project.literatureReview.summary}</p>
          </div>

          <div className="flex justify-end pt-4">
            <button 
              onClick={onNext} 
              className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 hover:scale-105 transform duration-200"
            >
              Passer au Cadrage (Phase 1) <ArrowRight size={20} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
