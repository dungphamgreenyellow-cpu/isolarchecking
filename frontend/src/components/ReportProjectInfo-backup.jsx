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
          {/* New display: manufacturer — unit × count (two lines) */}
          {(() => {
            const pv = project.pvArray || {};
            const pvDisplay = pv.moduleManufacturer || pv.moduleUnitWp || pv.moduleCount
              ? `${pv.moduleManufacturer || ""} — ${pv.moduleUnitWp || ""}Wp × ${pv.moduleCount ?? ""} units`.trim()
              : null;
            const invDisplay = pv.inverterManufacturer || pv.inverterUnit_kW || pv.inverterCount
              ? `${pv.inverterManufacturer || ""} — ${pv.inverterUnit_kW || ""}kWac × ${pv.inverterCount ?? ""} units`.trim()
              : null;

            return (
              <div>
                <div className="text-sm font-medium">PV:</div>
                <div className="text-sm mb-1">{pvDisplay || "-"}</div>

                <div className="text-sm font-medium mt-2">INV:</div>
                <div className="text-sm">{invDisplay || "-"}</div>
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}
