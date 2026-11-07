import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../ErrorBoundary';
import { showToast } from '../../lib/toast';

/**
 * Proves that a crash inside one phase is contained: the rest of the tree keeps
 * rendering and the user gets a recovery action instead of a white screen.
 */

function Boom(): React.ReactElement {
  throw new Error('rendering impossible');
}

function Safe(): React.ReactElement {
  return <p>Contenu sain</p>;
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary sectionName="Phase 0">
        <Safe />
      </ErrorBoundary>
    );

    expect(screen.getByText('Contenu sain')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a labelled fallback instead of crashing the app', () => {
    // Silence the expected console output from React's error logging.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary sectionName="Phase 2">
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Phase 2/)).toBeInTheDocument();
    expect(screen.getByText(/rendering impossible/)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('keeps sibling content alive when one boundary fails', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <>
        <ErrorBoundary sectionName="Sidebar">
          <Safe />
        </ErrorBoundary>
        <ErrorBoundary sectionName="Phase 1">
          <Boom />
        </ErrorBoundary>
      </>
    );

    expect(screen.getByText('Contenu sain')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    consoleError.mockRestore();
  });

  it('remounts the subtree when the user retries', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;

    function Toggle(): React.ReactElement {
      if (shouldThrow) throw new Error('boom');
      return <p>Rétabli</p>;
    }

    const view = render(
      <ErrorBoundary sectionName="Phase 3">
        <Toggle />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: /Réessayer/ }));

    expect(screen.getByText('Rétabli')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    consoleError.mockRestore();
    view.unmount();
  });

  it('reports the failure through the toast channel by default', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const listener = vi.fn();
    window.addEventListener('app-toast', listener);

    render(
      <ErrorBoundary sectionName="Phase 4">
        <Boom />
      </ErrorBoundary>
    );

    expect(listener).toHaveBeenCalled();
    window.removeEventListener('app-toast', listener);
    consoleError.mockRestore();
  });
});

describe('showToast', () => {
  it('dispatches a typed custom event on window', () => {
    const listener = vi.fn();
    window.addEventListener('app-toast', listener);

    showToast('bonjour', 'success');

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({ message: 'bonjour', type: 'success' });

    window.removeEventListener('app-toast', listener);
  });
});
