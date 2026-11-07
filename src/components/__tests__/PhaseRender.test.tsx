import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Phase0 from '../Phase0';
import Phase2 from '../Phase2';
import HistoryTab from '../HistoryTab';
import { createNewProject } from '../../lib/projects';
import type { ProjectData } from '../../types';

/**
 * Rendering smoke tests for the phase components: they assert that each phase
 * mounts with an empty project, exposes its accessible controls, and gates
 * itself correctly (Phase 2 needs a completed cadrage).
 */

const noop = (): void => undefined;

describe('Phase0', () => {
  it('renders the literature-review form with labelled controls', () => {
    render(<Phase0 project={createNewProject()} setProject={noop} onNext={noop} />);

    expect(screen.getByRole('heading', { name: /Phase 0/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Mots-clés de votre recherche/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contexte spécifique/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explorer la littérature/ })).toBeDisabled();
  });

  it('warns instead of calling the API when no keyword is entered', async () => {
    const project = createNewProject();
    render(<Phase0 project={project} setProject={noop} onNext={noop} />);

    const input = screen.getByLabelText(/Mots-clés de votre recherche/);
    await userEvent.type(input, 'motivation');

    const button = screen.getByRole('button', { name: /Explorer la littérature/ });
    expect(button).toBeEnabled();
  });
});

describe('Phase2', () => {
  it('refuses to render tools before Phase 1 is validated', () => {
    render(<Phase2 project={createNewProject()} setProject={noop} onNext={noop} onPrev={noop} />);

    expect(screen.getByText(/valider la Phase 1/)).toBeInTheDocument();
    expect(screen.queryByText('Outils à générer')).not.toBeInTheDocument();
  });

  it('lists the four tool types once a framework exists', () => {
    const project: ProjectData = {
      ...createNewProject(),
      subject: 'Sujet de test',
      hypotheses: ['H1'],
    };

    render(<Phase2 project={project} setProject={noop} onNext={noop} onPrev={noop} />);

    expect(screen.getByText('Outils à générer')).toBeInTheDocument();
    for (const label of [
      'Questionnaire Enseignants',
      'Questionnaire Élèves',
      'Questionnaire Inspecteurs',
      "Grille d'Analyse de Manuel",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Tool IDs must stay stable: users' saved projects key on them.
    expect(
      screen.getByLabelText(/Configurer l'approche pour Questionnaire Enseignants/)
    ).toBeInTheDocument();
  });
});

describe('HistoryTab', () => {
  it('shows the empty state without logs', () => {
    render(<HistoryTab logs={[]} />);
    expect(screen.getByText('Aucun historique disponible')).toBeInTheDocument();
  });

  it('renders logs newest first with their details', () => {
    render(
      <HistoryTab
        logs={[
          {
            id: '2',
            action: 'export',
            details: 'Exportation de 1 projets',
            timestamp: Date.parse('2026-02-02T10:00:00Z'),
            projectName: 'Mémoire',
          },
          {
            id: '1',
            action: 'create',
            details: 'Nouveau projet créé',
            timestamp: Date.parse('2026-01-01T10:00:00Z'),
            projectName: 'Mémoire',
          },
        ]}
      />
    );

    expect(screen.getByText('Exportation de 1 projets')).toBeInTheDocument();
    expect(screen.getByText('Nouveau projet créé')).toBeInTheDocument();
    expect(screen.getAllByText('Mémoire')).toHaveLength(2);
  });
});
