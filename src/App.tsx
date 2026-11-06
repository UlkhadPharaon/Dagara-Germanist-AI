import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { ProjectData, HistoryLog } from './types';
import Phase0 from './components/Phase0';
import Phase1 from './components/Phase1';
import Phase2 from './components/Phase2';
import Phase3 from './components/Phase3';
import Phase4 from './components/Phase4';
import Chatbot from './components/Chatbot';
import QuickOverview from './components/QuickOverview';
import HistoryTab from './components/HistoryTab';
import { LayoutDashboard, BookOpen, ClipboardList, BarChart3, Menu, X, Check, Plus, Trash2, ArrowUpDown, Search, FileText, Download, Upload, Cloud, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const createNewProject = (): ProjectData => ({
  id: Date.now().toString(),
  name: 'Nouveau Projet',
  lastModified: Date.now(),
  subject: '',
  cycle: '1er cycle (6ème-3ème)',
  context: '',
  hypotheses: [],
  questions: [],
  objectives: { general: '', specific: [] },
  tools: {},
  analyses: []
});

import { showToast } from './lib/toast';

export default function App() {
  const [projects, setProjects] = useState<ProjectData[]>(() => {
    let saved = localStorage.getItem('dagara-projects');
    if (!saved) {
      saved = localStorage.getItem('fara-projects');
      if (saved) localStorage.setItem('dagara-projects', saved);
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [createNewProject()];
  });
  
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>(() => {
    let saved = localStorage.getItem('dagara-history');
    if (!saved) {
      saved = localStorage.getItem('fara-history');
      if (saved) localStorage.setItem('dagara-history', saved);
    }
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [currentProjectId, setCurrentProjectId] = useState<string>(projects[0].id);
  const [activeTab, setActiveTab] = useState('phase0');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'>('date-desc');
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [aiModel, setAiModel] = useState<string>(() => {
    let saved = localStorage.getItem('dagara-ai-model');
    if (!saved) {
      saved = localStorage.getItem('fara-ai-model');
      if (saved) localStorage.setItem('dagara-ai-model', saved);
    }
    return saved || 'meta/llama-3.1-70b-instruct';
  });

  const [toast, setToast] = useState<{message: string, type: 'error' | 'success' | 'info'} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{message: string, onConfirm: () => void} | null>(null);

  useEffect(() => {
    const handleToast = (e: any) => {
      setToast(e.detail);
      setTimeout(() => setToast(null), 5000);
    };
    window.addEventListener('app-toast', handleToast);
    return () => window.removeEventListener('app-toast', handleToast);
  }, []);

  useEffect(() => {
    // Simulate a brief loading state for the splash screen
    const timer = setTimeout(() => {
      setIsAppLoading(false);
      setShowOverview(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleCloseOverview = () => {
    setShowOverview(false);
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setAiModel(newModel);
    localStorage.setItem('dagara-ai-model', newModel);
  };

  useEffect(() => {
    localStorage.setItem('dagara-projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('dagara-history', JSON.stringify(historyLogs));
  }, [historyLogs]);

  const addLog = (action: HistoryLog['action'], details: string, projectId?: string, projectName?: string) => {
    const newLog: HistoryLog = {
      id: Date.now().toString(),
      action,
      details,
      timestamp: Date.now(),
      projectId,
      projectName
    };
    setHistoryLogs(prev => [newLog, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  const project = projects.find(p => p.id === currentProjectId) || projects[0];

  const setProject = (updatedData: Partial<ProjectData>) => {
    setSaveStatus('saving');
    setProjects(prev => prev.map(p => 
      p.id === currentProjectId 
        ? { ...p, ...updatedData, lastModified: Date.now() } 
        : p
    ));
    setTimeout(() => setSaveStatus('saved'), 1000);
    
    // Only log significant updates, not every keystroke
    if (updatedData.name || updatedData.subject || updatedData.cycle) {
      addLog('update', `Mise à jour du projet`, currentProjectId, updatedData.name || project.name);
    }
  };

  const handleNewProject = () => {
    const newProj = createNewProject();
    setProjects([newProj, ...projects]);
    setCurrentProjectId(newProj.id);
    setActiveTab('phase0');
    setIsSidebarOpen(false);
    addLog('create', 'Nouveau projet créé', newProj.id, newProj.name);
  };

  const handleExportProjects = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `dagara-germanist-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addLog('export', `Exportation de ${projects.length} projets`);
  };

  const handleImportProjects = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(projects.map(p => p.id));
          const newProjects = parsed.filter(p => !existingIds.has(p.id));
          
          if (newProjects.length > 0) {
            setProjects(prev => [...newProjects, ...prev]);
            showToast(`${newProjects.length} projet(s) importé(s) avec succès.`, "success");
            addLog('import', `Importation de ${newProjects.length} projets depuis ${file.name}`);
          } else {
            showToast("Les projets de ce fichier existent déjà dans l'application.", "info");
          }
        } else {
          showToast("Format de fichier invalide.", "error");
        }
      } catch (err) {
        showToast("Erreur lors de l'importation du fichier.", "error");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleDeleteProject = (id: string, e: any) => {
    e.stopPropagation();
    const projectToDelete = projects.find(p => p.id === id);
    setConfirmDialog({
      message: "Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.",
      onConfirm: () => {
        if (projects.length === 1) {
          const newProj = createNewProject();
          setProjects([newProj]);
          setCurrentProjectId(newProj.id);
        } else {
          const newProjects = projects.filter(p => p.id !== id);
          setProjects(newProjects);
          if (currentProjectId === id) {
            setCurrentProjectId(newProjects[0].id);
          }
        }
        addLog('delete', 'Projet supprimé', id, projectToDelete?.name);
        setConfirmDialog(null);
      }
    });
  };

  const TABS = [
    { id: 'phase0', label: 'Phase 0: Revue', icon: Search, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'phase1', label: 'Phase 1: Cadrage', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'phase2', label: 'Phase 2: Outils', icon: ClipboardList, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'phase3', label: 'Phase 3: Analyse', icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'phase4', label: 'Phase 4: Export', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'history', label: 'Historique', icon: History, color: 'text-slate-600', bg: 'bg-slate-100' },
  ];

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortBy === 'date-desc') return b.lastModified - a.lastModified;
    if (sortBy === 'date-asc') return a.lastModified - b.lastModified;
    
    const nameA = (a.name || a.subject || 'Projet sans titre').toLowerCase();
    const nameB = (b.name || b.subject || 'Projet sans titre').toLowerCase();
    
    if (sortBy === 'name-asc') return nameA.localeCompare(nameB);
    if (sortBy === 'name-desc') return nameB.localeCompare(nameA);
    
    return 0;
  });

  if (isAppLoading) {
    return (
      <div className="h-screen w-screen bg-emerald-600 flex flex-col items-center justify-center text-white">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-xl mb-6">
            <LayoutDashboard size={40} />
          </div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-4xl font-bold tracking-tight mb-2 text-center"
          >
            Dagara Germanist AI
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-emerald-100 font-medium text-center"
          >
            for Inspector
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 flex flex-col print:hidden
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 leading-tight">Dagara Germanist AI</h1>
              <p className="text-xs text-slate-500">for Inspector</p>
            </div>
          </div>
          <button className="lg:hidden text-slate-400" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Workflows</div>
            {TABS.map((tab, i) => (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${activeTab === tab.id ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <div className={`p-2 rounded-lg ${activeTab === tab.id ? tab.bg : 'bg-slate-50'} ${tab.color}`}>
                  <tab.icon size={18} />
                </div>
                {tab.label}
              </motion.button>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mes Projets</div>
              <button onClick={handleNewProject} className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1 rounded-md transition-colors" title="Nouveau projet">
                <Plus size={16} />
              </button>
            </div>
            
            <div className="px-2 mb-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5">
                <ArrowUpDown size={14} className="text-slate-400 ml-1 shrink-0" />
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs bg-transparent border-none text-slate-600 outline-none flex-1 cursor-pointer"
                >
                  <option value="date-desc">Plus récents</option>
                  <option value="date-asc">Plus anciens</option>
                  <option value="name-asc">Nom (A-Z)</option>
                  <option value="name-desc">Nom (Z-A)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <AnimatePresence>
                {sortedProjects.map((p, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    key={p.id}
                    onClick={() => { setCurrentProjectId(p.id); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors cursor-pointer group ${currentProjectId === p.id ? 'bg-emerald-50 border border-emerald-100' : 'hover:bg-slate-50 border border-transparent'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${currentProjectId === p.id ? 'text-emerald-900 font-semibold' : 'text-slate-700 font-medium'}`}>
                        {p.name || p.subject || 'Projet sans titre'}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {new Date(p.lastModified).toLocaleDateString()}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteProject(p.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50"
                      title="Supprimer le projet"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
        
        {/* Backup Controls */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Sauvegarde & Restauration</div>
          <div className="flex gap-2">
            <button 
              onClick={handleExportProjects}
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 hover:text-emerald-600 transition-colors"
              title="Exporter tous les projets"
            >
              <Download size={14} /> Exporter
            </button>
            <label 
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              title="Importer des projets"
            >
              <Upload size={14} /> Importer
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportProjects} 
                className="hidden" 
              />
            </label>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 shrink-0 print:hidden">
          <button 
            className="lg:hidden p-2 mr-4 text-slate-500 hover:bg-slate-100 rounded-lg"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 hidden sm:flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-800 truncate">
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
            <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-500">
              {saveStatus === 'saving' ? (
                <>
                  <Cloud size={14} className="animate-pulse text-emerald-500" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span>Enregistré</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-1 sm:flex-none justify-end">
            <select
              value={aiModel}
              onChange={handleModelChange}
              className="hidden md:block text-sm font-medium text-slate-600 bg-slate-100 border-none rounded-lg px-2 sm:px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer shrink-0"
              title="Modèle d'Intelligence Artificielle"
            >
              <option value="meta/llama-3.1-70b-instruct">Llama 3.1 70B (Rapide)</option>
              <option value="meta/llama-3.1-8b-instruct">Llama 3.1 8B (Très Rapide)</option>
              <option value="mistralai/mistral-large-2-instruct">Mistral Large 2 (Puissant)</option>
              <option value="nvidia/llama-3.1-nemotron-70b-instruct">Nemotron 70B (Précis)</option>
            </select>
            <select
              value={project.language || 'fr'}
              onChange={e => setProject({ language: e.target.value as 'fr' | 'de' })}
              className="text-sm font-medium text-slate-600 bg-slate-100 border-none rounded-lg px-2 sm:px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer shrink-0"
              title="Langue de génération des outils"
            >
              <option value="fr">🇫🇷 FR</option>
              <option value="de">🇩🇪 DE</option>
            </select>
            <input 
              type="text" 
              value={project.name} 
              onChange={e => setProject({ name: e.target.value })}
              className="text-sm font-medium text-slate-600 bg-slate-100 border-none rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none w-full sm:w-48 max-w-[150px] sm:max-w-none"
              placeholder="Nom du projet..."
            />
          </div>
        </header>

        {/* Stepper */}
        {activeTab !== 'history' && (
          <div className="bg-white border-b border-slate-200 px-4 lg:px-8 py-6 shrink-0 print:hidden">
            <div className="max-w-3xl mx-auto flex items-center justify-between relative">
              <motion.div 
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 z-0 origin-left"
              ></motion.div>
              {TABS?.filter(t => t.id !== 'history').map((tab, index) => {
                const currentIndex = TABS.findIndex(t => t.id === activeTab);
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                    key={tab.id} 
                    className="relative z-10 flex flex-col items-center gap-2 bg-white px-2"
                  >
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all duration-300 ${
                        isCurrent ? 'bg-emerald-600 border-emerald-600 text-white scale-110 shadow-md' :
                        isCompleted ? 'bg-emerald-100 border-emerald-500 text-emerald-600 hover:bg-emerald-200' :
                        'bg-white border-slate-300 text-slate-400 hover:border-slate-400'
                      }`}
                    >
                      {isCompleted ? <Check size={20} /> : index + 1}
                    </button>
                    <span className={`text-xs font-medium transition-colors duration-300 ${isCurrent ? 'text-emerald-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                      {tab.label.split(':')[1]?.trim() || tab.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="min-h-full"
            >
              {activeTab === 'phase0' && <Phase0 project={project} setProject={setProject} onNext={() => setActiveTab('phase1')} />}
              {activeTab === 'phase1' && <Phase1 project={project} setProject={setProject} onNext={() => setActiveTab('phase2')} onPrev={() => setActiveTab('phase0')} />}
              {activeTab === 'phase2' && <Phase2 project={project} setProject={setProject} onNext={() => setActiveTab('phase3')} onPrev={() => setActiveTab('phase1')} />}
              {activeTab === 'phase3' && <Phase3 project={project} setProject={setProject} onNext={() => setActiveTab('phase4')} onPrev={() => setActiveTab('phase2')} />}
              {activeTab === 'phase4' && <Phase4 project={project} setProject={setProject} onPrev={() => setActiveTab('phase3')} />}
              {activeTab === 'history' && <HistoryTab logs={historyLogs} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      
      {/* Contextual Chatbot */}
      <Chatbot project={project} />

      {/* Quick Overview Modal */}
      <AnimatePresence>
        {showOverview && <QuickOverview onClose={handleCloseOverview} />}
      </AnimatePresence>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-xl text-white z-50 max-w-md flex items-start gap-3 ${
              toast.type === 'error' ? 'bg-red-600' : 
              toast.type === 'success' ? 'bg-emerald-600' : 
              'bg-blue-600'
            }`}
          >
            {toast.type === 'error' && <X size={20} className="mt-0.5 shrink-0" />}
            {toast.type === 'success' && <Check size={20} className="mt-0.5 shrink-0" />}
            {toast.type === 'info' && <div className="w-5 h-5 shrink-0" />}
            <p className="text-sm font-medium leading-relaxed">{toast.message}</p>
            <button onClick={() => setToast(null)} className="p-1 hover:bg-white/20 rounded-md transition-colors ml-auto shrink-0">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            >
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Confirmation</h3>
              <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium"
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
