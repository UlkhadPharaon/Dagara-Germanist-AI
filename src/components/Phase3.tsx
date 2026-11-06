import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { ProjectData, ChartData } from '../types';
import { analyzeData, ChartRequest } from '../lib/api';
import { exportToWord } from '../lib/export';
import { Loader2, UploadCloud, File, X, BarChart, ArrowLeft, ArrowRight, Printer, Download, PlusCircle, PieChart as PieChartIcon, BarChart2, Edit2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { BarChart as RechartsBarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { motion } from 'motion/react';
import { showToast } from '../lib/toast';

const COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

export default function Phase3({ project, setProject, onNext, onPrev }: { project: ProjectData, setProject: any, onNext: () => void, onPrev: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [analysisType, setAnalysisType] = useState('Synthèse statistique et qualitative');
  const [instructions, setInstructions] = useState('');
  const [chartRequests, setChartRequests] = useState<ChartRequest[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [editingChart, setEditingChart] = useState<{ analysisId: string, chartIndex: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const addChartRequest = () => {
    setChartRequests([...chartRequests, { id: Date.now().toString(), type: 'bar', description: '' }]);
  };

  const updateChartRequest = (id: string, field: keyof ChartRequest, value: string) => {
    setChartRequests(chartRequests.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeChartRequest = (id: string) => {
    setChartRequests(chartRequests.filter(c => c.id !== id));
  };

  const updateChart = (analysisId: string, chartIndex: number, updates: Partial<ChartData>) => {
    setProject({
      ...project,
      analyses: project.analyses.map(a => 
        a.id === analysisId 
          ? { ...a, charts: a.charts?.map((c, i) => i === chartIndex ? { ...c, ...updates } : c) }
          : a
      )
    });
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return showToast("Veuillez ajouter au moins un fichier.", "error");
    setLoading(true);
    try {
      const referenceToolContent = selectedToolId ? project.tools[selectedToolId] : undefined;
      const result = await analyzeData(project, files, analysisType, instructions, chartRequests, referenceToolContent);
      const newAnalysis = {
        id: Date.now().toString(),
        title: analysisType,
        content: result.content,
        charts: result.charts,
        date: new Date().toISOString()
      };
      setProject({ ...project, analyses: [newAnalysis, ...project.analyses] });
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erreur lors de l'analyse. Assurez-vous que les fichiers sont supportés (PDF, Images, Audio, Texte).", "error");
    }
    setLoading(false);
  };

  const handleExportPDF = async (analysisId: string, title: string) => {
    setExportingId(analysisId);
    try {
      const element = document.getElementById(`analysis-content-${analysisId}`);
      if (!element) return;

      // Capture de l'élément avec html-to-image
      const imgData = await toJpeg(element, {
        quality: 0.98,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });
      
      // Création du PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // On crée une image temporaire pour obtenir les dimensions réelles
      const img = new Image();
      img.src = imgData;
      await new Promise((resolve) => { img.onload = resolve; });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.height * pdfWidth) / img.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      let heightLeft = pdfHeight;
      let position = 0;

      // Ajout de la première page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Ajout des pages supplémentaires si le contenu est long
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      const filename = `Analyse_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      
      // Sauvegarde du fichier
      pdf.save(filename);
      
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de l'exportation en PDF. Alternative : utilisez le bouton Imprimer.", "error");
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="lg:col-span-1 space-y-6 print:hidden"
      >
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Données & Paramètres</h2>
          
          <div className="space-y-4">
            <label 
              className="block border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <UploadCloud size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600 font-medium">Cliquez pour importer des fichiers</p>
              <p className="text-xs text-slate-400 mt-1">PDF, Audio, Images, Texte</p>
              <input type="file" multiple className="hidden" onChange={handleFileChange} />
            </label>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <File size={16} className="text-emerald-600 shrink-0" />
                      <span className="text-xs text-slate-700 truncate">{file.name}</span>
                    </div>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type d'analyse</label>
              <select value={analysisType} onChange={e => setAnalysisType(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                <option>Synthèse statistique et qualitative</option>
                <option>Analyse Critique de Manuel</option>
                <option>Identification de tendances et blocages</option>
                <option>Autre (préciser dans les instructions)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Grille de référence (Optionnel)</label>
              <select 
                value={selectedToolId || ''} 
                onChange={e => setSelectedToolId(e.target.value || null)} 
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              >
                <option value="">Aucune (Analyse libre)</option>
                {Object.entries(project.tools).map(([id, content]) => (
                  <option key={id} value={id}>
                    Outil : {id}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">L'IA utilisera cet outil comme cadre pour évaluer les documents.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instructions spécifiques</label>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-h-[100px]" placeholder="Ex: Mets l'accent sur les réponses des enseignants concernant l'APC..." />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700">Graphiques souhaités</label>
                <button 
                  onClick={addChartRequest}
                  className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors"
                >
                  <PlusCircle size={14} /> Ajouter
                </button>
              </div>
              
              {chartRequests?.length === 0 ? (
                <p className="text-xs text-slate-500 italic">L'IA générera des graphiques automatiquement si pertinent. Vous pouvez aussi en forcer la création.</p>
              ) : (
                <div className="space-y-3">
                  {chartRequests?.map((req, index) => (
                    <div key={req.id} className="bg-slate-50 border border-slate-200 p-3 rounded-xl relative group">
                      <button 
                        onClick={() => removeChartRequest(req.id)}
                        className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 border border-slate-200 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X size={12} />
                      </button>
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => updateChartRequest(req.id, 'type', 'bar')}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${req.type === 'bar' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                        >
                          <BarChart2 size={14} /> Barres
                        </button>
                        <button
                          onClick={() => updateChartRequest(req.id, 'type', 'pie')}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${req.type === 'pie' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                        >
                          <PieChartIcon size={14} /> Secteurs
                        </button>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Données à illustrer (ex: Répartition par âge)" 
                        value={req.description}
                        onChange={(e) => updateChartRequest(req.id, 'description', e.target.value)}
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleAnalyze} disabled={loading || files.length === 0} className="w-full bg-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <BarChart size={20} />}
              Lancer l'Analyse
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="lg:col-span-2 space-y-6"
      >
        {project.analyses?.length > 0 ? (
          project.analyses.map(analysis => (
            <div key={analysis.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between print:hidden">
                <div className="flex flex-col">
                  <h3 className="font-semibold text-slate-800">{analysis.title}</h3>
                  <span className="text-xs text-slate-500">{new Date(analysis.date).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.print()} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors" title="Imprimer">
                    <Printer size={18} />
                  </button>
                  <button onClick={() => handleExportPDF(analysis.id, analysis.title)} disabled={exportingId === analysis.id} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Télécharger PDF">
                    {exportingId === analysis.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  </button>
                </div>
              </div>
              <div className="p-8" id={`analysis-content-${analysis.id}`}>
                <div className="prose prose-slate max-w-none prose-headings:text-purple-800 prose-a:text-purple-600">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.content}</ReactMarkdown>
                </div>
                
                {analysis.charts && analysis.charts.length > 0 && (
                  <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {analysis.charts.map((chart, i) => (
                      <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:break-inside-avoid relative group">
                        <button 
                          onClick={() => setEditingChart({ analysisId: analysis.id, chartIndex: i })}
                          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                        >
                          <Edit2 size={16} />
                        </button>
                        
                        {editingChart?.analysisId === analysis.id && editingChart?.chartIndex === i ? (
                          <div className="mb-6 space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-medium text-slate-700 text-sm">Personnaliser le graphique</h5>
                              <button onClick={() => setEditingChart(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Titre</label>
                              <input 
                                type="text" 
                                value={chart.title} 
                                onChange={(e) => updateChart(analysis.id, i, { title: e.target.value })}
                                className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-emerald-500"
                              />
                            </div>
                            
                            {chart.type === 'bar' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">Label Axe X</label>
                                  <input 
                                    type="text" 
                                    value={chart.xAxisLabel || ''} 
                                    onChange={(e) => updateChart(analysis.id, i, { xAxisLabel: e.target.value })}
                                    className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">Label Axe Y</label>
                                  <input 
                                    type="text" 
                                    value={chart.yAxisLabel || ''} 
                                    onChange={(e) => updateChart(analysis.id, i, { yAxisLabel: e.target.value })}
                                    className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </div>
                            )}
                            
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-2">Couleur principale</label>
                              <div className="flex gap-2">
                                {['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'].map(color => (
                                  <button
                                    key={color}
                                    onClick={() => updateChart(analysis.id, i, { color })}
                                    className={`w-6 h-6 rounded-full border-2 ${chart.color === color || (!chart.color && color === '#8b5cf6') ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-110'} transition-transform`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-200">
                              <label className="block text-xs font-medium text-slate-600 mb-2">Données (Labels)</label>
                              <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                                {chart.data.map((d, dIndex) => (
                                  <div key={dIndex} className="flex gap-2">
                                    <input 
                                      type="text" 
                                      value={d.name} 
                                      onChange={(e) => {
                                        const newData = [...chart.data];
                                        newData[dIndex].name = e.target.value;
                                        updateChart(analysis.id, i, { data: newData });
                                      }}
                                      className="flex-1 p-1.5 text-xs border border-slate-300 rounded-md outline-none focus:border-emerald-500"
                                    />
                                    <input 
                                      type="number" 
                                      value={d.value} 
                                      onChange={(e) => {
                                        const newData = [...chart.data];
                                        newData[dIndex].value = Number(e.target.value);
                                        updateChart(analysis.id, i, { data: newData });
                                      }}
                                      className="w-20 p-1.5 text-xs border border-slate-300 rounded-md outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <h4 className="text-center font-semibold text-slate-800 mb-6">{chart.title}</h4>
                        )}
                        
                        <div className="h-64 chart-container">
                          <ResponsiveContainer width="100%" height="100%">
                            {typeof chart.type === 'string' && chart.type === 'pie' && chart.data && Array.isArray(chart.data) ? (
                              <PieChart>
                                <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                  {chart.data.map((entry, index) => {
                                    const baseColors = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];
                                    const palette = chart.color ? [chart.color, ...baseColors.filter(c => c !== chart.color)] : COLORS;
                                    return <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />;
                                  })}
                                </Pie>
                                <Tooltip />
                                <Legend />
                              </PieChart>
                            ) : typeof chart.type === 'string' && chart.data && Array.isArray(chart.data) ? (
                              <RechartsBarChart data={chart.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis 
                                  dataKey="name" 
                                  axisLine={false} 
                                  tickLine={false} 
                                >
                                  {chart.xAxisLabel && <Label value={chart.xAxisLabel} position="insideBottom" offset={-10} />}
                                </XAxis>
                                <YAxis 
                                  axisLine={false} 
                                  tickLine={false} 
                                >
                                  {chart.yAxisLabel && <Label value={chart.yAxisLabel} angle={-90} position="insideLeft" />}
                                </YAxis>
                                <Tooltip cursor={{fill: '#f1f5f9'}} />
                                <Bar dataKey="value" fill={chart.color || "#8b5cf6"} radius={[4, 4, 0, 0]} />
                              </RechartsBarChart>
                            ) : null}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="h-[400px] border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 p-12 text-center">
            Importez vos données brutes (transcriptions, notes, photos de manuels) et lancez l'analyse. L'IA traitera les informations selon votre cadrage.
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
          <ArrowLeft size={20} /> Retour aux Outils
        </button>
        <button onClick={onNext} className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 hover:scale-105 transform duration-200">
          Étape suivante : Export <ArrowRight size={20} />
        </button>
      </motion.div>
    </div>
  );
}
