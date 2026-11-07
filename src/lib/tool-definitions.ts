/**
 * Phase 2 data-collection tools.
 *
 * The `id` values are part of the saved-project contract — existing projects
 * store generated markdown under these keys, so they must remain stable.
 */

export interface ToolDefinition {
  id: string;
  label: string;
}

export const TOOLS: ToolDefinition[] = [
  { id: 'enseignants', label: 'Questionnaire Enseignants' },
  { id: 'eleves', label: 'Questionnaire Élèves' },
  { id: 'inspecteurs', label: 'Questionnaire Inspecteurs' },
  { id: 'grille', label: "Grille d'Analyse de Manuel" },
];

/** Psychological framing options offered per tool. */
export const TOOL_STYLES: string[] = [
  'Standard / Neutre',
  'Contournement de la désirabilité sociale',
  'Approche projective (Mises en situation)',
  'Focalisation sur les biais cognitifs',
  'Entretien compréhensif (profondeur)',
  'Échelle de Likert orientée',
  'Pédagogie différenciée',
  'Approche socio-constructiviste',
];

export const toolLabel = (id: string): string => TOOLS.find(tool => tool.id === id)?.label ?? id;
