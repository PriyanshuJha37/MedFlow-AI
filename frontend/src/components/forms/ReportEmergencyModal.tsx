import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { EmergencyType, EmergencySeverity } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const emergencyTypes: EmergencyType[] = ['Dengue', 'Cardiac', 'Respiratory', 'MassCasualty', 'Other'];
const severities: { value: EmergencySeverity; label: string; cls: string }[] = [
  { value: 'low', label: 'Low', cls: 'bg-green-100 text-green-700 border-green-300 peer-checked:ring-green-500' },
  { value: 'moderate', label: 'Moderate', cls: 'bg-yellow-100 text-yellow-700 border-yellow-300 peer-checked:ring-yellow-500' },
  { value: 'high', label: 'High', cls: 'bg-red-100 text-red-700 border-red-300 peer-checked:ring-red-500' },
];

const ReportEmergencyModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { pushToast } = useToast();
  const [type, setType] = useState<EmergencyType>('Other');
  const [severity, setSeverity] = useState<EmergencySeverity>('moderate');
  const [patientCount, setPatientCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setType('Other');
      setSeverity('moderate');
      setPatientCount(1);
      setNotes('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (patientCount < 1) {
      pushToast('error', 'Patient count must be at least 1');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/staff/emergency', {
        type,
        severity,
        patientCount,
        notes: notes || undefined,
      });
      pushToast('success', 'Emergency reported successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      pushToast('error', err?.response?.data?.message || 'Failed to report emergency');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Report Emergency</h3>
              <p className="text-sm text-gray-600 mt-0.5">Alert administrators immediately</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EmergencyType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white"
            >
              {emergencyTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <div className="grid grid-cols-3 gap-2">
              {severities.map((s) => (
                <label
                  key={s.value}
                  className={`relative cursor-pointer rounded-lg border-2 p-3 text-center transition ${
                    severity === s.value
                      ? s.value === 'low'
                        ? 'border-green-500 ring-2 ring-green-200'
                        : s.value === 'moderate'
                        ? 'border-yellow-500 ring-2 ring-yellow-200'
                        : 'border-red-500 ring-2 ring-red-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="severity"
                    value={s.value}
                    checked={severity === s.value}
                    onChange={() => setSeverity(s.value)}
                    className="sr-only"
                  />
                  <span
                    className={`text-sm font-semibold ${
                      s.value === 'low'
                        ? 'text-green-700'
                        : s.value === 'moderate'
                        ? 'text-yellow-700'
                        : 'text-red-700'
                    }`}
                  >
                    {s.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient Count</label>
            <input
              type="number"
              min="1"
              step="1"
              value={patientCount}
              onChange={(e) => setPatientCount(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
            />
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
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Reporting…' : 'Report Emergency'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportEmergencyModal;
