import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './lib/auth-context';
import { initMonitoring } from './lib/monitoring';
import './index.css';

// Error monitoring is opt-in via VITE_SENTRY_DSN; it no-ops otherwise.
initMonitoring();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  );
}

// Offline shell registration (production builds only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./service-worker.js').catch(error => {
      console.warn('Service worker non enregistré :', error);
    });
  });
}
