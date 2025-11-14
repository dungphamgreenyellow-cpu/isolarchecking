import React, { useState } from "react";

// Accept parsed values directly (gps, pvModel, inverterModel, firstDay, lastDay)
export default function ReportHeader({
  siteName = "—",
  gps = "—",
  pvModel = "—",
  inverterModel = "—",
  installedCapacity = "—",
  codDate = "—",
  firstDay = null,
  lastDay = null,
}) {
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
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[22px] md:text-[24px] font-bold leading-tight">
              Site Performance Report
            </h1>
            <p className="text-xs md:text-sm text-white/80 mt-1">
              Period: <span className="font-medium text-white">{periodBox}</span> • Generated: <span className="font-medium text-white">{generatedAt}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[15px] md:text-[16px] font-semibold max-w-[360px] truncate" title={siteName}>
              {siteName}
            </p>
            <p className="text-xs md:text-sm text-white/80">{gps || "—"}</p>
          </div>
        </div>
        <div className="grid gap-3 md:gap-5 mt-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 text-sm">
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Installed Capacity</p>
            <p className="font-semibold mt-1">{installedCapacity || "—"}</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">PV / INV</p>
            <p className="font-medium mt-1 leading-snug truncate" title={pvInvBox}>{pvInvBox}</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">COD</p>
            <p className="font-semibold mt-1">{codDate || "—"}</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">GPS</p>
            <p className="font-medium mt-1 truncate" title={gps}>{gps || "—"}</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Period</p>
            <p className="font-semibold mt-1">{periodBox}</p>
          </div>
        </div>
    </div>
  );
}
