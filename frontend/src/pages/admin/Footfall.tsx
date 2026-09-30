import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import LineChartCard from '../../components/charts/LineChartCard';
import { FootfallHistoryResponse } from '../../types';

type DaysOption = 7 | 14 | 30;

const TAB_OPTIONS: { value: DaysOption; label: string }[] = [
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
];

const Footfall: React.FC = () => {
  const [days, setDays] = useState<DaysOption>(7);
  const [data, setData] = useState<FootfallHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (d: DaysOption) => {
    setLoading(true);
    try {
      const res = await apiClient.get<FootfallHistoryResponse>('/admin/history/footfall', {
        params: { days: d, phcId: 'all' },
      });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const aggKeys = [
    { key: 'outpatient', label: 'Outpatients', color: '#0d9488' },
    { key: 'admissions', label: 'Admissions', color: '#2563eb' },
    { key: 'discharges', label: 'Discharges', color: '#16a34a' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Footfall Analytics</h1>
          <p className="text-gray-600 mt-1">Patient traffic trends across all PHCs</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {TAB_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition ${
                days === opt.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <LineChartCard
        title="Aggregate Footfall"
        subtitle={`Combined across all PHCs · last ${days} days`}
        data={data?.aggregate ?? []}
        keys={aggKeys}
        height={320}
      />

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Per-PHC Outpatient Trends</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-56 bg-white rounded-xl border border-gray-200 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(data?.byPhc ?? []).map((phc) => (
              <LineChartCard
                key={phc.phcId}
                title={phc.phcName}
                subtitle="Outpatients"
                data={phc.series}
                keys={[{ key: 'outpatient', label: 'Outpatients', color: '#0d9488' }]}
                height={240}
                legend={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Footfall;
