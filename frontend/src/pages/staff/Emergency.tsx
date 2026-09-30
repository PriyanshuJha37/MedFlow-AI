import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { fmtDate, fmtTimeAgo } from '../../lib/format';
import ReportEmergencyModal from '../../components/forms/ReportEmergencyModal';
import { EmergencyRow, EmergencySeverity } from '../../types';

const sevStyle: Record<EmergencySeverity, string> = {
  low: 'bg-green-100 text-green-700 ring-green-200',
  moderate: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  high: 'bg-red-100 text-red-700 ring-red-200',
};

const Emergency: React.FC = () => {
  const { pushToast } = useToast();
  const [emergencies, setEmergencies] = useState<EmergencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchEmergencies = useCallback(async () => {
    try {
      const res = await apiClient.get<{ rows: EmergencyRow[] }>('/staff/emergencies');
      setEmergencies(res.data.rows || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmergencies();
  }, [fetchEmergencies]);

  const resolve = async (id: number) => {
    setResolvingId(id);
    try {
      await apiClient.post(`/staff/emergency/${id}/resolve`);
      pushToast('success', 'Emergency marked resolved');
      await fetchEmergencies();
    } catch (err: any) {
      pushToast('error', err?.response?.data?.message || 'Failed to resolve emergency');
    } finally {
      setResolvingId(null);
    }
  };

  const active = emergencies.filter((e) => e.isActive);
  const resolved = emergencies.filter((e) => !e.isActive);

  const sortedActive = [...active].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const sortedResolved = [...resolved].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const renderCard = (e: EmergencyRow) => (
    <div
      key={e.id}
      className={`bg-white rounded-xl border shadow-sm p-5 ${
        e.isActive ? 'border-red-200' : 'border-gray-200 opacity-80'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-lg">{e.type}</span>
            {e.isActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 ring-1 ring-red-200">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                ACTIVE
              </span>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${sevStyle[e.severity]}`}
            >
              {e.severity.toUpperCase()}
            </span>
            <span className="text-sm text-gray-500">
              {e.patientCount} patient{e.patientCount === 1 ? '' : 's'}
            </span>
          </div>
          {e.notes && <p className="mt-2 text-gray-600 text-sm">{e.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>Reported: {fmtDate(e.createdAt)} ({fmtTimeAgo(e.createdAt)})</span>
            {e.resolvedAt && <span>Resolved: {fmtDate(e.resolvedAt)}</span>}
            <span>PHC: {e.phc.name}</span>
          </div>
        </div>
        {e.isActive && (
          <div className="flex-shrink-0">
            <button
              onClick={() => resolve(e.id)}
              disabled={resolvingId === e.id}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
            >
              {resolvingId === e.id ? 'Resolving…' : 'Mark Resolved'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emergency Log</h1>
          <p className="text-gray-600 mt-1">Report and manage active emergencies at your PHC</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow-sm"
        >
          <span className="text-lg leading-none">+</span>
          Report Emergency
        </button>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Active Emergencies ({active.length})
          </h2>
        </div>
        {loading ? (
          <div className="text-gray-500 py-8 text-center bg-white rounded-xl border border-gray-200">
            Loading emergencies…
          </div>
        ) : sortedActive.length === 0 ? (
          <div className="text-gray-500 py-10 text-center bg-white rounded-xl border border-gray-200">
            No active emergencies. All clear.
          </div>
        ) : (
          <div className="space-y-3">{sortedActive.map(renderCard)}</div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Recently Resolved ({resolved.length})
        </h2>
        {sortedResolved.length === 0 ? (
          <div className="text-gray-500 py-8 text-center bg-white rounded-xl border border-gray-200">
            No resolved emergencies yet
          </div>
        ) : (
          <div className="space-y-3">{sortedResolved.slice(0, 10).map(renderCard)}</div>
        )}
      </section>

      <ReportEmergencyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchEmergencies}
      />
    </div>
  );
};

export default Emergency;
