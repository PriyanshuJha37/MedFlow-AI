import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { fmtNumber } from '../../lib/format';
import { FootfallRow } from '../../types';

type FootfallField =
  | 'outpatientDelta'
  | 'admissionsDelta'
  | 'dischargesDelta'
  | 'triageMildDelta'
  | 'triageModerateDelta'
  | 'triageSevereDelta';

const quickGroups: { label: string; field: FootfallField; color: string }[] = [
  { label: 'Outpatient', field: 'outpatientDelta', color: 'teal' },
  { label: 'Admissions', field: 'admissionsDelta', color: 'blue' },
  { label: 'Discharges', field: 'dischargesDelta', color: 'green' },
  { label: 'Triage Mild', field: 'triageMildDelta', color: 'green' },
  { label: 'Triage Moderate', field: 'triageModerateDelta', color: 'yellow' },
  { label: 'Triage Severe', field: 'triageSevereDelta', color: 'red' },
];

const colorCls = (color: string) => {
  switch (color) {
    case 'teal':
    case 'emerald':
      return 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200';
    case 'blue':
      return 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200';
    case 'green':
      return 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200';
    case 'yellow':
      return 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200';
    case 'red':
      return 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200';
  }
};

const Footfall: React.FC = () => {
  const { pushToast } = useToast();
  const [today, setToday] = useState<FootfallRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingField, setSubmittingField] = useState<string | null>(null);

  const [form, setForm] = useState({
    outpatientDelta: 0,
    admissionsDelta: 0,
    dischargesDelta: 0,
    triageMildDelta: 0,
    triageModerateDelta: 0,
    triageSevereDelta: 0,
  });
  const [submittingCombined, setSubmittingCombined] = useState(false);

  const fetchToday = useCallback(async () => {
    try {
      const res = await apiClient.get<{ rows: FootfallRow[] }>('/staff/footfall/today');
      setToday(res.data.rows?.[0] || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const submitDelta = async (field: FootfallField, delta: number) => {
    setSubmittingField(`${field}-${delta}`);
    try {
      const body = {
        outpatientDelta: 0,
        admissionsDelta: 0,
        dischargesDelta: 0,
        triageMildDelta: 0,
        triageModerateDelta: 0,
        triageSevereDelta: 0,
        [field]: delta,
      };
      await apiClient.post('/staff/footfall', body);
      pushToast('success', `Recorded +${delta} ${field.replace('Delta', '')}`);
      await fetchToday();
    } catch (err: any) {
      pushToast('error', err?.response?.data?.message || 'Failed to record footfall');
    } finally {
      setSubmittingField(null);
    }
  };

  const submitCombined = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasAny = Object.values(form).some((v) => v !== 0);
    if (!hasAny) {
      pushToast('error', 'Enter at least one non-zero delta');
      return;
    }
    setSubmittingCombined(true);
    try {
      await apiClient.post('/staff/footfall', form);
      pushToast('success', 'Footfall entries recorded');
      setForm({
        outpatientDelta: 0,
        admissionsDelta: 0,
        dischargesDelta: 0,
        triageMildDelta: 0,
        triageModerateDelta: 0,
        triageSevereDelta: 0,
      });
      await fetchToday();
    } catch (err: any) {
      pushToast('error', err?.response?.data?.message || 'Failed to record footfall');
    } finally {
      setSubmittingCombined(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Footfall</h1>
        <p className="text-gray-600 mt-1">Log today's patient traffic and triage counts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Add</h2>
            <div className="space-y-4">
              {quickGroups.map((g) => (
                <div key={g.field}>
                  <p className="text-sm font-medium text-gray-700 mb-2">{g.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 5, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => submitDelta(g.field, n)}
                        disabled={submittingField === `${g.field}-${n}`}
                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition disabled:opacity-50 ${colorCls(
                          g.color
                        )}`}
                      >
                        {submittingField === `${g.field}-${n}` ? '…' : `+${n}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Combined Entry</h2>
            <form onSubmit={submitCombined} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { key: 'outpatientDelta', label: 'Outpatient' },
                    { key: 'admissionsDelta', label: 'Admissions' },
                    { key: 'dischargesDelta', label: 'Discharges' },
                    { key: 'triageMildDelta', label: 'Triage Mild' },
                    { key: 'triageModerateDelta', label: 'Triage Mod.' },
                    { key: 'triageSevereDelta', label: 'Triage Severe' },
                  ] as const
                ).map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input
                      type="number"
                      step="1"
                      value={form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                    />
                  </div>
                ))}
              </div>
              <button
                type="submit"
                disabled={submittingCombined}
                className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {submittingCombined ? 'Submitting…' : 'Submit All Changes'}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outpatients</p>
              <p className="text-3xl font-bold text-emerald-700 mt-2">
                {loading ? '—' : fmtNumber(today?.outpatient ?? 0)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Admissions</p>
              <p className="text-3xl font-bold text-slate-600 mt-2">
                {loading ? '—' : fmtNumber(today?.admissions ?? 0)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Discharges</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {loading ? '—' : fmtNumber(today?.discharges ?? 0)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Triage Breakdown (Today)</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-gray-700">Mild</span>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                  {loading ? '—' : fmtNumber(today?.triageMild ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm font-medium text-gray-700">Moderate</span>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-700">
                  {loading ? '—' : fmtNumber(today?.triageModerate ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-gray-700">Severe</span>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">
                  {loading ? '—' : fmtNumber(today?.triageSevere ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footfall;
