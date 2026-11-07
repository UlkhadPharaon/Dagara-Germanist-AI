import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration (Android only — iOS is out of scope).
 *
 * `server.androidScheme: 'https'` is the Capacitor default and is required for
 * the WebView to accept fetch/XHR to the NVIDIA proxy; `cleartext` would be
 * blocked on modern Android and is deliberately not used.
 */
const config: CapacitorConfig = {
  appId: 'com.dagaragermanist.app',
  appName: 'Dagara Germanist AI',
  webDir: 'dist',
  android: {
    // Keep the WebView on the modern Chromium engine (needed for the
    // service worker, ES2022 output and `fetch` streaming).
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
