/// <reference types="vite/client" />

/**
 * Typed environment variables.
 *
 * Only `VITE_`-prefixed variables reach the browser bundle, so the NVIDIA key
 * is intentionally absent here — it is read on the server side of the proxy
 * only. PocketBase has no service-role key: admin access is reserved to the
 * superuser account and never reaches the browser.
 */
interface ImportMetaEnv {
  readonly VITE_POCKETBASE_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_ENV?: 'development' | 'preview' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
