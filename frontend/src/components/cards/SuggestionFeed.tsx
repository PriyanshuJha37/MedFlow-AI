import React, { useMemo, useState } from 'react';
import { BedsSuggestion, MedicineSuggestion, StaffSuggestion, SuggestionResponse } from '../../types';
import { fmtNumber, fmtTimeAgo } from '../../lib/format';
import { useToast } from '../../hooks/useToast';
import apiClient from '../../api/client';

type Tab = 'medicines' | 'staff' | 'beds';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'medicines', label: 'Medicines', icon: '💊' },
  { key: 'staff', label: 'Staff', icon: '👩‍⚕️' },
  { key: 'beds', label: 'Beds', icon: '🛏️' },
];

interface Props {
  suggestions: SuggestionResponse;
}

const SuggestionFeed: React.FC<Props> = ({ suggestions }) => {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<Tab>('medicines');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const medsVisible = useMemo(
    () => suggestions.medicines.filter((m) => !dismissed.has(m.id)),
    [suggestions.medicines, dismissed]
  );
  const staffVisible = useMemo(
    () => suggestions.staff.filter((s) => !dismissed.has(s.id)),
    [suggestions.staff, dismissed]
  );
  const bedsVisible = useMemo(
    () => suggestions.beds.filter((b) => !dismissed.has(b.id)),
    [suggestions.beds, dismissed]
  );

  const countsByTab: Record<Tab, number> = {
    medicines: suggestions.medicines.length,
    staff: suggestions.staff.length,
    beds: suggestions.beds.length,
  };

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const approveMedicine = async (m: MedicineSuggestion) => {
    setApprovingId(m.id);
    try {
      const res = await apiClient.post<{ ok: boolean; proposal?: { id: number } }>(
        '/admin/transfers/propose',
        {
          sourcePhcId: m.sourcePhcId,
          destPhcId: m.destPhcId,
          medicineId: m.medicineId,
          proposedQty: m.proposedQty,
          rationale: m.rationale,
          riskScore: m.riskScore,
        }
      );
      if (res.data.ok) {
        pushToast(
          'success',
          `Transfer proposal #${res.data.proposal?.id ?? ''} created: ${m.medicineName} x${m.proposedQty} ${m.sourcePhcName} → ${m.destPhcName}`
        );
        setDismissed((prev) => new Set(prev).add(m.id));
      } else {
        pushToast('error', 'Failed to create transfer proposal');
      }
    } catch (err: any) {
      pushToast('error', err?.response?.data?.message || 'Failed to approve');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <span>📋</span> Redistribution Suggestions
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            AI-generated actions · updated {fmtTimeAgo(suggestions.generatedAt)}
          </p>
        </div>
        <div className="flex rounded-lg overflow-hidden ring-1 ring-gray-200 bg-gray-50">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition-all ${
                tab === t.key
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              <span
                className={`ml-1 rounded-full px-1.5 text-[10px] ${
                  tab === t.key ? 'bg-white/20' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {countsByTab[t.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[560px] overflow-y-auto divide-y divide-gray-100">
        {tab === 'medicines' &&
          (medsVisible.length === 0 ? (
            <EmptyState
              title="No medicine redistribution suggestions"
              subtitle={
                countsByTab.medicines > 0
                  ? 'All suggestions have been reviewed.'
                  : 'No imbalances detected across the network.'
              }
            />
          ) : (
            medsVisible.map((m) => (
              <MedicineRow
                key={m.id}
                m={m}
                approving={approvingId === m.id}
                onApprove={() => approveMedicine(m)}
                onDismiss={() => dismiss(m.id)}
              />
            ))
          ))}

        {tab === 'staff' &&
          (staffVisible.length === 0 ? (
            <EmptyState
              title="No staff reallocation suggestions"
              subtitle={
                countsByTab.staff > 0
                  ? 'All suggestions have been reviewed.'
                  : 'Staffing levels are balanced today.'
              }
            />
          ) : (
            staffVisible.map((s) => (
              <StaffRow key={s.id} s={s} onDismiss={() => dismiss(s.id)} />
            ))
          ))}

        {tab === 'beds' &&
          (bedsVisible.length === 0 ? (
            <EmptyState
              title="No bed transfer suggestions"
              subtitle={
                countsByTab.beds > 0
                  ? 'All suggestions have been reviewed.'
                  : 'Bed occupancy is within healthy thresholds.'
              }
            />
          ) : (
            bedsVisible.map((b) => (
              <BedsRow key={b.id} b={b} onDismiss={() => dismiss(b.id)} />
            ))
          ))}
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="p-10 text-center">
    <div className="text-3xl mb-2">✅</div>
    <div className="text-sm font-semibold text-gray-900">{title}</div>
    <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
  </div>
);

const riskBadge = (risk: number) => {
  if (risk >= 80) return { cls: 'bg-red-100 text-red-700 ring-red-200', label: 'Critical' };
  if (risk >= 65) return { cls: 'bg-amber-100 text-amber-700 ring-amber-200', label: 'High risk' };
  if (risk >= 50) return { cls: 'bg-yellow-100 text-yellow-700 ring-yellow-200', label: 'Medium' };
  return { cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200', label: 'Preventive' };
};

const MedicineRow: React.FC<{
  m: MedicineSuggestion;
  approving: boolean;
  onApprove: () => void;
  onDismiss: () => void;
}> = ({ m, approving, onApprove, onDismiss }) => {
  const risk = riskBadge(m.riskScore);
  return (
    <div className="p-4 hover:bg-emerald-50/30 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm">💊 {m.medicineName}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${risk.cls}`}
            >
              {risk.label} · {Math.round(m.riskScore)}
            </span>
            <span className="text-xs text-gray-500">
              Shortfall in ~{m.estimatedDaysShortfall} days
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-emerald-700">{m.sourcePhcName}</span>
            <span className="text-gray-400">({fmtNumber(m.sourceStock)} in stock)</span>
            <Arrow />
            <span className="font-semibold text-red-700">{m.destPhcName}</span>
            <span className="text-gray-400">
              ({fmtNumber(m.destStock)} / reorder {fmtNumber(m.destReorderLevel)})
            </span>
            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold">
              Transfer ×{fmtNumber(m.proposedQty)}
            </span>
          </div>
          <p className="text-[12px] text-gray-500 mt-2 leading-snug">{m.rationale}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-100"
          >
            Dismiss
          </button>
          <button
            onClick={onApprove}
            disabled={approving}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {approving ? 'Creating…' : 'Approve & propose transfer'}
          </button>
        </div>
      </div>
    </div>
  );
};

const StaffRow: React.FC<{ s: StaffSuggestion; onDismiss: () => void }> = ({ s, onDismiss }) => (
  <div className="p-4 hover:bg-emerald-50/30 transition-colors">
    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">
            👩‍⚕️ {s.role} reallocation · -{s.gapCount} deficit
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-semibold">
            ⚠️ UI-only (no DB write)
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-emerald-700">{s.sourcePhcName}</span>
          <span className="text-gray-400">(surplus)</span>
          <Arrow />
          <span className="font-semibold text-red-700">{s.destPhcName}</span>
          <span className="text-gray-400">(needs {s.gapCount} more)</span>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold">
            ~{s.distanceKm} km apart
          </span>
        </div>
        <p className="text-[12px] text-gray-500 mt-2 leading-snug">{s.rationale}</p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-100"
      >
        Dismiss
      </button>
    </div>
  </div>
);

const BedsRow: React.FC<{ b: BedsSuggestion; onDismiss: () => void }> = ({ b, onDismiss }) => (
  <div className="p-4 hover:bg-emerald-50/30 transition-colors">
    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">
            🛏️ Overflow diversion · {b.overflowAtDest} patients
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-semibold">
            ⚠️ UI-only (no DB write)
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-red-700">{b.destPhcName}</span>
          <span className="text-gray-400">(overflows by {b.overflowAtDest})</span>
          <Arrow />
          <span className="font-semibold text-emerald-700">{b.sourcePhcName}</span>
          <span className="text-gray-400">({b.freeBedsAtSource} beds free)</span>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold">
            ~{b.distanceKm} km
          </span>
        </div>
        <p className="text-[12px] text-gray-500 mt-2 leading-snug">{b.rationale}</p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-100"
      >
        Dismiss
      </button>
    </div>
  </div>
);

const Arrow: React.FC = () => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden
    className="w-3.5 h-3.5 text-emerald-600"
  >
    <path
      fillRule="evenodd"
      d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
      clipRule="evenodd"
    />
  </svg>
);

export default SuggestionFeed;
