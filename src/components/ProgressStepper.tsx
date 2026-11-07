import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import type { WorkflowTab } from './AppSidebar';

/**
 * Horizontal progress indicator across the five phases.
 * The "Historique" tab is intentionally excluded — it is not a research step.
 */
export default function ProgressStepper({
  tabs,
  activeTab,
  onSelectTab,
}: {
  tabs: WorkflowTab[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}) {
  const steps = tabs.filter(tab => tab.id !== 'history');
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-6 lg:px-8 print:hidden">
      <ol className="relative mx-auto flex max-w-3xl list-none items-center justify-between">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute top-1/2 left-0 z-0 h-0.5 w-full origin-left -translate-y-1/2 bg-slate-200"
        />
        {steps.map((tab, index) => {
          const isCompleted = index < activeIndex;
          const isCurrent = index === activeIndex;

          return (
            <motion.li
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.3 }}
              key={tab.id}
              className="relative z-10 flex flex-col items-center gap-2 bg-white px-2"
            >
              <button
                onClick={() => onSelectTab(tab.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold transition-all duration-300 ${
                  isCurrent
                    ? 'scale-110 border-emerald-600 bg-emerald-600 text-white shadow-md'
                    : isCompleted
                      ? 'border-emerald-500 bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                      : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400'
                }`}
              >
                {isCompleted ? <Check size={20} aria-hidden="true" /> : index + 1}
              </button>
              <span
                className={`text-xs font-medium transition-colors duration-300 ${
                  isCurrent ? 'text-emerald-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {tab.label.split(':')[1]?.trim() || tab.label}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
