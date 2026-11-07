import type { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';

/**
 * Wraps a phase (or any independently rendered section) in its own error
 * boundary so a crash in one phase cannot take down the application shell.
 */
export default function PhaseBoundary({ name, children }: { name: string; children: ReactNode }) {
  return <ErrorBoundary sectionName={name}>{children}</ErrorBoundary>;
}
