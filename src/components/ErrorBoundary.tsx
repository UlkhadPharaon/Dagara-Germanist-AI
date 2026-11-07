import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { showToast } from '../lib/toast';

interface ErrorBoundaryProps {
  /** Label shown in the fallback, e.g. "Phase 2 : Outils". */
  sectionName: string;
  children: ReactNode;
  /** Overrides the default fallback UI. */
  fallback?: ReactNode;
  /** Called after the error is logged — used to surface a toast. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** Incremented on each retry so the children are remounted from scratch. */
  resetKey: number;
}

/**
 * Catches rendering errors of the subtree it wraps.
 *
 * Without a boundary, one failing phase component unmounts the whole React tree
 * and the user loses the entire session. With it, the rest of the app —
 * sidebar, other phases, project data — stays alive.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `Erreur d'affichage dans « ${this.props.sectionName} » :`,
      error,
      errorInfo.componentStack
    );

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    } else {
      showToast(`Une erreur s'est produite dans « ${this.props.sectionName} ».`, 'error');
    }
  }

  private handleRetry = (): void => {
    this.setState(previous => ({ hasError: false, error: null, resetKey: previous.resetKey + 1 }));
  };

  override render(): ReactNode {
    const { hasError, error, resetKey } = this.state;
    const { sectionName, children, fallback } = this.props;

    if (!hasError) {
      // `contents` keeps the wrapper out of the flex/grid layout of the parent.
      return (
        <div key={resetKey} className="contents">
          {children}
        </div>
      );
    }

    if (fallback) return fallback;

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="mx-auto my-8 max-w-2xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Une erreur est survenue dans « {sectionName} »
            </h2>
            <p className="text-sm text-slate-500">
              Vos projets sont conservés. Vous pouvez réessayer ou changer d'onglet.
            </p>
          </div>
        </div>

        <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm break-words text-slate-600">
          {error?.message ?? "Une erreur inattendue s'est produite dans ce composant."}
        </p>

        <button
          onClick={this.handleRetry}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-900"
        >
          <RotateCcw size={16} aria-hidden="true" /> Réessayer
        </button>
      </div>
    );
  }
}
