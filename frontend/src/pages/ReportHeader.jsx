import React, { useState } from "react";

// Accept parsed values directly (gps, pvModel, inverterModel, firstDay, lastDay)
export default function ReportHeader(props) {
  const {
    siteName,
    gps,
    pvModel,
    inverterModel,
    installedCapacity,
    codDate,
    firstDay,
    lastDay,
  } = props;

  const [generatedAt] = useState(formatDate(new Date()));

  const periodBox = firstDay && lastDay ? `${firstDay} → ${lastDay}` : "—";
  const pvInvBox = `${pvModel || "—"} / ${inverterModel || "—"}`;

  // Bỏ parse PVSyst ở FE — dữ liệu sẽ được backend xử lý khi cần.

  // Removed XLSX-based Excel parsing — backend handles log parsing

  /** ========== HELPER FUNCTIONS ========== **/
  function normalizeText(t) {
    return t.replace(/\s+/g, " ").replace(/–/g, "-").replace(/°/g, "° ").trim();
  }
  function clean(s) {
    return String(s || "").replace(/\s{2,}/g, " ").replace(/\s*×\s*/g, " × ").trim();
  }
  function normalizeDate(txt) {
    if (!txt || txt === "—") return "—";
    txt = txt.replace(/\./g, "/").replace(/\-/g, "/").trim();
    const dmy = txt.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (dmy) {
      const [_, d, m, y] = dmy;
      const yyyy = y.length === 2 ? "20" + y : y;
      const date = new Date(`${yyyy}-${m}-${d}`);
      return formatDate(date);
    }
    return txt;
  }
  // Removed helpers used only by Excel parsing
  function formatDate(d) {
    return `${d.getDate().toString().padStart(2, "0")} ${[
      "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
    ][d.getMonth()]} ${d.getFullYear()}`;
  }
  // Removed old formatPeriod (unused after direct firstDay/lastDay display)

  /** ========== UI RENDER ========== **/
  return (
    <div className="w-full rounded-2xl shadow-sm px-6 py-4 md:px-8 md:py-6 bg-blue-600 text-white">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Site Performance Report</h1>
            <p className="text-xl font-semibold text-white mt-1 truncate" title={siteName}>{siteName || "—"}</p>
          </div>
          <div className="text-right text-xs md:text-sm text-white/80 leading-5">
            <p>Period: <span className="font-medium text-white">{periodBox}</span></p>
            <p>Report Day: <span className="font-medium text-white">{generatedAt}</span></p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-sm">
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Installed Capacity</p>
            <p className="font-semibold mt-1">{installedCapacity || "—"}</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">PV / INV</p>
            <p className="font-medium mt-1 leading-snug whitespace-normal break-words" title={pvInvBox}>{pvInvBox}</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">COD</p>
            <p className="font-semibold mt-1">{codDate || "—"}</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">GPS</p>
            <p className="font-medium mt-1 truncate" title={gps}>{gps || "—"}</p>
          </div>
        </div>
    </div>
  );
}
