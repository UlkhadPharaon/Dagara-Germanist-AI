import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export interface ConfirmRequest {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

/**
 * Modal confirmation for destructive actions.
 *
 * Implemented as a proper dialog: focus moves to the cancel button on open,
 * Escape cancels, and the backdrop click is ignored so a mis-tap cannot destroy
 * a project by accident.
 */
export default function ConfirmDialog({
  request,
  onCancel,
}: {
  request: ConfirmRequest | null;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, onCancel]);

  return (
    <AnimatePresence>
      {request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 id="confirm-dialog-title" className="mb-2 text-xl font-semibold text-slate-800">
              Confirmation
            </h3>
            <p id="confirm-dialog-message" className="mb-6 text-slate-600">
              {request.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="rounded-lg px-4 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                {request.cancelLabel ?? 'Annuler'}
              </button>
              <button
                onClick={request.onConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
              >
                {request.confirmLabel ?? 'Confirmer'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
