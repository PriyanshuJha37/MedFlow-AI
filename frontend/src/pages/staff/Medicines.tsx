import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import { fmtNumber } from '../../lib/format';
import MedicineUpdateModal from '../../components/forms/MedicineUpdateModal';
import { StaffMedicineRow } from '../../types';

const Medicines: React.FC = () => {
  const [medicines, setMedicines] = useState<StaffMedicineRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StaffMedicineRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchMeds = async () => {
    try {
      const res = await apiClient.get<{ rows: StaffMedicineRow[] }>('/staff/medicines');
      setMedicines(res.data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeds();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return medicines;
    const q = search.toLowerCase().trim();
    return medicines.filter((m) => m.medicine.name.toLowerCase().includes(q));
  }, [medicines, search]);

  const getRiskBadge = (m: StaffMedicineRow) => {
    const ratio = m.medicine.criticalLevel > 0 ? m.currentQuantity / m.medicine.criticalLevel : 999;
    if (ratio < 1) return { label: 'Critical', cls: 'bg-red-100 text-red-700 ring-red-200' };
    if (m.currentQuantity < m.medicine.reorderLevel)
      return { label: 'Low Stock', cls: 'bg-yellow-100 text-yellow-700 ring-yellow-200' };
    return { label: 'In Stock', cls: 'bg-green-100 text-green-700 ring-green-200' };
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medicines Inventory</h1>
          <p className="text-gray-600 mt-1">Manage stock levels for your PHC</p>
        </div>
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Search by medicine name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Medicine</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Category</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Unit</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-700">Current Qty</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-700">Reorder</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-700">Critical</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">
                    Loading medicines…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">
                    No medicines found
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const badge = getRiskBadge(m);
                  return (
                    <tr key={m.inventoryId} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{m.medicine.name}</td>
                      <td className="px-5 py-3 text-gray-600">{m.medicine.category}</td>
                      <td className="px-5 py-3 text-gray-600">{m.medicine.unit}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {fmtNumber(m.currentQuantity)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {fmtNumber(m.medicine.reorderLevel)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {fmtNumber(m.medicine.criticalLevel)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelected(m);
                            setModalOpen(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-medium text-sm hover:bg-emerald-100 transition"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MedicineUpdateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchMeds}
        medicine={selected}
      />
    </div>
  );
};

export default Medicines;
