import { AnimatePresence, motion } from 'motion/react';
import { Check, Info, X } from 'lucide-react';
import type { ToastNotification } from '../lib/toast';

/**
 * Global toast notification.
 *
 * Rendered in a polite live region so assistive technology announces messages
 * without interrupting the user, and dismissible by keyboard (the close button
 * is a real <button> in the tab order).
 */
export default function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastNotification | null;
  onDismiss: () => void;
}) {
  const palette =
    toast?.type === 'error'
      ? 'bg-red-600'
      : toast?.type === 'success'
        ? 'bg-emerald-600'
        : 'bg-blue-600';

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className={`fixed right-6 bottom-6 z-50 flex max-w-md items-start gap-3 rounded-xl p-4 text-white shadow-xl ${palette}`}
          role="status"
          aria-live="polite"
        >
          {toast.type === 'error' ? (
            <X size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : toast.type === 'success' ? (
            <Check size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <p className="text-sm leading-relaxed font-medium">{toast.message}</p>
          <button
            onClick={onDismiss}
            className="ml-auto shrink-0 rounded-md p-1 transition-colors hover:bg-white/20"
            aria-label="Fermer la notification"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
