import { HistoryLog } from '../types';
import { motion } from 'motion/react';
import { Clock, Plus, Edit2, Trash2, Download, Upload } from 'lucide-react';

interface HistoryTabProps {
  logs: HistoryLog[];
}

export default function HistoryTab({ logs }: HistoryTabProps) {
  const getIcon = (action: HistoryLog['action']) => {
    switch (action) {
      case 'create': return <Plus size={16} className="text-emerald-600" />;
      case 'update': return <Edit2 size={16} className="text-blue-600" />;
      case 'delete': return <Trash2 size={16} className="text-red-600" />;
      case 'export': return <Download size={16} className="text-purple-600" />;
      case 'import': return <Upload size={16} className="text-orange-600" />;
      default: return <Clock size={16} className="text-slate-600" />;
    }
  };

  const getBgColor = (action: HistoryLog['action']) => {
    switch (action) {
      case 'create': return 'bg-emerald-100';
      case 'update': return 'bg-blue-100';
      case 'delete': return 'bg-red-100';
      case 'export': return 'bg-purple-100';
      case 'import': return 'bg-orange-100';
      default: return 'bg-slate-100';
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Clock className="text-slate-400" />
          Historique des actions
        </h2>
        <p className="text-slate-600 mt-2">
          Retrouvez ici la trace de toutes vos modifications et actions récentes sur vos projets.
        </p>
      </div>

      <div className="space-y-4">
        {logs?.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
            <Clock size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Aucun historique disponible</p>
          </div>
        ) : (
          logs?.map((log, index) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={log.id}
              className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getBgColor(log.action)}`}>
                {getIcon(log.action)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <h3 className="font-semibold text-slate-800 truncate">
                    {log.projectName || 'Action globale'}
                  </h3>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {log.details}
                </p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
