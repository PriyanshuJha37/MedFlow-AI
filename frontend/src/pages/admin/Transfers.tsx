import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { fmtNumber, fmtTimeAgo } from '../../lib/format';
import { TransferListResponse, TransferRow, TransferStatus } from '../../types';

const FILTERS: Array<{ key: TransferStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'proposed', label: 'Proposed' },
  { key: 'approved', label: 'Approved' },
  { key: 'executed', label: 'Executed' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_STYLES: Record<TransferStatus, string> = {
  proposed: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-gray-100 text-gray-700 ring-gray-200',
  executed: 'bg-emerald-700 text-white ring-emerald-800',
};

const RISK_STYLE = (risk: number) =>
  risk >= 85
    ? 'bg-red-100 text-red-800 ring-red-200'
    : risk >= 65
    ? 'bg-orange-100 text-orange-800 ring-orange-200'
    : risk >= 45
    ? 'bg-amber-100 text-amber-800 ring-amber-200'
    : 'bg-emerald-100 text-emerald-800 ring-emerald-200';

const ALLOWED_ACTIONS: Record<TransferStatus, Array<{ next: TransferStatus; label: string; className: string }>> = {
  proposed: [
    { next: 'approved', label: 'Approve', className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    { next: 'rejected', label: 'Reject', className: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
  approved: [
    { next: 'executed', label: 'Mark as Executed', className: 'bg-emerald-700 hover:bg-emerald-800 text-white' },
    { next: 'rejected', label: 'Cancel', className: 'bg-gray-500 hover:bg-gray-600 text-white' },
  ],
  rejected: [],
  executed: [],
};

const Transfers: React.FC = () => {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TransferListResponse>({ rows: [], counts: {} });
  const [filter, setFilter] = useState<TransferStatus | 'all'>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const res = await apiClient.get<TransferListResponse>('/admin/transfers', { params });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filtered = useMemo(() => data.rows, [data.rows]);
  const counts = data.counts || {};

  const patchStatus = async (row: TransferRow, next: TransferStatus) => {
    setBusyId(row.id);
    try {
      const res = await apiClient.patch<{ ok: boolean; error?: string }>(`/admin/transfers/${row.id}/status`, { status: next });
      if (res.data.ok) {
        pushToast('success', `Transfer #${row.id} → ${next.toUpperCase()}`);
        await fetchList();
      } else {
        pushToast('error', res.data.error || 'Action failed');
      }
    } catch (err: any) {
      pushToast('error', err?.response?.data?.error || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medicine Transfers</h1>
          <p className="text-gray-600 mt-1">Approve and track cross-PHC redistribution proposals</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchList}
            className="px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: counts.total ?? 0, accent: 'bg-slate-900 text-white' },
          { label: 'Proposed', value: counts.proposed ?? 0, accent: 'bg-amber-600 text-white' },
          { label: 'Approved', value: counts.approved ?? 0, accent: 'bg-emerald-600 text-white' },
          { label: 'Executed', value: counts.executed ?? 0, accent: 'bg-emerald-800 text-white' },
          { label: 'Rejected', value: counts.rejected ?? 0, accent: 'bg-gray-500 text-white' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 shadow-sm p-4 bg-white">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{k.label}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold ${k.accent}`}>
                {fmtNumber(k.value)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === 'all' ? counts.total ?? 0 : counts[f.key] ?? 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">ID</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Medicine</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Source → Destination</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Qty</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Risk</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Timing</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">
                    Loading transfer records…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">
                    No transfers found in this view. Approve suggestions from the Overview to create proposals.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const actions = ALLOWED_ACTIONS[r.status] || [];
                  const busy = busyId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 align-top">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">#{String(r.id).padStart(4, '0')}</td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{r.medicine.name}</div>
                        <div className="text-xs text-gray-500">Unit: {r.medicine.unit} · by {r.proposedBy.toUpperCase()}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold max-w-[140px] truncate" title={r.sourcePhc.name}>
                            {r.sourcePhc.name}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold max-w-[140px] truncate" title={r.destPhc.name}>
                            {r.destPhc.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">{r.sourcePhc.city} → {r.destPhc.city}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-gray-900">{fmtNumber(r.proposedQty)}</span>
                        <span className="text-xs text-gray-500 ml-1">{r.medicine.unit}s</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ring-1 ring-inset ${RISK_STYLE(r.riskScore)}`}>
                          Risk {Math.round(r.riskScore)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 space-y-0.5">
                        <div>Created {fmtTimeAgo(new Date(r.createdAt))}</div>
                        {r.decidedAt && <div>Decided {fmtTimeAgo(new Date(r.decidedAt))}</div>}
                        {r.executedAt && <div>Executed {fmtTimeAgo(new Date(r.executedAt))}</div>}
                        {r.admin && <div>by {r.admin.displayName}</div>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {actions.length === 0 ? (
                            <span className="text-[11px] text-gray-400 italic">no actions</span>
                          ) : (
                            actions.map((a) => (
                              <button
                                key={a.next}
                                onClick={() => patchStatus(r, a.next)}
                                disabled={busy}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition disabled:opacity-50 ${a.className}`}
                              >
                                {busy ? '…' : a.label}
                              </button>
                            ))
                          )}
                        </div>
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
  );
};

export default Transfers;
