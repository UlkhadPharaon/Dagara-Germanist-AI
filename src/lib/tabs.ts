/**
 * Workflow navigation model — kept in `lib/` (not in a component file) so that
 * fast-refresh and the React Compiler rules stay happy and every consumer
 * shares one definition of the phase order.
 *
 * Tab IDs are a routing contract: saved projects and tests reference them, so
 * they must not be renamed (see 05_MASTER_IMPLEMENTATION_PLAN.md §5.3).
 */

import { BarChart3, BookOpen, ClipboardList, FileText, History, Search } from 'lucide-react';

export interface WorkflowTab {
  id: string;
  label: string;
  icon: typeof BarChart3;
  color: string;
  bg: string;
}

export const TABS: WorkflowTab[] = [
  {
    id: 'phase0',
    label: 'Phase 0: Revue',
    icon: Search,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  {
    id: 'phase1',
    label: 'Phase 1: Cadrage',
    icon: BookOpen,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    id: 'phase2',
    label: 'Phase 2: Outils',
    icon: ClipboardList,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    id: 'phase3',
    label: 'Phase 3: Analyse',
    icon: BarChart3,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    id: 'phase4',
    label: 'Phase 4: Export',
    icon: FileText,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    id: 'history',
    label: 'Historique',
    icon: History,
    color: 'text-slate-600',
    bg: 'bg-slate-100',
  },
];

/** Phases only — the history tab is not a research step. */
export const PHASE_TAB_IDS = TABS.filter(tab => tab.id !== 'history').map(tab => tab.id);
