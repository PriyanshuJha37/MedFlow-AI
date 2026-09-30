import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useInterval } from '../../hooks/useInterval';
import KPI from '../../components/cards/KPI';
import PHCCard from '../../components/cards/PHCCard';
import AlertFeed from '../../components/cards/AlertFeed';
import PHCMap from '../../components/maps/PHCMap';
import SuggestionFeed from '../../components/cards/SuggestionFeed';
import { fmtNumber, fmtPct } from '../../lib/format';
import { AdminDashboard, AlertRow, SuggestionResponse } from '../../types';

const EMPTY_SUGGESTIONS: SuggestionResponse = {
  medicines: [],
  staff: [],
  beds: [],
  generatedAt: new Date(0).toISOString(),
  analyticsConnected: false,
};

const Overview: React.FC = () => {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionResponse>(EMPTY_SUGGESTIONS);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, sugRes] = await Promise.all([
        apiClient.get<AdminDashboard>('/admin/dashboard'),
        apiClient.get<SuggestionResponse>('/admin/suggestions').catch(() => null),
      ]);
      setData(dashRes.data);
      if (sugRes?.data) setSuggestions(sugRes.data);
    } catch {
      // error already logged by the axios interceptor; keep stale data visible
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useInterval(fetchDashboard, 60000);

  const k = data?.kpis;
  const bedPct = k && k.totalBeds > 0 ? Math.round((k.occupiedBeds / k.totalBeds) * 100) : 0;
  const staffPct = k && k.totalStaff > 0 ? Math.round((k.onDutyStaff / k.totalStaff) * 100) : 0;
  const emAccent = (k?.activeEmergencies ?? 0) > 0 ? 'red' : 'green';

  const extraAlerts: AlertRow[] = data?.forecastAlerts ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-gray-600 mt-1">Cross-PHC monitoring dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI
          title="Total Beds / Occupied"
          value={loading ? '—' : `${fmtNumber(k?.occupiedBeds ?? 0)} / ${fmtNumber(k?.totalBeds ?? 0)}`}
          subValue={loading ? undefined : fmtPct(bedPct) + ' occupied'}
          accent={bedPct > 85 ? 'red' : bedPct > 70 ? 'yellow' : 'emerald'}
          progress={bedPct}
        />
        <KPI
          title="Staff / On-Duty"
          value={loading ? '—' : `${fmtNumber(k?.onDutyStaff ?? 0)} / ${fmtNumber(k?.totalStaff ?? 0)}`}
          subValue={loading ? undefined : fmtPct(staffPct) + ' on duty'}
          accent="emerald"
          progress={staffPct}
        />
        <KPI
          title="Active Emergencies"
          value={loading ? '—' : fmtNumber(k?.activeEmergencies ?? 0)}
          subValue={(k?.activeEmergencies ?? 0) > 0 ? 'Urgent response needed' : 'No active events'}
          accent={emAccent as any}
        />
        <KPI
          title="Avg Stock Health"
          value={loading ? '—' : fmtPct(k?.avgStockHealth ?? 0)}
          subValue={'Across ' + (data?.phcs.length ?? 0) + ' PHCs'}
          accent={
            (k?.avgStockHealth ?? 100) >= 70 ? 'green' : (k?.avgStockHealth ?? 100) >= 40 ? 'yellow' : 'red'
          }
          progress={k?.avgStockHealth ?? 0}
        />
      </div>

      <div>
        <PHCMap phcs={data?.phcs ?? []} />
      </div>

      <div>
        <SuggestionFeed suggestions={suggestions} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">PHC Status</h2>
            <span className="text-sm text-gray-500">{data?.phcs.length ?? 0} centres</span>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 bg-white rounded-xl border border-gray-200 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data?.phcs.map((phc) => (
                <PHCCard key={phc.id} phc={phc} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Alerts Feed</h2>
          <AlertFeed alerts={data?.alerts ?? []} extraAlerts={extraAlerts} />
        </div>
      </div>
    </div>
  );
};

export default Overview;
