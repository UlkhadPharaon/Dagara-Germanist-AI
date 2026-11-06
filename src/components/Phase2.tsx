import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { ProjectData } from '../types';
import { generateTool, improveTool, extractTextFromFile } from '../lib/api';
import { exportToWord } from '../lib/export';
import { Loader2, FileText, Check, ArrowLeft, ArrowRight, Printer, Download, Settings, Edit3, Save, Wand2, Upload, UploadCloud } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { showToast } from '../lib/toast';

const TOOLS = [
  { id: 'enseignants', label: 'Questionnaire Enseignants' },
  { id: 'eleves', label: 'Questionnaire Élèves' },
  { id: 'inspecteurs', label: 'Questionnaire Inspecteurs' },
  { id: 'grille', label: "Grille d'Analyse de Manuel" }
];

export default function Phase2({ project, setProject, onNext, onPrev }: { project: ProjectData, setProject: any, onNext: () => void, onPrev: () => void }) {
  const [manualName, setManualName] = useState('');
  const [toolStyles, setToolStyles] = useState<Record<string, string>>({});
  const [toolInstructions, setToolInstructions] = useState<Record<string, string>>({});
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  
  // Edit & Improve states
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [improveInstruction, setImproveInstruction] = useState('');
  const [isImproving, setIsImproving] = useState(false);

  const handleGenerate = async (toolId: string) => {
    setLoading(toolId);
    setActiveTab(toolId);
    try {
      const toolLabel = TOOLS.find(t => t.id === toolId)?.label || toolId;
      const style = toolStyles[toolId] || 'Standard / Neutre';
      const instructions = toolInstructions[toolId] || '';
      const res = await generateTool(project, toolLabel, toolId === 'grille' ? manualName : undefined, style, instructions);
      setProject({ ...project, tools: { ...project.tools, [toolId]: res } });
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erreur lors de la génération", "error");
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
      setEditContent(project.tools[activeTab] || '');
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (activeTab) {
      setProject({ ...project, tools: { ...project.tools, [activeTab]: editContent } });
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
      const toolLabel = TOOLS.find(t => t.id === activeTab)?.label || activeTab;
      const res = await improveTool(project, toolLabel, project.tools[activeTab], improveInstruction);
      setProject({ ...project, tools: { ...project.tools, [activeTab]: res } });
      setImproveInstruction('');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erreur lors de l'amélioration de l'outil", "error");
    }
    setIsImproving(false);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(activeTab); // Use loading state to show spinner
    try {
      const extractedText = await extractTextFromFile(file);
      setEditContent(extractedText);
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Erreur lors de l'extraction du texte du fichier.", "error");
    }
    setLoading(null);
    e.target.value = ''; // Reset input
  };

  if (!project.subject || !project.hypotheses || project.hypotheses.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-12 text-center text-slate-500"
      >
        <FileText size={48} className="mx-auto mb-4 opacity-20" />
        <p className="text-lg">Veuillez d'abord valider la Phase 1 (Cadrage) pour générer des outils pertinents.</p>
      </motion.div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="lg:col-span-1 space-y-6 print:hidden"
      >
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Outils à générer</h2>
          
          <div className="space-y-3">
            {TOOLS?.map(tool => {
              const isGenerating = loading === tool.id;
              const isGenerated = !!project.tools[tool.id];
              const isExpanded = expandedConfig === tool.id;
              
              return (
                <div 
                  key={tool.id} 
                  className={`border rounded-xl p-4 flex flex-col gap-3 transition-all duration-300 relative overflow-hidden ${
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
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  <div className="flex items-center justify-between relative z-10">
                    <span className={`font-medium ${isGenerating ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {tool.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {isGenerated && !isGenerating && (
                        <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                          <Check size={14} /> Prêt
                        </div>
                      )}
                      {isGenerating && <Loader2 size={18} className="text-emerald-500 animate-spin" />}
                      <button 
                        onClick={() => setExpandedConfig(isExpanded ? null : tool.id)}
                        className={`p-1.5 rounded-md transition-colors ${isExpanded ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
                        title="Configurer l'approche"
                      >
                        <Settings size={16} />
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
                        <div className="pt-2 pb-1 space-y-3 border-t border-slate-100 mt-1">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Approche / Biais psychologique</label>
                            <select 
                              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                              value={toolStyles[tool.id] || 'Standard / Neutre'}
                              onChange={e => setToolStyles({...toolStyles, [tool.id]: e.target.value})}
                              disabled={isGenerating}
                            >
                              <option value="Standard / Neutre">Standard / Neutre</option>
                              <option value="Contournement de la désirabilité sociale">Contournement de la désirabilité sociale</option>
                              <option value="Approche projective (Mises en situation)">Approche projective (Mises en situation)</option>
                              <option value="Focalisation sur les biais cognitifs">Focalisation sur les biais cognitifs</option>
                              <option value="Entretien compréhensif (profondeur)">Entretien compréhensif (profondeur)</option>
                              <option value="Échelle de Likert orientée">Échelle de Likert orientée</option>
                              <option value="Pédagogie différenciée">Pédagogie différenciée</option>
                              <option value="Approche socio-constructiviste">Approche socio-constructiviste</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Directives personnalisées</label>
                            <textarea 
                              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none text-xs min-h-[60px]"
                              placeholder="Ex: Ajoute des questions spécifiques sur..."
                              value={toolInstructions[tool.id] || ''}
                              onChange={e => setToolInstructions({...toolInstructions, [tool.id]: e.target.value})}
                              disabled={isGenerating}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {tool.id === 'grille' && (
                    <input 
                      type="text" 
                      placeholder="Nom du manuel (ex: Ihr und Wir)" 
                      value={manualName} 
                      onChange={e => setManualName(e.target.value)} 
                      disabled={isGenerating}
                      className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-emerald-500 disabled:opacity-50 disabled:bg-slate-50" 
                    />
                  )}
                  
                  <button 
                    onClick={() => handleGenerate(tool.id)} 
                    disabled={loading !== null} 
                    className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors relative z-10 ${
                      isGenerating 
                        ? 'bg-emerald-100 text-emerald-700 cursor-wait animate-pulse' 
                        : isGenerated 
                          ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200' 
                          : 'bg-slate-800 hover:bg-slate-900 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Génération...
                      </>
                    ) : isGenerated ? (
                      'Régénérer l\'outil'
                    ) : (
                      'Générer l\'outil'
                    )}
                  </button>
                  
                  {!isGenerated && !isGenerating && (
                    <button 
                      onClick={() => handleImport(tool.id)}
                      className="w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <Upload size={16} /> Importer / Saisir
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
        {(project.tools && Object.keys(project.tools).length > 0) || loading || isEditing ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[800px] print:h-auto print:border-none print:shadow-none">
            <div className="flex border-b border-slate-200 overflow-x-auto print:hidden">
              {TOOLS?.filter(t => project.tools[t.id] || loading === t.id || (isEditing && activeTab === t.id)).map(tool => (
                <button key={tool.id} onClick={() => setActiveTab(tool.id)} className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tool.id ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                  {tool.label}
                </button>
              ))}
              <div className="flex-1"></div>
              {activeTab && !loading && (project.tools[activeTab] || isEditing) && (
                <div className="flex items-center gap-1 pr-4">
                  {isEditing ? (
                    <button onClick={handleSaveEdit} className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1">
                      <Save size={16} /> Enregistrer
                    </button>
                  ) : (
                    <button onClick={handleStartEdit} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Éditer l'outil">
                      <Edit3 size={18} />
                    </button>
                  )}
                  <div className="w-px h-6 bg-slate-200 mx-1"></div>
                  <button onClick={() => window.print()} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Imprimer / PDF">
                    <Printer size={18} />
                  </button>
                  <button onClick={handleExportWord} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Télécharger Word">
                    <Download size={18} />
                  </button>
                </div>
              )}
            </div>
            <div className="p-8 overflow-y-auto flex-1 bg-slate-50/50 print:bg-white print:p-0" id={`tool-content-${activeTab}`}>
              {loading === activeTab || isImproving ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6 animate-in fade-in duration-500 p-8">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-2 shadow-inner"
                  >
                    <Loader2 size={32} className="text-emerald-600" />
                  </motion.div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold text-slate-800">
                      {isImproving ? "Amélioration de l'outil..." : `Génération de ${TOOLS.find(t => t.id === activeTab)?.label}...`}
                    </h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                      {isImproving ? "L'IA applique vos modifications..." : "L'IA analyse votre cadrage et conçoit les questions les plus pertinentes selon l'approche psychologique choisie."}
                    </p>
                  </div>
                  
                  {/* Skeleton Loader */}
                  <div className="w-full max-w-2xl bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4 mt-8">
                    <div className="h-6 bg-slate-200 rounded-md w-1/3 animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-100 rounded-md w-full animate-pulse" style={{ animationDelay: '100ms' }}></div>
                      <div className="h-4 bg-slate-100 rounded-md w-5/6 animate-pulse" style={{ animationDelay: '150ms' }}></div>
                      <div className="h-4 bg-slate-100 rounded-md w-4/6 animate-pulse" style={{ animationDelay: '200ms' }}></div>
                    </div>
                    <div className="h-5 bg-slate-200 rounded-md w-1/4 animate-pulse mt-6"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-100 rounded-md w-full animate-pulse" style={{ animationDelay: '250ms' }}></div>
                      <div className="h-4 bg-slate-100 rounded-md w-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              ) : activeTab && (project.tools[activeTab] || isEditing) ? (
                <div className="h-full flex flex-col animate-in fade-in duration-300">
                  {isEditing ? (
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="flex justify-between items-center bg-slate-100 p-3 rounded-xl border border-slate-200">
                        <span className="text-sm font-medium text-slate-700">Édition manuelle</span>
                        <label className="cursor-pointer flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200">
                          <UploadCloud size={16} />
                          Importer un fichier (PDF/Word)
                          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={handleFileUpload} />
                        </label>
                      </div>
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        placeholder="Collez ou rédigez votre outil ici (supporte le format Markdown)..."
                        className="w-full flex-1 p-4 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm resize-none"
                      />
                    </div>
                  ) : (
                    <div className="prose prose-slate max-w-none prose-headings:text-emerald-800 prose-a:text-emerald-600 flex-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{project.tools[activeTab]}</ReactMarkdown>
                    </div>
                  )}
                  
                  {!isEditing && project.tools[activeTab] && (
                    <div className="mt-8 pt-6 border-t border-slate-200 print:hidden">
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Wand2 size={16} className="text-emerald-600" /> 
                        Demander une modification à l'IA
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={improveInstruction}
                          onChange={e => setImproveInstruction(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleImprove()}
                          placeholder="Ex: Rends les questions plus ouvertes, ajoute une section sur..."
                          className="flex-1 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        />
                        <button 
                          onClick={handleImprove}
                          disabled={!improveInstruction.trim() || isImproving}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
          <div className="h-full border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 p-12 text-center">
            Sélectionnez un outil à générer dans le panneau de gauche. L'IA concevra un questionnaire ou une grille sur mesure basé sur votre cadrage.
          </div>
        )}
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="lg:col-span-3 flex flex-col-reverse sm:flex-row justify-between items-center gap-4 mt-4 pt-6 border-t border-slate-200 print:hidden"
      >
        <button onClick={onPrev} className="w-full sm:w-auto text-slate-600 bg-white border border-slate-200 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 hover:scale-105 transform duration-200">
          <ArrowLeft size={20} /> Retour au Cadrage
        </button>
        <button onClick={onNext} className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 hover:scale-105 transform duration-200">
          Étape suivante : Analyse <ArrowRight size={20} />
        </button>
      </motion.div>
    </div>
  );
}
