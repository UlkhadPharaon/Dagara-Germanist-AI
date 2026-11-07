import type { HistoryLog } from '../types';
import { motion } from 'motion/react';
import { Clock, Plus, Edit2, Trash2, Download, Upload } from 'lucide-react';

interface HistoryTabProps {
  logs: HistoryLog[];
}

const ACTION_ICONS: Record<HistoryLog['action'], typeof Clock> = {
  create: Plus,
  update: Edit2,
  delete: Trash2,
  export: Download,
  import: Upload,
};

const ACTION_ICON_CLASS: Record<HistoryLog['action'], string> = {
  create: 'text-emerald-600',
  update: 'text-blue-600',
  delete: 'text-red-600',
  export: 'text-purple-600',
  import: 'text-orange-600',
};

const ACTION_BG_CLASS: Record<HistoryLog['action'], string> = {
  create: 'bg-emerald-100',
  update: 'bg-blue-100',
  delete: 'bg-red-100',
  export: 'bg-purple-100',
  import: 'bg-orange-100',
};

export default function HistoryTab({ logs }: HistoryTabProps) {
  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-8">
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Clock className="text-slate-400" aria-hidden="true" />
          Historique des actions
        </h2>
        <p className="mt-2 text-slate-600">
          Retrouvez ici la trace de toutes vos modifications et actions récentes sur vos projets.
        </p>
      </div>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
            <Clock size={48} className="mx-auto mb-4 text-slate-300" aria-hidden="true" />
            <p className="font-medium text-slate-500">Aucun historique disponible</p>
          </div>
        ) : (
          logs.map((log, index) => {
            const Icon = ACTION_ICONS[log.action] ?? Clock;
            const iconClass = ACTION_ICON_CLASS[log.action] ?? 'text-slate-600';
            const bgClass = ACTION_BG_CLASS[log.action] ?? 'bg-slate-100';

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={log.id}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bgClass}`}
                >
                  <Icon size={16} className={iconClass} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-4">
                    <h3 className="truncate font-semibold text-slate-800">
                      {log.projectName || 'Action globale'}
                    </h3>
                    <span className="text-xs whitespace-nowrap text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{log.details}</p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
