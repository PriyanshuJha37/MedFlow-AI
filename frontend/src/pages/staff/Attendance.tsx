import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { fmtTimeAgo } from '../../lib/format';
import { AttendanceRow } from '../../types';

const STAFF_ROLES: readonly string[] = [
  'Doctor',
  'Nurse',
  'Pharmacist',
  'LabTech',
  'Admin',
  'Support',
] as const;

const Attendance: React.FC = () => {
  const { pushToast } = useToast();
  const { user } = useAuth();
  const [rosters, setRosters] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<number | null>(null);

  const isAdmin = user?.role === 'admin';

  const selfRosterId = useMemo<number | undefined>(() => {
    if (isAdmin) return undefined;
    if (!user || user.role !== 'phc_staff') return undefined;
    const displayName = user.displayName?.trim().toUpperCase();
    if (!displayName) return undefined;
    const match = rosters.find(
      (r) =>
        user.phcId === r.phcId &&
        r.staffMemberName.trim().toUpperCase() === displayName
    );
    return match?.id;
  }, [user, isAdmin, rosters]);

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await apiClient.get<{ rows: AttendanceRow[] }>('/staff/attendance');
      setRosters(res.data.rows || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const togglePresent = async (roster: AttendanceRow) => {
    const newPresent = !roster.isPresent;
    setTogglingId(roster.id);
    try {
      const res = await apiClient.post<{ ok: boolean; eventId: number; presentCount: number; isPresent: boolean }>(
        `/staff/attendance/${roster.id}`,
        { isPresent: newPresent }
      );
      setRosters((prev) =>
        prev.map((r) =>
          r.id === roster.id
            ? { ...r, isPresent: res.data.isPresent, lastMarked: new Date().toISOString() }
            : r
        )
      );
      pushToast(
        'success',
        `${roster.staffMemberName} marked ${newPresent ? 'Present' : 'Absent'}`
      );
    } catch (err: any) {
      pushToast('error', err?.response?.data?.message || 'Failed to update attendance');
    } finally {
      setTogglingId(null);
    }
  };

  const changeRole = async (roster: AttendanceRow, newRole: string) => {
    if (newRole === roster.staffRole) return;
    setChangingRoleId(roster.id);
    try {
      const res = await apiClient.post<{ ok: boolean; updated: boolean; roster: AttendanceRow; presentCount: number }>(
        `/staff/roster/${roster.id}/role`,
        { staffRole: newRole }
      );
      if (res.data.updated) {
        setRosters((prev) =>
          prev.map((r) =>
            r.id === roster.id
              ? { ...r, staffRole: newRole, lastMarked: new Date().toISOString() }
              : r
          )
        );
        pushToast('success', `${roster.staffMemberName} department changed to ${newRole}`);
      }
    } catch (err: any) {
      pushToast('error', err?.response?.data?.message || 'Failed to change department');
    } finally {
      setChangingRoleId(null);
    }
  };

  const presentCount = rosters.filter((r) => r.isPresent).length;
  const totalCount = rosters.length;
  const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Attendance</h1>
        <p className="text-gray-600 mt-1">Mark attendance for today's roster</p>
      </div>

      {!isAdmin && user?.role === 'phc_staff' && !selfRosterId && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <span className="mt-0.5">⚠️</span>
          <span>Your roster entry could not be matched — contact an administrator to update your department.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-medium text-gray-500">Present Now</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {presentCount}
            <span className="text-lg font-medium text-gray-400"> / {totalCount}</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">{pct}% attendance rate</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Name</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Department / Role</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Present Toggle</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Last Marked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-500">
                    Loading roster…
                  </td>
                </tr>
              ) : rosters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-500">
                    No staff roster found
                  </td>
                </tr>
              ) : (
                rosters.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{r.staffMemberName}</td>
                    <td className="px-5 py-3">
                      {isAdmin || r.id === selfRosterId ? (
                        <select
                          className="block w-full rounded-md border-0 py-1.5 pl-2 pr-8 text-sm font-medium text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed bg-white"
                          value={r.staffRole}
                          disabled={togglingId === r.id || changingRoleId === r.id}
                          onChange={(e) => changeRole(r, e.target.value)}
                        >
                          {STAFF_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                          {r.staffRole}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${
                          r.isPresent
                            ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                            : 'bg-gray-100 text-gray-700 ring-gray-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            r.isPresent ? 'bg-emerald-500' : 'bg-gray-400'
                          }`}
                        />
                        {r.isPresent ? 'Present' : 'Absent'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={r.isPresent}
                          disabled={togglingId === r.id || changingRoleId === r.id}
                          onChange={() => togglePresent(r)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {r.lastMarked ? fmtTimeAgo(r.lastMarked) : 'Never'}
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

export default Attendance;
