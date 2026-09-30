import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import RiskBadge from '../../components/cards/RiskBadge';
import { fmtNumber } from '../../lib/format';
import { AdminMedicineRow } from '../../types';

type RiskFilter = 'any' | 'green' | 'yellow' | 'orange' | 'red';
type SortKey = 'currentQuantity' | 'dors' | 'riskScore';
type SortDir = 'asc' | 'desc';

const Medicines: React.FC = () => {
  const [rows, setRows] = useState<AdminMedicineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [phcFilter, setPhcFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('any');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('riskScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<{ rows: AdminMedicineRow[] }>('/admin/dashboard/medicines');
        setRows(res.data.rows || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const phcOptions = useMemo(() => {
    const set = new Map<number, string>();
    rows.forEach((r) => set.set(r.phcId, r.phcName));
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows.slice();

    if (phcFilter !== 'all') {
      list = list.filter((r) => String(r.phcId) === phcFilter);
    }

    if (riskFilter !== 'any') {
      list = list.filter((r) => {
        const score = r.riskScore;
        switch (riskFilter) {
          case 'green':
            return score <= 30;
          case 'yellow':
            return score > 30 && score <= 60;
          case 'orange':
            return score > 60 && score <= 80;
          case 'red':
            return score > 80;
          default:
            return true;
        }
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) => r.medicineName.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const diff = av - bv;
      return sortDir === 'asc' ? diff : -diff;
    });

    return list;
  }, [rows, phcFilter, riskFilter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'currentQuantity' ? 'asc' : 'desc');
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '';

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Medicines Matrix</h1>
        <p className="text-gray-600 mt-1">Cross-PHC medicine stock levels and risk analysis</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">PHC</label>
          <select
            value={phcFilter}
            onChange={(e) => setPhcFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white text-sm"
          >
            <option value="all">All PHCs</option>
            {phcOptions.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Risk Level</label>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white text-sm"
          >
            <option value="any">Any Risk</option>
            <option value="green">Green (0-30)</option>
            <option value="yellow">Yellow (31-60)</option>
            <option value="orange">Orange (61-80)</option>
            <option value="red">Red (81-100)</option>
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search Medicine</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by medicine name…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">PHC</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Medicine</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-700">Qty / Reorder / Critical</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-700">Daily Rate</th>
                <th
                  className={`text-right px-5 py-3 font-semibold text-gray-700 cursor-pointer select-none hover:bg-gray-100 ${
                    sortKey === 'dors' ? 'bg-gray-100' : ''
                  }`}
                  onClick={() => toggleSort('dors')}
                >
                  DoRS (days) {sortIndicator('dors')}
                </th>
                <th
                  className={`text-right px-5 py-3 font-semibold text-gray-700 cursor-pointer select-none hover:bg-gray-100 ${
                    sortKey === 'currentQuantity' ? 'bg-gray-100' : ''
                  }`}
                  onClick={() => toggleSort('currentQuantity')}
                >
                  Current Qty {sortIndicator('currentQuantity')}
                </th>
                <th
                  className={`text-left px-5 py-3 font-semibold text-gray-700 cursor-pointer select-none hover:bg-gray-100 ${
                    sortKey === 'riskScore' ? 'bg-gray-100' : ''
                  }`}
                  onClick={() => toggleSort('riskScore')}
                >
                  Risk Score {sortIndicator('riskScore')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-500">
                    Loading medicines…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-500">
                    No medicines match the current filters
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={`${r.phcId}-${r.medicineId}-${i}`} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{r.phcName}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{r.medicineName}</div>
                      <div className="text-xs text-gray-500">{r.category}</div>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">{fmtNumber(r.currentQuantity)}</span>
                      <span className="text-gray-400"> / {fmtNumber(r.reorderLevel)} / {fmtNumber(r.criticalLevel)}</span>
                      <span className="text-xs text-gray-400 block">{r.unit}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{r.dailyRate.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          r.dors < 3
                            ? 'text-red-600'
                            : r.dors < 7
                            ? 'text-orange-600'
                            : r.dors < 14
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                      >
                        {r.dors < 0 ? '∞' : `${r.dors}d`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {fmtNumber(r.currentQuantity)}
                    </td>
                    <td className="px-5 py-3">
                      <RiskBadge score={Math.min(100, Math.max(0, Math.round(r.riskScore)))} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Medicines;
