export const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
  const event = new CustomEvent('app-toast', { detail: { message, type } });
  window.dispatchEvent(event);
};
