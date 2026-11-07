import { UI_TIMINGS } from './constants';

export type ToastType = 'error' | 'success' | 'info';

export interface ToastNotification {
  message: string;
  type: ToastType;
}

const TOAST_EVENT = 'app-toast';

/**
 * Dispatches a toast from anywhere in the app.
 *
 * The listener lives in `App` so a single announcement region is used — this is
 * required for screen readers (WCAG 4.1.3).
 */
export const showToast = (message: string, type: ToastType = 'info'): void => {
  const event = new CustomEvent<ToastNotification>(TOAST_EVENT, { detail: { message, type } });
  window.dispatchEvent(event);
};

export const toastEventName = TOAST_EVENT;

export const toastDurationMs = UI_TIMINGS.toastDurationMs;
