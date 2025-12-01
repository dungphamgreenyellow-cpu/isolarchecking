// === src/pages/Report.jsx — v8.5.2-LTS-Final ===
// ✅ Auto Period (start-end from log)
// ✅ Auto Baseline GHI by log month (Vietnam default)
// ✅ Integrates realPRCalculator v9.9.7-Pro (daily trend)
// ✅ Clean UX (no debug line)
// ✅ Pastel A4 layout

import React from "react";
import { useLocation } from "react-router-dom";
import { getMonthlyGHI } from "../data/ghiBaseline";
import { formatDateDisplay } from "../utils/date";
import { buildInverterAnalytics } from "../utils/inverterAnalytics";
import ReportHeader from "./ReportHeader";
import ReportPage1 from "./report/ReportPage1";
import ReportPage2 from "./report/ReportPage2";
import ReportPage3 from "./report/ReportPage3";

function fmtMonthRange(start, end) {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  return (
    s.toLocaleDateString("en-GB", { month: "short", year: "numeric" }) +
    " – " +
    e.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
  );
}
// Use shared formatter for consistency

export default function Report() {
  const location = useLocation();
  const { projectData } = location.state || {};

  if (!projectData)
    return (
      <div className="text-center mt-20 text-gray-500">No project data</div>
    );

  const proj = projectData || {};
  const log = proj.log || null;
  const irr = proj.irr || { dailyGHI: null };
  const gpsCountry = proj.gpsCountry;
  const actualProduction = log?.dailyProductionTotal || 0;
  const days = log ? Object.keys(log.dailyProduction || {}).length : 0;

  const [totalIrr, setTotalIrr] = React.useState(0);
  const inverterAnalytics = log ? buildInverterAnalytics(log) : null;

  React.useEffect(() => {
    (async () => {
      try {
        const parse = log || null;
        let month = new Date().getMonth() + 1;
        let reportDays = days || 15;
        if (parse && parse.firstDay && parse.lastDay) {
          month = new Date(parse.firstDay).getMonth() + 1;
          reportDays = Object.keys(parse.dailyProduction || {}).length || reportDays;
        }
        const baselineGHI = getMonthlyGHI(gpsCountry || "Vietnam", month) / 30;
        setTotalIrr(Math.round(baselineGHI * reportDays));
      } catch (err) {
        setTotalIrr(0);
      }
    })();
  }, [log, days, gpsCountry]);

  const dataForPages = {
    ...proj,
    log,
    pvsyst: proj.pvsyst || null,
    irr,
    actualProduction,
    totalIrr,
    inverterAnalytics,
  };

  return (
    <div className="w-full flex justify-center bg-[#f6f9ff] px-4 py-6">
      <div className="w-full max-w-[794px] mx-auto space-y-8">
        {/* PAGE 1 — restored classic layout */}
        <ReportPage1 data={dataForPages} />

        {/* PAGE BREAK */}
        <div className="page-break"></div>

        {/* PAGE 2 — INVERTER ANALYTICS */}
        <ReportPage2 data={dataForPages} inverterAnalytics={inverterAnalytics} />

        {/* PAGE BREAK */}
        <div className="page-break"></div>

        {/* PAGE 3 — DATA SOURCES & METHODOLOGY */}
        <ReportPage3 />
      </div>
    </div>
  );
}
