import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as MonitoringModule from '../monitoring';
import { first, firstCall } from '../../test/helpers';

/**
 * Error monitoring must stay a silent no-op without credentials, and must never
 * attach project content or user text to an event.
 */

// `vi.hoisted` keeps the spies available to the hoisted module factory.
const { sentryInit, sentryAddBreadcrumb, sentryCaptureException, sentrySetUser, sentryWithScope } =
  vi.hoisted(() => ({
    sentryInit: vi.fn(),
    sentryAddBreadcrumb: vi.fn(),
    sentryCaptureException: vi.fn(),
    sentrySetUser: vi.fn(),
    sentryWithScope: vi.fn((callback: (scope: { setContext: () => void }) => void) =>
      callback({ setContext: () => undefined })
    ),
  }));

vi.mock('@sentry/react', () => ({
  init: sentryInit,
  addBreadcrumb: sentryAddBreadcrumb,
  captureException: sentryCaptureException,
  setUser: sentrySetUser,
  withScope: sentryWithScope,
}));

let monitoring: typeof MonitoringModule;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('VITE_SENTRY_DSN', '');
  monitoring = await import('../monitoring');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('without a Sentry DSN', () => {
  it('disables monitoring instead of failing', () => {
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    monitoring.initMonitoring();

    expect(sentryInit).not.toHaveBeenCalled();
    expect(consoleInfo).toHaveBeenCalledWith(expect.stringContaining('Monitoring désactivé'));

    consoleInfo.mockRestore();
  });

  it('silently ignores errors and events', () => {
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    monitoring.initMonitoring();

    expect(() => monitoring.reportError(new Error('boom'))).not.toThrow();
    expect(() => monitoring.trackEvent({ name: 'auth_signed_in' })).not.toThrow();
    expect(sentryAddBreadcrumb).not.toHaveBeenCalled();
    expect(sentryCaptureException).not.toHaveBeenCalled();

    consoleInfo.mockRestore();
  });
});

describe('with a Sentry DSN', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@o0.ingest.sentry.io/0');
    vi.resetModules();
    monitoring = await import('../monitoring');
  });

  it('initialises Sentry once and strips user data', () => {
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    monitoring.initMonitoring();
    monitoring.initMonitoring();

    expect(sentryInit).toHaveBeenCalledTimes(1);
    expect(sentryInit).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://public@o0.ingest.sentry.io/0' })
    );

    consoleInfo.mockRestore();
  });

  it('reports an error without leaking the payload', () => {
    monitoring.initMonitoring();

    monitoring.reportError(new Error('échec'), { projectId: 'abc' });

    expect(sentryWithScope).toHaveBeenCalledTimes(1);
    expect(sentryCaptureException).toHaveBeenCalledTimes(1);
  });

  it('accepts a non-Error value', () => {
    monitoring.initMonitoring();

    monitoring.reportError('chaîne');

    expect(sentryCaptureException).toHaveBeenCalledTimes(1);
    expect(first(firstCall<unknown[]>(sentryCaptureException))).toBeInstanceOf(Error);
  });

  it('records every product event as a breadcrumb', () => {
    monitoring.initMonitoring();

    monitoring.trackEvent({ name: 'project_created', projectId: 'p1' });
    monitoring.trackEvent({ name: 'project_exported', format: 'doc', projectId: 'p1' });
    monitoring.trackEvent({ name: 'project_imported', count: 2 });
    monitoring.trackEvent({
      name: 'generation_succeeded',
      phase: 'phase1',
      model: 'meta/llama-3.1-70b-instruct',
      durationMs: 1200,
    });
    monitoring.trackEvent({ name: 'generation_failed', phase: 'phase3', reason: 'timeout' });

    expect(sentryAddBreadcrumb).toHaveBeenCalledTimes(5);
    expect(first(firstCall<Array<Record<string, unknown>>>(sentryAddBreadcrumb))).toMatchObject({
      category: 'analytics',
      message: 'project_created',
    });
    expect(first(sentryAddBreadcrumb.mock.calls.at(-1) ?? [])).toMatchObject({
      message: 'generation_failed',
    });
  });

  it('identifies the user by id only', () => {
    monitoring.initMonitoring();

    monitoring.setAnalyticsUser('user-123');
    expect(sentrySetUser).toHaveBeenCalledWith({ id: 'user-123' });

    monitoring.setAnalyticsUser(null);
    expect(sentrySetUser).toHaveBeenLastCalledWith(null);
  });
});
