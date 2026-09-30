import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useInterval } from '../../hooks/useInterval';
import { fmtPct, fmtNumber, fmtTimeAgo } from '../../lib/format';
import { riskColour } from '../../lib/riskColour';
import {
  StaffMedicineRow,
  FootfallRow,
  BedsStatusRow,
  EmergencyRow,
} from '../../types';

const Dashboard: React.FC = () => {
  const [medicines, setMedicines] = useState<StaffMedicineRow[]>([]);
  const [footfall, setFootfall] = useState<FootfallRow | null>(null);
  const [beds, setBeds] = useState<BedsStatusRow | null>(null);
  const [emergencies, setEmergencies] = useState<EmergencyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [medRes, ffRes, bedsRes, emRes] = await Promise.all([
        apiClient.get<{ rows: StaffMedicineRow[] }>('/staff/medicines'),
        apiClient.get<{ rows: FootfallRow[] }>('/staff/footfall/today'),
        apiClient.get<{ rows: BedsStatusRow[] }>('/staff/beds/status'),
        apiClient.get<{ rows: EmergencyRow[] }>('/staff/emergencies'),
      ]);
      setMedicines(medRes.data.rows || []);
      setFootfall(ffRes.data.rows?.[0] || null);
      setBeds(bedsRes.data.rows?.[0] || null);
      setEmergencies(emRes.data.rows || []);
    } catch {
      // error handled by client interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useInterval(fetchAll, 15000);

  const totalMeds = medicines.length;
  const healthyMeds = medicines.filter((m) => m.currentQuantity > m.medicine.criticalLevel).length;
  const stockHealth = totalMeds > 0 ? Math.round((healthyMeds / totalMeds) * 100) : 0;
  const stockCol = riskColour(100 - stockHealth);

  const bedsPct = beds && beds.bedsTotal > 0 ? Math.round((beds.bedsOccupied / beds.bedsTotal) * 100) : 0;
  const bedsBarCol = bedsPct > 85 ? 'bg-red-500' : bedsPct > 70 ? 'bg-yellow-500' : 'bg-emerald-500';

  const staffPct = beds && beds.staffTotal > 0 ? Math.round((beds.staffOnDuty / beds.staffTotal) * 100) : 0;

  const activeEmergencies = emergencies.filter((e) => e.isActive);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Live status of your PHC operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500">Stock Health</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stockCol.bg} ${stockCol.text}`}>
              {healthyMeds}/{totalMeds} safe
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{fmtPct(stockHealth)}</p>
          <div className="mt-3 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${stockCol.text.replace('text-', 'bg-')}`}
              style={{ width: `${stockHealth}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500">Today's Footfall</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500">Outpatients</span>
              <span className="text-2xl font-bold text-emerald-700">{fmtNumber(footfall?.outpatient ?? 0)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500">Admissions</span>
              <span className="text-lg font-semibold text-slate-600">{fmtNumber(footfall?.admissions ?? 0)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500">Beds Occupancy</p>
            <span className="text-xs font-semibold text-gray-500">{fmtPct(bedsPct)}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {fmtNumber(beds?.bedsOccupied ?? 0)}
            <span className="text-lg font-medium text-gray-400"> / {fmtNumber(beds?.bedsTotal ?? 0)}</span>
          </p>
          <div className="mt-3 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${bedsBarCol}`} style={{ width: `${Math.min(bedsPct, 100)}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500">Staff On-Duty</p>
            <span className="text-xs font-semibold text-gray-500">{fmtPct(staffPct)}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {fmtNumber(beds?.staffOnDuty ?? 0)}
            <span className="text-lg font-medium text-gray-400"> / {fmtNumber(beds?.staffTotal ?? 0)}</span>
          </p>
          <div className="mt-3 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${staffPct}%` }} />
          </div>
        </div>
      </div>

      {activeEmergencies.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-lg font-bold text-red-800">Active Emergencies ({activeEmergencies.length})</h2>
          </div>
          <ul className="space-y-3">
            {activeEmergencies.map((e) => (
              <li
                key={e.id}
                className="bg-white rounded-lg border border-red-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{e.type}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        e.severity === 'high'
                          ? 'bg-red-100 text-red-700'
                          : e.severity === 'moderate'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {e.severity.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">
                      {e.patientCount} patient{e.patientCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  {e.notes && <p className="text-sm text-gray-600 mt-1">{e.notes}</p>}
                  <p className="text-xs text-gray-500 mt-2">Reported {fmtTimeAgo(e.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <div className="animate-pulse text-gray-500">Loading dashboard…</div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
