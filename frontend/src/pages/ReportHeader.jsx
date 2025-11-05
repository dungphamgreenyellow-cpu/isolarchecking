import React, { useEffect, useState } from "react";

export default function ReportHeader({ pdfFile, excelFile }) {
  const [data, setData] = useState({
    siteName: "—",
    location: "—",
    installed: "—",
    module: "—",
    inverter: "—",
    cod: "—",
    periodText: "—",
    generatedAt: formatDate(new Date()),
  });

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
  function formatPeriod(start, end) {
    const sm = formatDate(start).split(" ")[1];
    const sy = start.getFullYear();
    const em = formatDate(end).split(" ")[1];
    const ey = end.getFullYear();
    return sy === ey ? `${sm} – ${em} ${ey}` : `${sm} ${sy} – ${em} ${ey}`;
  }

  /** ========== UI RENDER ========== **/
  return (
    <div className="flex flex-col items-center bg-white text-slate-800 relative min-h-[1123px]">
      <div className="w-[794px] bg-amber-50 border-b border-amber-200 px-10 py-8 shadow-sm">
        {/* Header Title */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[26px] font-bold text-slate-900 leading-tight">
              Site Performance Report
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Period: {data.periodText} • Generated: {data.generatedAt}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[16px] font-semibold text-amber-700 max-w-[360px] truncate" title={data.siteName}>
              {data.siteName}
            </p>
            <p className="text-sm text-slate-600">{data.location}</p>
          </div>
        </div>

        <div className="border-t border-amber-200 mb-6" />

        {/* Technical info */}
        <div className="grid grid-cols-4 gap-x-8 gap-y-3 text-[14px]">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Installed Capacity</p>
            <p className="font-semibold text-slate-900 mt-1">{data.installed}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">PV Module</p>
            <p className="font-semibold text-slate-900 mt-1 leading-snug">{data.module}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Inverter</p>
            <p className="font-semibold text-slate-900 mt-1 leading-snug">{data.inverter}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">COD</p>
            <p className="font-semibold text-slate-900 mt-1">{data.cod}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 right-[calc(50%-397px+1.5rem)] text-[12px] text-slate-400 italic">
        iSolarChecking • Automated PV Performance Analytics
      </div>
    </div>
  );
}
