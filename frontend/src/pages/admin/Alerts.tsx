import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../api/client';
import { AdminDashboard, AlertRow } from '../../types';
import AlertFeed from '../../components/cards/AlertFeed';

type Filter = 'All' | 'Stock' | 'Beds' | 'Staff' | 'Emergency' | 'Forecast';

const FILTERS: Filter[] = ['All', 'Stock', 'Beds', 'Staff', 'Emergency', 'Forecast'];

const Alerts: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ alerts: AlertRow[]; forecastAlerts: AlertRow[] }>({
    alerts: [],
    forecastAlerts: [],
  });
  const [filter, setFilter] = useState<Filter>('All');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<AdminDashboard>('/admin/dashboard');
        if (cancelled) return;
        setData({
          alerts: res.data.alerts ?? [],
          forecastAlerts: res.data.forecastAlerts ?? [],
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      All: 0, Stock: 0, Beds: 0, Staff: 0, Emergency: 0, Forecast: 0,
    };
    const all = [...data.alerts, ...data.forecastAlerts];
    for (const a of all) {
      const key = a.type === 'stock' ? 'Stock'
        : a.type === 'beds' ? 'Beds'
        : a.type === 'staff' ? 'Staff'
        : a.type === 'emergency' ? 'Emergency'
        : a.type === 'forecast' ? 'Forecast' : 'All';
      c[key]++;
    }
    c.All = all.length;
    return c;
  }, [data]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alerts Center</h1>
        <p className="text-gray-600 mt-1">
          Active network alerts, including AI-predicted stockout forecasts.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ring-1 ring-inset ${
              filter === f
                ? 'bg-emerald-600 text-white ring-emerald-600 shadow-sm'
                : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {f}
            <span
              className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full text-[10px] ${
                filter === f ? 'bg-white/20' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {loading ? '…' : counts[f]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-96 bg-white rounded-xl border border-gray-200 animate-pulse" />
      ) : (
        <AlertFeed alerts={data.alerts} extraAlerts={data.forecastAlerts} filterType={filter} />
      )}
    </div>
  );
};

export default Alerts;
