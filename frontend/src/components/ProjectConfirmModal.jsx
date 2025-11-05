// src/components/ProjectConfirmModal.jsx — sync initialData to form
import React, { useEffect, useState } from "react";

export default function ProjectConfirmModal({ open, initialData = {}, onConfirm, onClose }) {
  const [form, setForm] = useState({
    siteName: "",
    installed: "",
    location: "",
    cod: "",
    module: "",
    inverter: "",
    tempCoeff: "0.34",
    degr: "0.5",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      siteName: initialData?.siteName || "",
      installed: initialData?.capacity || initialData?.installed || "",
      location: initialData?.location || "",
      cod: initialData?.cod || "",
      module: initialData?.pvModule || initialData?.module || "",
      inverter: initialData?.inverter || "",
      tempCoeff: "0.34",
      degr: "0.5",
    });
  }, [open, initialData]);

  if (!open) return null;

  const change = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Confirm Project Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-1 text-sm">
            <span className="text-gray-600">Site Name</span>
            <input className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.siteName} onChange={change("siteName")} />
          </label>
          <label className="col-span-1 text-sm">
            <span className="text-gray-600">Installed Capacity</span>
            <input className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.installed} onChange={change("installed")} />
          </label>

          <label className="col-span-1 text-sm">
            <span className="text-gray-600">Location (GPS)</span>
            <input className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.location} onChange={change("location")} />
          </label>
          <label className="col-span-1 text-sm">
            <span className="text-gray-600">COD / Report Date</span>
            <input className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.cod} onChange={change("cod")} />
          </label>

          <label className="col-span-2 text-sm">
            <span className="text-gray-600">PV Module</span>
            <input className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.module} onChange={change("module")} />
          </label>

          <label className="col-span-2 text-sm">
            <span className="text-gray-600">Inverter</span>
            <input className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.inverter} onChange={change("inverter")} />
          </label>

          <label className="col-span-1 text-sm">
            <span className="text-gray-600">Temperature Coefficient (γ, %/°C)</span>
            <input className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.tempCoeff} onChange={change("tempCoeff")} />
          </label>
          <label className="col-span-1 text-sm">
            <span className="text-gray-600">Annual Degradation (%/year)</span>
            <input className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.degr} onChange={change("degr")} />
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(form)}
            className="px-5 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
