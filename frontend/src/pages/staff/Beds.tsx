import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { fmtNumber, fmtPct } from '../../lib/format';
import { BedsStatusRow, BedsAdjustReason } from '../../types';

const Beds: React.FC = () => {
  const { pushToast } = useToast();
  const [status, setStatus] = useState<BedsStatusRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<{ rows: BedsStatusRow[] }>('/staff/beds/status');
      setStatus(res.data.rows?.[0] || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const adjust = async (delta: number, reason: BedsAdjustReason, key: string) => {
    setSubmittingKey(key);
    try {
      await apiClient.post('/staff/beds/adjust', { occupiedDelta: delta, reason });
      pushToast('success', `Bed count adjusted by ${delta > 0 ? '+' : ''}${delta}`);
      await fetchStatus();
    } catch (err: any) {
      pushToast('error', err?.response?.data?.message || 'Failed to adjust beds');
    } finally {
      setSubmittingKey(null);
    }
  };

  const pct = status && status.bedsTotal > 0 ? Math.round((status.bedsOccupied / status.bedsTotal) * 100) : 0;
  const barColor = pct > 85 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-emerald-500';
  const textColor = pct > 85 ? 'text-red-600' : pct > 70 ? 'text-yellow-600' : 'text-emerald-700';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Beds Management</h1>
        <p className="text-gray-600 mt-1">Track and update bed occupancy in real-time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Beds Occupancy</p>
              <p className={`text-5xl font-bold mt-2 ${textColor}`}>
                {loading ? '—' : fmtNumber(status?.bedsOccupied ?? 0)}
                <span className="text-2xl font-medium text-gray-400">
                  {' '}
                  / {loading ? '—' : fmtNumber(status?.bedsTotal ?? 0)}
                </span>
              </p>
              <p className={`mt-2 text-sm font-semibold ${textColor}`}>
                {loading ? '—' : fmtPct(pct)} occupied
              </p>
            </div>
            {pct > 85 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 ring-1 ring-red-200">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                High Capacity Alert
              </span>
            )}
          </div>
          <div className="h-5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          {pct > 85 && (
            <p className="mt-3 text-sm text-red-600">
              Bed occupancy is critically high. Consider transfers or activating emergency protocols.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-medium text-gray-500">Emergency Reserved Beds</p>
          <p className="text-5xl font-bold mt-2 text-orange-600">
            {loading ? '—' : fmtNumber(status?.bedsEmergencyReserved ?? 0)}
          </p>
          <div className="mt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Staff On-Duty</span>
              <span className="font-semibold text-gray-900">
                {loading ? '—' : `${fmtNumber(status?.staffOnDuty ?? 0)} / ${fmtNumber(status?.staffTotal ?? 0)}`}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Active Emergency</span>
              <span
                className={`font-semibold ${
                  status?.activeEmergency ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {loading ? '—' : status?.activeEmergency ? 'Yes' : 'None'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Occupy Beds (Admissions)</h2>
          <div className="flex flex-wrap gap-2">
            {[1, 5, 10].map((n) => (
              <button
                key={`occ-${n}`}
                onClick={() => adjust(n, 'admission', `occ-${n}`)}
                disabled={submittingKey === `occ-${n}`}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {submittingKey === `occ-${n}` ? '…' : `+${n} Occupy`}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Discharge Beds</h2>
          <div className="flex flex-wrap gap-2">
            {[-1, -5, -10].map((n) => (
              <button
                key={`dis-${n}`}
                onClick={() => adjust(n, 'discharge', `dis-${n}`)}
                disabled={submittingKey === `dis-${n}`}
                className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {submittingKey === `dis-${n}` ? '…' : `${n} Discharge`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Beds;
