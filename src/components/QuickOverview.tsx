import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  ClipboardList,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  LayoutDashboard,
  Cloud,
  Search,
  BarChart3,
  FileText,
} from 'lucide-react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Bienvenue sur Dagara Germanist AI for Inspector',
    description:
      "Votre assistant IA complet dédié à la recherche en didactique de l'allemand au Burkina Faso. Ce guide rapide vous expliquera toutes les fonctionnalités de l'application pour vous aider à structurer votre mémoire ou thèse.",
    icon: BookOpen,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
  },
  {
    id: 'projects',
    title: 'Gestion de vos Projets',
    description:
      "Dans le menu de gauche, créez de nouveaux projets (+), passez d'un projet à l'autre, et triez-les. Utilisez les boutons 'Exporter' et 'Importer' en bas à gauche pour sauvegarder tous vos projets sur votre ordinateur (fichier .json) et ne jamais perdre votre travail.",
    icon: LayoutDashboard,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
  },
  {
    id: 'header',
    title: 'En-tête et Sauvegarde Auto',
    description:
      "En haut de l'écran, renommez votre projet en cliquant sur son nom. Un indicateur vous confirme que vos modifications sont enregistrées automatiquement. Le sélecteur de langue (FR/DE) permet de choisir dans quelle langue l'IA générera vos outils de recherche.",
    icon: Cloud,
    color: 'text-sky-600',
    bg: 'bg-sky-100',
  },
  {
    id: 'phase01',
    title: 'Phases 0 & 1 : Fondations',
    description:
      "Commencez par la Phase 0 pour explorer la littérature existante sur votre sujet. Passez ensuite à la Phase 1 pour définir le contexte, vos hypothèses, vos questions de recherche et vos objectifs. L'IA vous guidera à chaque étape.",
    icon: Search,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  {
    id: 'phase2',
    title: 'Phase 2 : Outils de Recherche',
    description:
      "Générez automatiquement des questionnaires, guides d'entretien ou grilles d'observation basés sur vos hypothèses. N'oubliez pas d'utiliser le sélecteur de langue en haut (FR/DE) si vous souhaitez que l'outil soit généré directement en allemand pour vos élèves !",
    icon: ClipboardList,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
  },
  {
    id: 'phase3',
    title: 'Phase 3 : Analyse des Données',
    description:
      "Importez vos résultats (fichiers CSV ou JSON). L'IA analysera vos données, fera le lien avec vos hypothèses de la Phase 1, et générera des graphiques (barres, camemberts) que vous pourrez exporter.",
    icon: BarChart3,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
  },
  {
    id: 'phase4',
    title: 'Phase 4 : Exportation Finale',
    description:
      "Une fois votre travail terminé, la Phase 4 compile l'ensemble de votre projet (cadrage, outils, analyses) dans un document Word structuré, prêt à être intégré dans votre mémoire.",
    icon: FileText,
    color: 'text-rose-600',
    bg: 'bg-rose-100',
  },
  {
    id: 'chatbot',
    title: 'Assistant IA Contextuel',
    description:
      "Bloqué sur une notion ? Cliquez sur le bouton violet en bas à droite. Le chatbot connaît votre sujet, vos hypothèses et l'étape où vous vous trouvez pour vous offrir une aide ultra-personnalisée à tout moment.",
    icon: MessageCircle,
    color: 'text-fuchsia-600',
    bg: 'bg-fuchsia-100',
  },
] as const;

export default function QuickOverview({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(previous => previous + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(previous => previous - 1);
  };

  const StepIcon = STEPS[currentStep]?.icon ?? BookOpen;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-overview-title"
          aria-describedby="quick-overview-description"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          <button
            ref={closeRef}
            onClick={onClose}
            className="absolute top-4 right-4 z-10 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer le guide"
          >
            <X size={20} aria-hidden="true" />
          </button>

          <div className="flex min-h-[350px] flex-1 flex-col items-center overflow-y-auto p-6 pt-12 text-center sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex w-full flex-col items-center"
              >
                <div
                  className={`h-20 w-20 rounded-2xl ${STEPS[currentStep]?.bg ?? 'bg-blue-100'} ${STEPS[currentStep]?.color ?? 'text-blue-600'} mb-6 flex shrink-0 items-center justify-center shadow-inner`}
                >
                  <StepIcon size={40} aria-hidden="true" />
                </div>
                <h2
                  id="quick-overview-title"
                  className="mb-4 text-xl font-bold text-slate-800 sm:text-2xl"
                >
                  {STEPS[currentStep]?.title ?? 'Étape'}
                </h2>
                <p
                  id="quick-overview-description"
                  className="text-sm leading-relaxed text-slate-600 sm:text-base"
                >
                  {STEPS[currentStep]?.description ?? ''}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex shrink-0 flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:p-6">
            <div
              className="flex flex-wrap justify-center gap-1.5 sm:gap-2"
              role="progressbar"
              aria-valuenow={currentStep + 1}
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-label="Étapes du guide"
            >
              {STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentStep ? 'w-6 bg-emerald-500' : 'w-2 bg-slate-300'
                  }`}
                />
              ))}
            </div>

            <div className="flex w-full justify-between gap-3 sm:w-auto sm:justify-end">
              {currentStep > 0 ? (
                <button
                  onClick={handlePrev}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-200 sm:flex-none"
                >
                  <ArrowLeft size={18} aria-hidden="true" />{' '}
                  <span className="sm:hidden">Précédent</span>
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium text-slate-500 transition-colors hover:bg-slate-200 sm:flex-none"
                >
                  Passer
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2 font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 sm:flex-none"
              >
                {isLastStep ? (
                  <>
                    Terminer <Check size={18} aria-hidden="true" />
                  </>
                ) : (
                  <>
                    Suivant <ArrowRight size={18} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
