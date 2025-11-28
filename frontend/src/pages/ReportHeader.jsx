import React, { useState } from "react";
import { formatDateDisplay, normalizeDateString } from "../utils/date";

// Accept a single project/report data object
export default function ReportHeader({ data = {}, reportDate }) {
  const [generatedAt] = useState(formatDateDisplay(new Date()));
  const repDay = reportDate || generatedAt;

  // a) Site Name
  const siteName =
    data.siteName ||
    data.pvSiteName ||
    data.projectName ||
    "—";

  // b) Installed Capacity (kWp)
  const installedCapacityRaw =
    data.installedCapacityKw ||
    data.installed_capacity_kWp ||
    data.dcCapacity ||
    data.capacity ||
    null;
  const installedCapacity =
    installedCapacityRaw != null && installedCapacityRaw !== ""
      ? `${installedCapacityRaw} kWp`
      : "—";

  // c) PV / INV
  // Build PV/INV display from parser `pvArray` object (manufacturer, unit, count)
  const pvArr = data.pvArray || {};
  const pvDisplay = (pvArr.moduleManufacturer || pvArr.moduleUnitWp || pvArr.moduleCount)
    ? `${pvArr.moduleManufacturer || ""} — ${pvArr.moduleUnitWp || ""}Wp × ${pvArr.moduleCount ?? ""} units`
    : "—";
  const invDisplay = (pvArr.inverterManufacturer || pvArr.inverterUnit_kW || pvArr.inverterCount)
    ? `${pvArr.inverterManufacturer || ""} — ${pvArr.inverterUnit_kW || ""}kWac × ${pvArr.inverterCount ?? ""} units`
    : "—";

  // d) COD
  const codRaw = data.cod_date || data.cod || null;
  const codDate = codRaw ? normalizeDateString(codRaw) : "—";

  // e) GPS
  const gps =
    data.gps ||
    (data.latitude && data.longitude
      ? `${data.latitude}, ${data.longitude}`
      : null);

  // f) Period (from log)
  const firstDay = data.firstDay || data.logFirstDay;
  const lastDay = data.lastDay || data.logLastDay;
  let periodBox = "Period: —";
  if (firstDay && lastDay) {
    if (firstDay === lastDay) {
      periodBox = `Period: ${formatDateLabel(firstDay)}`;
    } else {
      periodBox = `Period: ${formatDateLabel(firstDay)} → ${formatDateLabel(lastDay)}`;
    }
  }

  // Bỏ parse PVSyst ở FE — dữ liệu sẽ được backend xử lý khi cần.

  // Removed XLSX-based Excel parsing — backend handles log parsing

  /** ========== HELPER FUNCTIONS ========== **/
  // date formatting helpers

  /** ========== UI RENDER ========== **/
  return (
    <div className="w-full rounded-none shadow-sm px-6 py-4 md:px-8 md:py-6 bg-blue-600 text-white">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Site Performance Report</h1>
            <p className="text-xl font-semibold text-white mt-1 ml-1 truncate" title={siteName}>{siteName || "—"}</p>
          </div>
          <div className="text-right text-xs md:text-sm text-white/80 leading-5">
            <p><span className="font-medium text-white">{periodBox}</span></p>
            <p>Report Day: <span className="font-medium text-white">{repDay}</span></p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-sm">
          <div className="bg-white/10 border border-white/20 rounded-none px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Installed Capacity</p>
            <p className="font-semibold mt-1">{installedCapacity}</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-none px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">PV / INV</p>
              <div>
                <div className="text-sm font-medium">PV:</div>
                <div className="text-sm mb-1">{pvDisplay}</div>

                <div className="text-sm font-medium mt-2">INV:</div>
                <div className="text-sm">{invDisplay}</div>
              </div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-none px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">COD</p>
            <p className="font-semibold mt-1">{codDate}</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-none px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">GPS</p>
            <p className="font-medium mt-1 truncate" title={gps}>{gps || "—"}</p>
          </div>
        </div>
    </div>
  );
}
