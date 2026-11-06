import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, ClipboardList, MessageCircle, Globe, ArrowRight, ArrowLeft, Check, X, LayoutDashboard, Cloud, Search, BarChart3, FileText } from 'lucide-react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Bienvenue sur Dagara Germanist AI for Inspector',
    description: "Votre assistant IA complet dédié à la recherche en didactique de l'allemand au Burkina Faso. Ce guide rapide vous expliquera toutes les fonctionnalités de l'application pour vous aider à structurer votre mémoire ou thèse.",
    icon: BookOpen,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100'
  },
  {
    id: 'projects',
    title: 'Gestion de vos Projets',
    description: "Dans le menu de gauche, créez de nouveaux projets (+), passez d'un projet à l'autre, et triez-les. Utilisez les boutons 'Exporter' et 'Importer' en bas à gauche pour sauvegarder tous vos projets sur votre ordinateur (fichier .json) et ne jamais perdre votre travail.",
    icon: LayoutDashboard,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100'
  },
  {
    id: 'header',
    title: 'En-tête et Sauvegarde Auto',
    description: "En haut de l'écran, renommez votre projet en cliquant sur son nom. Un indicateur vous confirme que vos modifications sont enregistrées automatiquement. Le sélecteur de langue (FR/DE) permet de choisir dans quelle langue l'IA générera vos outils de recherche.",
    icon: Cloud,
    color: 'text-sky-600',
    bg: 'bg-sky-100'
  },
  {
    id: 'phase01',
    title: 'Phases 0 & 1 : Fondations',
    description: "Commencez par la Phase 0 pour explorer la littérature existante sur votre sujet. Passez ensuite à la Phase 1 pour définir le contexte, vos hypothèses, vos questions de recherche et vos objectifs. L'IA vous guidera à chaque étape.",
    icon: Search,
    color: 'text-blue-600',
    bg: 'bg-blue-100'
  },
  {
    id: 'phase2',
    title: 'Phase 2 : Outils de Recherche',
    description: "Générez automatiquement des questionnaires, guides d'entretien ou grilles d'observation basés sur vos hypothèses. N'oubliez pas d'utiliser le sélecteur de langue en haut (FR/DE) si vous souhaitez que l'outil soit généré directement en allemand pour vos élèves !",
    icon: ClipboardList,
    color: 'text-amber-600',
    bg: 'bg-amber-100'
  },
  {
    id: 'phase3',
    title: 'Phase 3 : Analyse des Données',
    description: "Importez vos résultats (fichiers CSV ou JSON). L'IA analysera vos données, fera le lien avec vos hypothèses de la Phase 1, et générera des graphiques (barres, camemberts) que vous pourrez exporter.",
    icon: BarChart3,
    color: 'text-purple-600',
    bg: 'bg-purple-100'
  },
  {
    id: 'phase4',
    title: 'Phase 4 : Exportation Finale',
    description: "Une fois votre travail terminé, la Phase 4 compile l'ensemble de votre projet (cadrage, outils, analyses) dans un document Word structuré, prêt à être intégré dans votre mémoire.",
    icon: FileText,
    color: 'text-rose-600',
    bg: 'bg-rose-100'
  },
  {
    id: 'chatbot',
    title: 'Assistant IA Contextuel',
    description: "Bloqué sur une notion ? Cliquez sur le bouton violet en bas à droite. Le chatbot connaît votre sujet, vos hypothèses et l'étape où vous vous trouvez pour vous offrir une aide ultra-personnalisée à tout moment.",
    icon: MessageCircle,
    color: 'text-fuchsia-600',
    bg: 'bg-fuchsia-100'
  }
];

export default function QuickOverview({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const StepIcon = STEPS[currentStep].icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative flex flex-col max-h-[90vh]"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="p-6 sm:p-8 pt-12 flex flex-col items-center text-center overflow-y-auto flex-1 min-h-[350px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center w-full"
            >
              <div className={`w-20 h-20 rounded-2xl ${STEPS[currentStep].bg} ${STEPS[currentStep].color} flex items-center justify-center mb-6 shadow-inner shrink-0`}>
                <StepIcon size={40} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4">
                {STEPS[currentStep].title}
              </h2>
              <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                {STEPS[currentStep].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer / Controls */}
        <div className="bg-slate-50 p-4 sm:p-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          {/* Progress Dots */}
          <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center">
            {STEPS?.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-2 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-6 bg-emerald-500' : 'w-2 bg-slate-300'}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {currentStep > 0 ? (
              <button 
                onClick={handlePrev}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none"
              >
                <ArrowLeft size={18} /> <span className="sm:hidden">Précédent</span>
              </button>
            ) : (
              <button 
                onClick={onClose}
                className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none"
              >
                Passer
              </button>
            )}
            <button 
              onClick={handleNext}
              className="px-6 py-2 bg-emerald-600 text-white font-medium hover:bg-emerald-700 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none"
            >
              {currentStep === STEPS.length - 1 ? (
                <>Terminer <Check size={18} /></>
              ) : (
                <>Suivant <ArrowRight size={18} /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
