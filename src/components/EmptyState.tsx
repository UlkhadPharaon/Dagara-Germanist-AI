import type { ReactNode } from 'react';
import { motion } from 'motion/react';

/**
 * Shared empty-state placeholder (dashed panel) used across the phases.
 * Keeps the copy and the layout consistent instead of five inline variants.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-400 lg:p-12 ${className}`}
    >
      {icon ? <div className="mb-4 opacity-20">{icon}</div> : null}
      <p className="text-base font-medium text-slate-500">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </motion.div>
  );
}
