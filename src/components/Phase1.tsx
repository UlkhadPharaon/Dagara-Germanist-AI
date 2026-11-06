import { useState } from 'react';
import { ProjectData } from '../types';
import { generateCadrage, refineArchitecturePart } from '../lib/api';
import { exportToWord } from '../lib/export';
import { Loader2, CheckCircle, Edit3, ArrowRight, Printer, Download, Wand2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { showToast } from '../lib/toast';

export default function Phase1({ project, setProject, onNext, onPrev }: { project: ProjectData, setProject: any, onNext: () => void, onPrev: () => void }) {
  const [loading, setLoading] = useState(false);
  const [refiningPart, setRefiningPart] = useState<'hypotheses' | 'questions' | 'objectives' | null>(null);
  const [refineInstructions, setRefineInstructions] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [subject, setSubject] = useState(project.subject);
  const [cycle, setCycle] = useState(project.cycle || '1er cycle (6ème-3ème)');
  const [context, setContext] = useState(project.context);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateCadrage(subject, cycle, context);
      setProject({ ...project, subject, cycle, context, hypotheses: res.hypotheses, questions: res.questions, objectives: res.objectives });
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erreur lors de la génération", "error");
    }
    setLoading(false);
  };

  const handleExportWord = () => {
    const content = `
      <h1>Architecture de Recherche</h1>
      <h2>Sujet</h2><p>${project.subject}</p>
      <h2>Cycle</h2><p>${project.cycle}</p>
      <h2>Contexte</h2><p>${project.context}</p>
      <h2>Hypothèses</h2><ul>${Array.isArray(project.hypotheses) ? project.hypotheses.map(h => `<li>${h}</li>`).join('') : ''}</ul>
      <h2>Questions de recherche</h2><ul>${Array.isArray(project.questions) ? project.questions.map(q => `<li>${q}</li>`).join('') : ''}</ul>
      <h2>Objectif Général</h2><p>${project.objectives?.general || ''}</p>
      <h2>Objectifs Spécifiques</h2><ul>${Array.isArray(project.objectives?.specific) ? project.objectives.specific.map(o => `<li>${o}</li>`).join('') : ''}</ul>
    `;
    exportToWord(content, 'Cadrage_Recherche');
  };

  const handleRefine = async (part: 'hypotheses' | 'questions' | 'objectives') => {
    if (!refineInstructions.trim()) return;
    setIsRefining(true);
    try {
      const result = await refineArchitecturePart(project, part, refineInstructions);
      setProject({ ...project, [part]: result });
      setRefiningPart(null);
      setRefineInstructions('');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erreur lors du recadrage.", "error");
    }
    setIsRefining(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden"
      >
        <h2 className="text-xl font-semibold text-slate-800 mb-4">1. Définition du Sujet</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sujet ou Thème de recherche</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ex: L'impact des supports numériques sur la motivation..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cycle concerné</label>
              <select value={cycle} onChange={e => setCycle(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none">
                <option>1er cycle (6ème-3ème)</option>
                <option>Second cycle (2nde-Tle)</option>
                <option>Les deux</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contexte spécifique (Optionnel)</label>
              <input type="text" value={context} onChange={e => setContext(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ex: Zone rurale, classes pléthoriques..." />
            </div>
          </div>
          <button onClick={handleGenerate} disabled={loading || !subject} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
            Générer l'Architecture de Recherche
          </button>
        </div>
      </motion.div>

      {project.hypotheses?.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800">2. Architecture Générée</h2>
            <div className="flex items-center gap-2 print:hidden">
              <button onClick={() => window.print()} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Imprimer / PDF">
                <Printer size={20} />
              </button>
              <button onClick={handleExportWord} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Télécharger Word">
                <Download size={20} />
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-slate-800 mb-2 flex items-center gap-2"><Edit3 size={18} className="text-emerald-600"/> Hypothèses</h3>
            <textarea className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 min-h-[100px]" value={project.hypotheses.join('\n')} onChange={e => setProject({...project, hypotheses: e.target.value.split('\n')})} />
          </div>

          <div>
            <h3 className="text-lg font-medium text-slate-800 mb-2 flex items-center gap-2"><Edit3 size={18} className="text-emerald-600"/> Questions de recherche</h3>
            <textarea className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 min-h-[100px]" value={project.questions.join('\n')} onChange={e => setProject({...project, questions: e.target.value.split('\n')})} />
          </div>

          <div>
            <h3 className="text-lg font-medium text-slate-800 mb-2 flex items-center gap-2"><Edit3 size={18} className="text-emerald-600"/> Objectifs</h3>
            <div className="space-y-3">
              <textarea className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50" value={project.objectives.general} onChange={e => setProject({...project, objectives: {...project.objectives, general: e.target.value}})} placeholder="Objectif général" />
              <textarea className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 min-h-[100px]" value={project.objectives.specific.join('\n')} onChange={e => setProject({...project, objectives: {...project.objectives, specific: e.target.value.split('\n')}})} placeholder="Objectifs spécifiques" />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end print:hidden">
            <button onClick={onNext} className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 hover:scale-105 transform duration-200">
              Étape suivante : Outils <ArrowRight size={20} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
