import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import BarChartCard from '../../components/charts/BarChartCard';
import LineChartCard from '../../components/charts/LineChartCard';
import { AdminBedsRow, BedsHistoryResponse } from '../../types';
import { fmtNumber, fmtPct } from '../../lib/format';

const statusBadge = (pct: number, emergency: boolean) => {
  if (emergency || pct > 85) return { label: 'Critical', cls: 'bg-red-100 text-red-700 ring-red-200' };
  if (pct > 70) return { label: 'High', cls: 'bg-yellow-100 text-yellow-700 ring-yellow-200' };
  return { label: 'Normal', cls: 'bg-green-100 text-green-700 ring-green-200' };
};

const Beds: React.FC = () => {
  const [bedsRows, setBedsRows] = useState<AdminBedsRow[]>([]);
  const [history, setHistory] = useState<BedsHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [bRes, hRes] = await Promise.all([
          apiClient.get<{ rows: AdminBedsRow[] }>('/admin/dashboard/beds'),
          apiClient.get<BedsHistoryResponse>('/admin/history/beds', { params: { days: 7 } }),
        ]);
        setBedsRows(bRes.data.rows || []);
        setHistory(hRes.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const barData = useMemo(() => {
    const sorted = [...bedsRows].sort((a, b) => b.bedsOccupiedPct - a.bedsOccupiedPct);
    return sorted.map((r) => ({
      name: r.name,
      bedsOccupiedPct: r.bedsOccupiedPct,
      _warn: r.bedsOccupiedPct > 85 || r.activeEmergency,
      _row: r,
    }));
  }, [bedsRows]);

  const cellColor = (entry: any) => {
    if (entry._warn) return '#dc2626';
    if (entry.bedsOccupiedPct > 70) return '#ca8a04';
    return '#0d9488';
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Beds Management</h1>
        <p className="text-gray-600 mt-1">Occupancy monitoring and week-ahead trends</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <BarChartCard
            title="Bed Occupancy % by PHC"
            subtitle="Sorted highest → lowest · >85% highlighted in red"
            data={barData}
            keys={[{ key: 'bedsOccupiedPct', label: 'Occupied %', color: '#0d9488' }]}
            xKey="name"
            horizontal
            height={Math.max(300, bedsRows.length * 55 + 80)}
            legend={false}
            cellColorFn={cellColor}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Capacity Status</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700">PHC</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-700">Total</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-700">Occ.</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-700">Res.</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  barData.map((b) => {
                    const r = b._row as AdminBedsRow;
                    const badge = statusBadge(r.bedsOccupiedPct, r.activeEmergency);
                    return (
                      <tr key={r.phcId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{fmtNumber(r.bedsTotal)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="font-semibold text-gray-900">
                            {fmtNumber(r.bedsOccupied)}
                          </span>
                          <span className="text-xs text-gray-500"> ({fmtPct(r.bedsOccupiedPct)})</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-orange-600 font-medium">
                          {fmtNumber(r.bedsEmergencyReserved)}
                        </td>
                        <td className="px-4 py-2.5">
                          {b._warn && (
                            <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1.5 animate-pulse align-middle" />
                          )}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">7-Day Occupancy History (per PHC)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(history?.byPhc ?? []).map((phc) => {
            const peak = phc.series.reduce((m, s) => Math.max(m, s.bedsOccupied), 0);
            const pct = phc.bedsTotal > 0 ? Math.round((peak / phc.bedsTotal) * 100) : 0;
            return (
              <LineChartCard
                key={phc.phcId}
                title={phc.phcName}
                subtitle={`Peak: ${peak}/${phc.bedsTotal} (${fmtPct(pct)})`}
                data={phc.series}
                keys={[{ key: 'bedsOccupied', label: 'Beds Occupied', color: pct > 85 ? '#dc2626' : pct > 70 ? '#ca8a04' : '#0d9488' }]}
                height={240}
                legend={false}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Beds;
