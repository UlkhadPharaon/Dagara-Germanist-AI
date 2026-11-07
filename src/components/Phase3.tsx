import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { ChartData, PhaseProps } from '../types';
import { analyzeData, type ChartRequest } from '../lib/api';
import {
  CHART_PALETTE,
  CHART_HEIGHT_PX,
  DEFAULT_CHART_COLOR,
  MAX_UPLOAD_FILES,
  PDF_EXPORT,
} from '../lib/constants';
import {
  Loader2,
  UploadCloud,
  File,
  X,
  BarChart,
  ArrowLeft,
  ArrowRight,
  Printer,
  Download,
  PlusCircle,
  PieChart as PieChartIcon,
  BarChart2,
  Edit2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  BarChart as RechartsBarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { motion } from 'motion/react';
import { showToast } from '../lib/toast';
import EmptyState from './EmptyState';

const DEFAULT_ANALYSIS_TYPE = 'Synthèse statistique et qualitative';

const ANALYSIS_TYPES = [
  DEFAULT_ANALYSIS_TYPE,
  'Analyse Critique de Manuel',
  'Identification de tendances et blocages',
  'Autre (préciser dans les instructions)',
] as const;

const CHART_EDITOR_COLORS = [...CHART_PALETTE];

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Une erreur inattendue s'est produite.";
}

