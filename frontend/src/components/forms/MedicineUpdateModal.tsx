import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { AdjustReason, StaffMedicineRow } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  medicine: StaffMedicineRow | null;
}

const reasons: { value: AdjustReason; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'dispensed', label: 'Dispensed' },
  { value: 'wasted', label: 'Wasted' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'transfer_out', label: 'Transfer Out' },
];

const MedicineUpdateModal: React.FC<Props> = ({ open, onClose, onSuccess, medicine }) => {
  const { pushToast } = useToast();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<AdjustReason>('received');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDelta(0);
      setReason('received');
    }
  }, [open]);

  if (!open || !medicine) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delta === 0) {
      pushToast('error', 'Please enter a non-zero quantity');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/staff/medicines/adjust', {
        medicineId: medicine.medicineId,
        delta,
        reason,
      });
      pushToast('success', `Quantity adjusted by ${delta > 0 ? '+' : ''}${delta} ${medicine.medicine.unit}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      pushToast('error', err?.response?.data?.message || 'Failed to adjust quantity');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Adjust Medicine</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {medicine.medicine.name} — {medicine.medicine.category}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              type="button"
            >
              ×
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity Change (use negative for deduction)
            </label>
            <input
              type="number"
              step="1"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current: {medicine.currentQuantity} {medicine.medicine.unit}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as AdjustReason)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
            >
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : 'Confirm Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MedicineUpdateModal;
