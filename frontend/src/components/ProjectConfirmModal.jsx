// src/components/ProjectConfirmModal.jsx — sync initialData to form
import React, { useEffect, useState } from "react";
import { normalizeDateString, formatDateDisplay } from "../utils/date";

export default function ProjectConfirmModal({ open, initialData = {}, onConfirm, onClose }) {
  const [form, setForm] = useState(initialData || {});

  useEffect(() => {
    if (!open) return;
    setForm((f) => {
      const dc = initialData?.capacityDCkWp ?? initialData?.capacity_dc_kwp ?? f.capacityDCkWp;
      const codRaw = initialData?.codDate || initialData?.cod || initialData?.cod_date || f.codDate || "";
      return {
        siteName: initialData?.siteName || f.siteName || "",
        installedCapacity: initialData?.installedCapacity || (dc != null ? `${dc}` : f.installedCapacity || ""),
        codDate: normalizeDateString(codRaw),
        gamma: f.gamma || "0.34",
        degradation: f.degradation || "0.5",
      };
    });
  }, [open, initialData]);

  if (!open) return null;

  const change = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl p-8">
        <h3 className="text-2xl font-bold text-center text-blue-700 mb-6">Confirm Project Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="col-span-2 text-sm">
            <span className="text-gray-600">Site Name</span>
            <input
              className="mt-1 w-full rounded-xl px-3 py-2 bg-gray-100 text-gray-700"
              value={form.siteName || ""}
              onChange={() => {}}
              readOnly
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">Installed Capacity (kWp)</span>
            <input
              className="mt-1 w-full rounded-xl px-3 py-2 border border-gray-200"
              placeholder="e.g. 980"
              value={form.installedCapacity || ""}
              onChange={change("installedCapacity")}
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">COD Date</span>
            <input
              type="date"
              className="mt-1 w-full rounded-xl px-3 py-2 border border-gray-200"
              value={form.codDate || ""}
              onChange={change("codDate")}
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">γ (Temperature Coefficient, %/°C)</span>
            <input
              className="mt-1 w-full rounded-xl px-3 py-2 border border-gray-200"
              placeholder="0.34"
              value={form.gamma || ""}
              onChange={change("gamma")}
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">Degradation (%/year)</span>
            <input
              className="mt-1 w-full rounded-xl px-3 py-2 border border-gray-200"
              placeholder="0.5"
              value={form.degradation || ""}
              onChange={change("degradation")}
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ ...initialData, ...form })}
            className="px-5 py-2 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