/** Recharts needs `value` to be a real number — NaN would blank the chart. */
const toNumber = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function Phase3({
  project,
  setProject,
  onNext,
  onPrev,
}: PhaseProps & { onNext: () => void; onPrev: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [analysisType, setAnalysisType] =
    useState<(typeof ANALYSIS_TYPES)[number]>(DEFAULT_ANALYSIS_TYPE);
  const [instructions, setInstructions] = useState('');
  const [chartRequests, setChartRequests] = useState<ChartRequest[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [editingChart, setEditingChart] = useState<{
    analysisId: string;
    chartIndex: number;
  } | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files;
    if (!picked || picked.length === 0) return;

    const incoming = Array.from(picked);
    if (files.length + incoming.length > MAX_UPLOAD_FILES) {
      showToast(`Vous pouvez importer au maximum ${MAX_UPLOAD_FILES} fichiers à la fois.`, 'error');
      return;
    }
    setFiles(previous => [...previous, ...incoming]);
  };

  const removeFile = (index: number) => {
    setFiles(previous => previous.filter((_, i) => i !== index));
  };

  const addChartRequest = () => {
    setChartRequests(previous => [
      ...previous,
      { id: `${Date.now()}-${previous.length}`, type: 'bar', description: '' },
    ]);
  };

  const updateChartRequest = (id: string, field: keyof ChartRequest, value: string) => {
    setChartRequests(previous =>
      previous.map(request => (request.id === id ? { ...request, [field]: value } : request))
    );
  };

  const removeChartRequest = (id: string) => {
    setChartRequests(previous => previous.filter(request => request.id !== id));
  };

  const updateChart = (analysisId: string, chartIndex: number, updates: Partial<ChartData>) => {
    setProject({
      analyses: project.analyses.map(analysis =>
        analysis.id === analysisId
          ? {
              ...analysis,
              charts: analysis.charts?.map((chart, index) =>
                index === chartIndex ? { ...chart, ...updates } : chart
              ),
            }
          : analysis
      ),
    });
  };

  const updateChartPoint = (
    analysisId: string,
    chartIndex: number,
    pointIndex: number,
    patch: Partial<{ name: string; value: number }>
  ) => {
    const analysis = project.analyses.find(item => item.id === analysisId);
    const chart = analysis?.charts?.[chartIndex];
    if (!chart) return;

    const data = chart.data.map((point, index) =>
      index === pointIndex ? { ...point, ...patch } : point
    );
    updateChart(analysisId, chartIndex, { data });
  };

  const toggleResource = (resourceId: string): void => {
    setSelectedResourceIds(previous =>
      previous.includes(resourceId)
        ? previous.filter(id => id !== resourceId)
        : [...previous, resourceId]
    );
  };

  /** Documents from the project library, sent as text (no re-upload needed). */
  const selectedResources = (project.resources ?? []).filter(
    resource => selectedResourceIds.includes(resource.id) && resource.enabled
  );

  const handleAnalyze = async () => {
    if (files.length === 0 && selectedResources.length === 0) {
      showToast('Veuillez ajouter au moins un fichier ou sélectionner un document.', 'error');
      return;
    }

    setLoading(true);
    try {
      const referenceToolContent = selectedToolId ? project.tools[selectedToolId] : undefined;
      const result = await analyzeData(
        project,
        files,
        analysisType,
        instructions,
        chartRequests,
        referenceToolContent,
        selectedResources.map(resource => ({
          name: resource.name,
          content: resource.content,
        }))
      );

      const newAnalysis = {
        id: Date.now().toString(),
        title: analysisType,
        content: result.content,
        charts: result.charts,
        date: new Date().toISOString(),
      };
      setProject({ analyses: [newAnalysis, ...project.analyses] });
      showToast('Analyse générée avec succès.', 'success');
    } catch (error) {
      console.error(error);
      showToast(
        errorMessage(error) ||
          "Erreur lors de l'analyse. Assurez-vous que les fichiers sont supportés (PDF, Images, Audio, Texte).",
        'error'
      );
    }
    setLoading(false);
  };

  const handleExportPDF = async (analysisId: string, title: string) => {
    setExportingId(analysisId);
    try {
      const element = document.getElementById(`analysis-content-${analysisId}`);
      if (!element) {
        showToast("Contenu de l'analyse introuvable pour l'export.", 'error');
        return;
      }

      const imgData = await toJpeg(element, {
        quality: PDF_EXPORT.quality,
        backgroundColor: '#ffffff',
        pixelRatio: PDF_EXPORT.pixelRatio,
      });

      const pdf = new jsPDF({
        orientation: PDF_EXPORT.orientation,
        unit: 'mm',
        format: PDF_EXPORT.format,
      });

      const img = new Image();
      img.src = imgData;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Image illisible'));
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.height * pdfWidth) / img.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const filename = `Analyse_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      pdf.save(filename);
      showToast('Export PDF généré.', 'success');
    } catch (error) {
      console.error(error);
      showToast(
        "Erreur lors de l'exportation en PDF. Alternative : utilisez le bouton Imprimer.",
        'error'
      );
    } finally {
      setExportingId(null);
    }
  };

  const renderChart = (chart: ChartData) => {
    const palette = chart.color
      ? [chart.color, ...CHART_PALETTE.filter(color => color !== chart.color)]
      : [...CHART_PALETTE];

    if (chart.type === 'pie') {
      return (
        <PieChart>
          <Pie
            data={chart.data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          >
            {chart.data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      );
    }

    return (
      <RechartsBarChart data={chart.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="name" axisLine={false} tickLine={false}>
          {chart.xAxisLabel ? (
            <Label value={chart.xAxisLabel} position="insideBottom" offset={-10} />
          ) : null}
        </XAxis>
        <YAxis axisLine={false} tickLine={false}>
          {chart.yAxisLabel ? (
            <Label value={chart.yAxisLabel} angle={-90} position="insideLeft" />
          ) : null}
        </YAxis>
        <Tooltip cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="value" fill={chart.color || DEFAULT_CHART_COLOR} radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    );
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 lg:grid-cols-3">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 lg:col-span-1 print:hidden"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">Données & Paramètres</h2>

          <div className="space-y-4">
            <label className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition-colors hover:bg-slate-50">
              <UploadCloud size={32} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-600">
                Cliquez pour importer des fichiers
              </p>
              <p className="mt-1 text-xs text-slate-400">PDF, Audio, Images, Texte</p>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                aria-label="Importer des fichiers à analyser"
              />
            </label>

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <File size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />
                      <span className="truncate text-xs text-slate-700">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-slate-400 hover:text-red-500"
                      aria-label={`Retirer le fichier ${file.name}`}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label
                htmlFor="phase3-analysis-type"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Type d'analyse
              </label>
              <select
                id="phase3-analysis-type"
                value={analysisType}
                onChange={event =>
                  setAnalysisType(event.target.value as (typeof ANALYSIS_TYPES)[number])
                }
                className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {ANALYSIS_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="phase3-reference-tool"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Grille de référence (Optionnel)
              </label>
              <select
                id="phase3-reference-tool"
                value={selectedToolId ?? ''}
                onChange={event => setSelectedToolId(event.target.value || null)}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Aucune (Analyse libre)</option>
                {Object.entries(project.tools).map(([id]) => (
                  <option key={id} value={id}>
                    Outil : {id}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                L'IA utilisera cet outil comme cadre pour évaluer les documents.
              </p>
            </div>

            <div>
              <label
                htmlFor="phase3-instructions"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Instructions spécifiques
              </label>
              <textarea
                id="phase3-instructions"
                value={instructions}
                onChange={event => setInstructions(event.target.value)}
                className="min-h-[100px] w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex: Mets l'accent sur les réponses des enseignants concernant l'APC..."
              />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="block text-sm font-medium text-slate-700">
                  Graphiques souhaités
                </span>
                <button
                  onClick={addChartRequest}
                  className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
                >
                  <PlusCircle size={14} aria-hidden="true" /> Ajouter
                </button>
              </div>

              {chartRequests.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  L'IA générera des graphiques automatiquement si pertinent. Vous pouvez aussi en
                  forcer la création.
                </p>
              ) : (
                <div className="space-y-3">
                  {chartRequests.map(request => (
                    <div
                      key={request.id}
                      className="group relative rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <button
                        onClick={() => removeChartRequest(request.id)}
                        className="absolute -top-2 -right-2 rounded-full border border-slate-200 bg-white p-1 text-slate-400 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-red-500"
                        aria-label="Retirer cette demande de graphique"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                      <div className="mb-2 flex gap-2">
                        <button
                          onClick={() => updateChartRequest(request.id, 'type', 'bar')}
                          aria-pressed={request.type === 'bar'}
                          className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                            request.type === 'bar'
                              ? 'border border-emerald-200 bg-emerald-100 text-emerald-700'
                              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <BarChart2 size={14} aria-hidden="true" /> Barres
                        </button>
                        <button
                          onClick={() => updateChartRequest(request.id, 'type', 'pie')}
                          aria-pressed={request.type === 'pie'}
                          className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                            request.type === 'pie'
                              ? 'border border-emerald-200 bg-emerald-100 text-emerald-700'
                              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <PieChartIcon size={14} aria-hidden="true" /> Secteurs
                        </button>
                      </div>
                      <input
                        type="text"
                        aria-label="Données à illustrer"
                        placeholder="Données à illustrer (ex: Répartition par âge)"
                        value={request.description}
                        onChange={event =>
                          updateChartRequest(request.id, 'description', event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(project.resources ?? []).length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="block text-sm font-medium text-slate-700">
                    Documents du projet
                  </span>
                  <span className="text-xs text-slate-400">
                    {selectedResources.length} sélectionné(s)
                  </span>
                </div>
                <div className="space-y-2">
                  {(project.resources ?? []).map(resource => (
                    <label
                      key={resource.id}
                      className={`flex items-start gap-2 rounded-lg border p-2 text-xs transition-colors ${
                        selectedResourceIds.includes(resource.id)
                          ? 'border-emerald-200 bg-emerald-50/60'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-emerald-600"
                        checked={selectedResourceIds.includes(resource.id)}
                        onChange={() => toggleResource(resource.id)}
                        aria-label={`Analyser « ${resource.name} »`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-700">
                          {resource.name}
                        </span>
                        <span className="text-slate-400">
                          {resource.kind === 'note' ? 'Note' : 'Fichier'} ·{' '}
                          {resource.content.length.toLocaleString('fr-FR')} car.
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Ces documents sont analysés sans nouvel import. Gérez la bibliothèque via le
                  bouton « Documents » du menu.
                </p>
              </div>
            )}

            <button
              onClick={() => void handleAnalyze()}
              disabled={loading || (files.length === 0 && selectedResources.length === 0)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} aria-hidden="true" />
              ) : (
                <BarChart size={20} aria-hidden="true" />
              )}
              Lancer l'Analyse
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="space-y-6 lg:col-span-2"
      >
        {project.analyses.length > 0 ? (
          project.analyses.map(analysis => (
            <div
              key={analysis.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:border-none print:shadow-none"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
                <div className="flex flex-col">
                  <h3 className="font-semibold text-slate-800">{analysis.title}</h3>
                  <span className="text-xs text-slate-500">
                    {new Date(analysis.date).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                    title="Imprimer"
                    aria-label="Imprimer l'analyse"
                  >
                    <Printer size={18} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => void handleExportPDF(analysis.id, analysis.title)}
                    disabled={exportingId === analysis.id}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Télécharger PDF"
                    aria-label="Télécharger l'analyse en PDF"
                  >
                    {exportingId === analysis.id ? (
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Download size={18} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              <div className="p-8" id={`analysis-content-${analysis.id}`}>
                <div className="prose prose-slate prose-headings:text-purple-800 prose-a:text-purple-600 max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.content}</ReactMarkdown>
                </div>

                {analysis.charts && analysis.charts.length > 0 && (
                  <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
                    {analysis.charts.map((chart, index) => (
                      <div
                        key={`${analysis.id}-chart-${index}`}
                        className="group relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:break-inside-avoid"
                      >
                        <button
                          onClick={() =>
                            setEditingChart({ analysisId: analysis.id, chartIndex: index })
                          }
                          className="absolute top-4 right-4 rounded-lg bg-slate-50 p-2 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-emerald-50 hover:text-emerald-600 print:hidden"
                          aria-label={`Modifier le graphique ${chart.title}`}
                        >
                          <Edit2 size={16} aria-hidden="true" />
                        </button>

                        {editingChart?.analysisId === analysis.id &&
                        editingChart?.chartIndex === index ? (
                          <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <h5 className="text-sm font-medium text-slate-700">
                                Personnaliser le graphique
                              </h5>
                              <button
                                onClick={() => setEditingChart(null)}
                                className="text-slate-400 hover:text-slate-600"
                                aria-label="Fermer l'édition du graphique"
                              >
                                <X size={16} aria-hidden="true" />
                              </button>
                            </div>

                            <div>
                              <label
                                htmlFor={`chart-title-${analysis.id}-${index}`}
                                className="mb-1 block text-xs font-medium text-slate-600"
                              >
                                Titre
                              </label>
                              <input
                                id={`chart-title-${analysis.id}-${index}`}
                                type="text"
                                value={chart.title}
                                onChange={event =>
                                  updateChart(analysis.id, index, { title: event.target.value })
                                }
                                className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-emerald-500"
                              />
                            </div>

                            {chart.type === 'bar' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label
                                    htmlFor={`chart-x-${analysis.id}-${index}`}
                                    className="mb-1 block text-xs font-medium text-slate-600"
                                  >
                                    Label Axe X
                                  </label>
                                  <input
                                    id={`chart-x-${analysis.id}-${index}`}
                                    type="text"
                                    value={chart.xAxisLabel ?? ''}
                                    onChange={event =>
                                      updateChart(analysis.id, index, {
                                        xAxisLabel: event.target.value,
                                      })
                                    }
                                    className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`chart-y-${analysis.id}-${index}`}
                                    className="mb-1 block text-xs font-medium text-slate-600"
                                  >
                                    Label Axe Y
                                  </label>
                                  <input
                                    id={`chart-y-${analysis.id}-${index}`}
                                    type="text"
                                    value={chart.yAxisLabel ?? ''}
                                    onChange={event =>
                                      updateChart(analysis.id, index, {
                                        yAxisLabel: event.target.value,
                                      })
                                    }
                                    className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </div>
                            )}

                            <div>
                              <span className="mb-2 block text-xs font-medium text-slate-600">
                                Couleur principale
                              </span>
                              <div className="flex gap-2">
                                {CHART_EDITOR_COLORS.map(color => (
                                  <button
                                    key={color}
                                    onClick={() => updateChart(analysis.id, index, { color })}
                                    className={`h-6 w-6 rounded-full border-2 ${
                                      chart.color === color ||
                                      (!chart.color && color === DEFAULT_CHART_COLOR)
                                        ? 'scale-110 border-slate-800'
                                        : 'border-transparent hover:scale-110'
                                    } transition-transform`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`Utiliser la couleur ${color}`}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="border-t border-slate-200 pt-2">
                              <span className="mb-2 block text-xs font-medium text-slate-600">
                                Données (Labels)
                              </span>
                              <div className="max-h-32 space-y-2 overflow-y-auto pr-2">
                                {chart.data.map((point, pointIndex) => (
                                  <div key={pointIndex} className="flex gap-2">
                                    <input
                                      type="text"
                                      aria-label={`Nom de la catégorie ${pointIndex + 1}`}
                                      value={point.name}
                                      onChange={event =>
                                        updateChartPoint(analysis.id, index, pointIndex, {
                                          name: event.target.value,
                                        })
                                      }
                                      className="flex-1 rounded-md border border-slate-300 p-1.5 text-xs outline-none focus:border-emerald-500"
                                    />
                                    <input
                                      type="number"
                                      aria-label={`Valeur de la catégorie ${pointIndex + 1}`}
                                      value={point.value}
                                      onChange={event =>
                                        updateChartPoint(analysis.id, index, pointIndex, {
                                          value: toNumber(event.target.value),
                                        })
                                      }
                                      className="w-20 rounded-md border border-slate-300 p-1.5 text-xs outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <h4 className="mb-6 text-center font-semibold text-slate-800">
                            {chart.title}
                          </h4>
                        )}

                        <div className="chart-container" style={{ height: CHART_HEIGHT_PX }}>
                          <ResponsiveContainer width="100%" height="100%">
                            {renderChart(chart)}
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
          <EmptyState
            className="h-[400px]"
            icon={<UploadCloud size={48} />}
            title="Aucune analyse pour le moment"
            description="Importez vos données brutes (transcriptions, notes, photos de manuels) et lancez l'analyse. L'IA traitera les informations selon votre cadrage."
          />
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
          <ArrowLeft size={20} aria-hidden="true" /> Retour aux Outils
        </button>
        <button
          onClick={onNext}
          className="flex w-full transform items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-3 font-medium text-white transition-colors duration-200 hover:scale-105 hover:bg-slate-900 sm:w-auto"
        >
          Étape suivante : Export <ArrowRight size={20} aria-hidden="true" />
        </button>
      </motion.div>
    </div>
  );
}
