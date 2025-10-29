// src/components/ReportProjectInfo.jsx
import React from "react";

export default function ReportProjectInfo({ data }) {
  const project = data || {};

  return (
    <section className="bg-[#2563EB] text-white rounded-2xl p-6 shadow-md">
      {/* === Header Title === */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Site Performance Report</h2>
          <p className="text-sm">
            <span className="font-semibold">{project.siteName || "Fuji Seal"}</span>
            {" • "}
            COD: {project.cod || "21 Dec 2022"}
          </p>
        </div>

        <div className="text-right text-xs mt-3 sm:mt-0">
          <p>
            <span className="opacity-80">Period:</span>{" "}
            {project.period || "Sep – Sep 2025"}
          </p>
          <p>
            <span className="opacity-80">Generated:</span>{" "}
            {project.generated || "16 Oct 2025"}
          </p>
        </div>
      </div>

      {/* === Info Cards === */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        {/* GPS */}
        <div className="col-span-4 bg-[#2563EB]/25 rounded-xl p-3">
          <p className="text-sm flex items-center gap-1">📍 GPS</p>
          <p className="text-lg font-semibold mt-1">
            {project.gps || "11.11°, 106.70°"}
          </p>
        </div>

        {/* Capacity */}
        <div className="col-span-2 bg-[#2563EB]/25 rounded-xl px-2 py-3">
          <p className="text-sm flex items-center gap-1">⚡ Capacity</p>
          <p className="text-lg font-semibold mt-1 truncate">
            {project.capacity || "978.25 kWp"}
          </p>
        </div>

        {/* PV / INV */}
        <div className="col-span-6 bg-[#2563EB]/25 rounded-xl p-3">
          <p className="text-sm flex items-center gap-1">🔧 PV / INV</p>
          <p className="text-sm leading-snug mt-1 break-keep whitespace-nowrap overflow-hidden text-ellipsis">
            {project.module || "JA Solar JAM72S30-545/MR"}{" "}
            {project.inverter ||
              "Huawei SUN2000-100KTL-M1-400Vac"}
          </p>
        </div>
      </div>
    </section>
  );
}
