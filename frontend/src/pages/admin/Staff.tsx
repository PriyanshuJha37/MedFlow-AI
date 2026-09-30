import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import { AdminStaffResponse, RosterRow } from '../../types';
import { fmtNumber, fmtPct } from '../../lib/format';

type RoleFilter = 'all' | string;
type PresentFilter = 'all' | 'present' | 'absent';

const Staff: React.FC = () => {
  const [data, setData] = useState<AdminStaffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [presentFilter, setPresentFilter] = useState<PresentFilter>('all');
  const [expandedPHCs, setExpandedPHCs] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<AdminStaffResponse>('/admin/dashboard/staff');
        setData(res.data);
        setExpandedPHCs(new Set((res.data.summary ?? []).map((s) => s.phcId)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    (data?.rosters ?? []).forEach((r) => set.add(r.staffRole));
    return Array.from(set).sort();
  }, [data]);

  const filteredRosters = useMemo(() => {
    let list = data?.rosters ?? [];
    if (roleFilter !== 'all') {
      list = list.filter((r) => r.staffRole === roleFilter);
    }
    if (presentFilter === 'present') {
      list = list.filter((r) => r.isPresent);
    } else if (presentFilter === 'absent') {
      list = list.filter((r) => !r.isPresent);
    }
    return list;
  }, [data, roleFilter, presentFilter]);

  const rostersByPHC = useMemo(() => {
    const map = new Map<number, RosterRow[]>();
    filteredRosters.forEach((r) => {
      const list = map.get(r.phcId) ?? [];
      list.push(r);
      map.set(r.phcId, list);
    });
    return map;
  }, [filteredRosters]);

  const togglePHC = (id: number) => {
    setExpandedPHCs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Dashboard</h1>
        <p className="text-gray-600 mt-1">Attendance overview and roster per PHC</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">PHC Summaries</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading
            ? [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-36 bg-white rounded-xl border border-gray-200 animate-pulse"
                />
              ))
            : (data?.summary ?? []).map((s) => {
                const pct = s.staffTotal > 0 ? Math.round((s.staffOnDuty / s.staffTotal) * 100) : 0;
                const barCol =
                  pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div
                    key={s.phcId}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900">{s.name}</h3>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          pct >= 80
                            ? 'bg-green-100 text-green-700'
                            : pct >= 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {fmtPct(pct)}
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 mb-2">
                      {fmtNumber(s.staffOnDuty)}
                      <span className="text-lg font-medium text-gray-400">
                        {' '}
                        / {fmtNumber(s.staffTotal)}
                      </span>
                    </p>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barCol}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">On duty / Total staff</p>
                  </div>
                );
              })}
        </div>
      </section>

      <section>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Roster Details</h2>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm text-sm">
              <button
                onClick={() => setPresentFilter('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  presentFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setPresentFilter('present')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  presentFilter === 'present'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Present
              </button>
              <button
                onClick={() => setPresentFilter('absent')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  presentFilter === 'absent'
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Absent
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              roleFilter === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setRoleFilter('all')}
          >
            All Roles
          </span>
          {roleOptions.map((role) => (
            <span
              key={role}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                roleFilter === role
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setRoleFilter(role)}
            >
              {role}
            </span>
          ))}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-200">
              Loading staff…
            </div>
          ) : (data?.summary ?? []).length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-200">
              No staff data available
            </div>
          ) : (
            (data?.summary ?? []).map((s) => {
              const rosters = rostersByPHC.get(s.phcId) ?? [];
              const expanded = expandedPHCs.has(s.phcId);
              return (
                <div
                  key={s.phcId}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => togglePHC(s.phcId)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center text-sm transition-transform ${
                          expanded ? 'rotate-90' : ''
                        }`}
                      >
                        ▶
                      </span>
                      <span className="font-semibold text-gray-900">{s.name}</span>
                      <span className="text-xs text-gray-500">
                        {rosters.length} roster{rosters.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {fmtNumber(s.staffOnDuty)} / {fmtNumber(s.staffTotal)} on duty (
                      {fmtPct(s.staffOnDutyPct)})
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-gray-100 overflow-x-auto">
                      {rosters.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-500">
                          No roster entries match the current filters
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-700">
                            <tr>
                              <th className="text-left px-5 py-2.5 font-semibold">Name</th>
                              <th className="text-left px-5 py-2.5 font-semibold">Role</th>
                              <th className="text-left px-5 py-2.5 font-semibold">PHC</th>
                              <th className="text-left px-5 py-2.5 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {rosters.map((r) => (
                              <tr key={r.id} className="hover:bg-gray-50">
                                <td className="px-5 py-3 font-medium text-gray-900">
                                  {r.staffMemberName}
                                </td>
                                <td className="px-5 py-3 text-gray-600">{r.staffRole}</td>
                                <td className="px-5 py-3 text-gray-600">{r.phc.name}</td>
                                <td className="px-5 py-3">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${
                                      r.isPresent
                                        ? 'bg-green-100 text-green-700 ring-green-200'
                                        : 'bg-gray-100 text-gray-600 ring-gray-200'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                        r.isPresent ? 'bg-green-500' : 'bg-gray-400'
                                      }`}
                                    />
                                    {r.isPresent ? 'Present' : 'Absent'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default Staff;
