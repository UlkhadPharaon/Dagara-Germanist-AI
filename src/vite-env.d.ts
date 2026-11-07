/// <reference types="vite/client" />

/**
 * Typed environment variables.
 *
 * Only `VITE_`-prefixed variables reach the browser bundle, so the NVIDIA key
 * is intentionally absent here — it is read on the server side of the proxy
 * only. Service-role keys must never be listed here.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_ENV?: 'development' | 'preview' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
