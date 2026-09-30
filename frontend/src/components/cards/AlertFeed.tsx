import React, { useMemo, useState } from 'react';
import { AlertRow, AlertSeverity } from '../../types';
import { fmtTimeAgo } from '../../lib/format';

interface Props {
  alerts: AlertRow[];
  extraAlerts?: AlertRow[];
  filterType?: string;
}

const sevDot: Record<AlertSeverity, string> = {
  low: 'bg-emerald-500',
  moderate: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const sevBg: Record<AlertSeverity, string> = {
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  moderate: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  high: 'bg-orange-50 text-orange-700 ring-orange-200',
  critical: 'bg-red-50 text-red-700 ring-red-200',
};

const AlertFeed: React.FC<Props> = ({ alerts, extraAlerts = [], filterType }) => {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const combined = useMemo(() => {
    const all = [...alerts, ...extraAlerts];
    if (!filterType || filterType === 'All') return all;
    return all.filter((a) => a.type === filterType.toLowerCase());
  }, [alerts, extraAlerts, filterType]);

  const visible = combined.filter((a) => !dismissed.has(a.id));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Recent Alerts</h3>
          <p className="text-xs text-gray-500 mt-0.5">{visible.length} active</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[500px]">
        {visible.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No active alerts — all systems normal.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((a) => (
              <li key={`${a.type}-${a.id}`} className="p-4 hover:bg-gray-50">
                <div className="flex gap-3">
                  <span
                    className={`w-3 h-3 mt-1 rounded-full flex-shrink-0 ${sevDot[a.severity]}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${sevBg[a.severity]}`}
                        >
                          {a.type}
                        </span>
                        {a.type === 'forecast' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset bg-sky-50 text-sky-700 ring-sky-200">
                            📈 Forecast
                          </span>
                        )}
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500 truncate">{a.phc?.name ?? 'Network'}</span>
                      </div>
                      <button
                        onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
                        className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0"
                        type="button"
                        title="Dismiss"
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{a.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{fmtTimeAgo(a.createdAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AlertFeed;
