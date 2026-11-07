import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { nvidiaProxyPlugin } from './vite-plugin-nvidia-proxy';

/**
 * Build configuration.
 *
 * `base: './'` keeps the bundle working from the filesystem and from the
 * Capacitor WebView, where the app is not served from a domain root.
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), nvidiaProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
  // Only the root HTML is an entry: `android/app/...` holds a previous web
  // build whose minified assets must not be scanned/parsed by esbuild.
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    // Recharts + mammoth + html-to-image are the heavy peers; keeping them in
    // separate chunks makes long-term caching usable on mobile connections.
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          markdown: ['react-markdown', 'remark-gfm'],
          motion: ['motion/react'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
