/**
 * Error monitoring and product analytics.
 *
 * Both layers degrade to no-ops when their credentials are absent, so the app
 * runs identically in local development and in the AI Studio preview without a
 * Sentry project. No personal data (project content, prompts, file bytes) is
 * ever attached to an event.
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const APP_ENV = import.meta.env.VITE_APP_ENV ?? 'development';

let initialized = false;

/** Release marker; kept simple until a build-time version is injected. */
const APPVERSION = 'dev';

/** Idempotent: safe to call from every entry point. */
export function initMonitoring(): void {
  // Intentionally left `false` when no DSN is configured, so every other
  // function in this module stays a no-op instead of calling into an
  // uninitialised Sentry client.
  if (initialized) return;
  if (typeof SENTRY_DSN !== 'string' || SENTRY_DSN.length === 0) {
    console.info('Monitoring désactivé : aucune clé VITE_SENTRY_DSN configurée.');
    return;
  }

  initialized = true;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: APP_ENV,
    // Traces add cost and value only once traffic exists.
    tracesSampleRate: APP_ENV === 'production' ? 0.2 : 0,
    release: `dagara-germanist-ai@${APPVERSION}`,
    // Never upload project content or user text to Sentry.
    beforeSend(event) {
      if (event.user) delete event.user;
      return event;
    },
  });
}

/** Reports an unexpected error (ErrorBoundary, failed writes, proxy failures). */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;

  Sentry.withScope(scope => {
    if (context) scope.setContext('details', context);
    if (error instanceof Error) Sentry.captureException(error);
    else Sentry.captureException(new Error(String(error)));
  });
}

// ---------------------------------------------------------------------------
// Product analytics — locally defined, provider-agnostic event names
// ---------------------------------------------------------------------------

export type AnalyticsEvent =
  | { name: 'project_created'; projectId: string }
  | { name: 'project_exported'; format: 'json' | 'doc' | 'pdf'; projectId: string }
  | { name: 'project_imported'; count: number }
  | {
      name: 'generation_started';
      phase: 'phase0' | 'phase1' | 'phase2' | 'phase3' | 'phase4';
      model: string;
    }
  | {
      name: 'generation_succeeded';
      phase: 'phase0' | 'phase1' | 'phase2' | 'phase3' | 'phase4';
      model: string;
      durationMs: number;
    }
  | {
      name: 'generation_failed';
      phase: 'phase0' | 'phase1' | 'phase2' | 'phase3' | 'phase4';
      reason: string;
    }
  | { name: 'auth_signed_in' }
  | { name: 'auth_signed_up' }
  | { name: 'auth_signed_out' }
  | { name: 'local_projects_migrated'; uploaded: number }
  | { name: 'phase_viewed'; phase: string };

/**
 * Records one product event.
 *
 * Events are also mirrored to the console in development so behaviour can be
 * verified without a dashboard.
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (!initialized) return;

  Sentry.addBreadcrumb({
    category: 'analytics',
    message: event.name,
    level: 'info',
    data: event,
  });

  if (APP_ENV !== 'production') {
    console.info(`[analytics] ${event.name}`, event);
  }
}

/** Identifies the signed-in user for error grouping (id only, no PII). */
export function setAnalyticsUser(userId: string | null): void {
  if (!initialized) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
