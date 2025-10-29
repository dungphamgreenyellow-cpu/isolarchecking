// === src/pages/Report.jsx — v8.5.2-LTS-Final ===
// ✅ Auto Period (start-end from log)
// ✅ Auto Baseline GHI by log month (Vietnam default)
// ✅ Integrates realPRCalculator v9.9.7-Pro (daily trend)
// ✅ Clean UX (no debug line)
// ✅ Pastel A4 layout

import React from "react";
import { useLocation } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  computeRealPerformanceRatio,
  computeDailyRPRSeries,
} from "../utils/realPRCalculator";
import { checkFusionSolarPeriod } from "../utils/fusionSolarParser";
import { getMonthlyGHI } from "../data/ghiBaseline";

function fmtMonthRange(start, end) {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  return s.toLocaleDateString("en-GB", { month: "short", year: "numeric" }) +
    " – " +
    e.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
function todayStr() {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Report() {
  const { state } = useLocation();
  const projectData = state?.projectData;
  const files = state?.files || {};
  const logFile = files?.logFile || null;
  const irrFile = files?.irrFile || null;

  const [realPR, setRealPR] = React.useState("—");
  const [dailyRPR, setDailyRPR] = React.useState([]);
  const [loadingPR, setLoadingPR] = React.useState(false);
  const [periodText, setPeriodText] = React.useState("—");
  const [generatedText, setGeneratedText] = React.useState(todayStr());
  const [totalIrr, setTotalIrr] = React.useState(0);

  if (!projectData)
    return (
      <div className="text-center mt-20 text-gray-500">
        No project data found. Please go back and analyze again.
      </div>
    );

  const {
    siteName,
    location: gps,
    installed,
    module,
    inverter,
    cod,
    actualProduction,
    irradiation: uploadedIrr,
    days,
    gpsCountry,
  } = projectData;

  // === Auto baseline GHI based on log month ===
  React.useEffect(() => {
    (async () => {
      if (!logFile) return;
      try {
        const parsed = await checkFusionSolarPeriod(logFile);
        const month = parsed?.startDate
          ? new Date(parsed.startDate).getMonth() + 1
          : new Date().getMonth() + 1;
        const baselineGHI = getMonthlyGHI(gpsCountry || "Vietnam", month) / 30;
        const reportDays = parsed?.days || days || 15;
        setTotalIrr(Math.round(baselineGHI * reportDays));
        setPeriodText(fmtMonthRange(parsed.startDate, parsed.endDate));
        setGeneratedText(todayStr());
      } catch {
        setPeriodText("—");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logFile]);

  const now = new Date();
  const country = gpsCountry || "Vietnam";
  const monthNow = now.getMonth() + 1;
  const baselineGHI = getMonthlyGHI(country, monthNow) / 30;
  const reportDays = days || 15;
  const actualProd = Number(actualProduction) || 0;
  const capKWp =
    Number(String(installed || "").replace(/[^\d.]/g, "")) || 0;
  const irr = Number(totalIrr) || 0;
  const rprRef =
    capKWp > 0 && irr > 0
      ? ((actualProd / (capKWp * irr)) * 100).toFixed(2)
      : "0.00";

  // === Compute Real PR + Daily Trend ===
  React.useEffect(() => {
    (async () => {
      if (!logFile || !capKWp) {
        setRealPR(rprRef);
        setDailyRPR([]);
        return;
      }
      try {
        setLoadingPR(true);
        const parsed = await checkFusionSolarPeriod(logFile);
        const logMonth = parsed?.startDate
          ? new Date(parsed.startDate).getMonth() + 1
          : new Date().getMonth() + 1;
        const ghiDay = getMonthlyGHI(gpsCountry || "Vietnam", logMonth) / 30;
        const dailyGHI = Array.from(
          { length: parsed?.days || reportDays },
          () => ghiDay
        );
        const rpr = computeRealPerformanceRatio(parsed, dailyGHI, capKWp);
        const series = computeDailyRPRSeries(parsed, dailyGHI, capKWp);
        setRealPR(rpr);
        setDailyRPR(series);
      } catch (err) {
        console.error("RPR calc error:", err);
        setRealPR("0.00");
      } finally {
        setLoadingPR(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logFile, irrFile, capKWp]);

  const getFontSizeForInverter = (text = "") => {
    const len = text.length;
    const isMobile =
      typeof window !== "undefined" && window.innerWidth < 768;
    if (isMobile) {
      if (len > 55) return "10.5px";
      if (len > 45) return "11.5px";
      if (len > 35) return "12px";
      return "13px";
    } else {
      if (len > 55) return "11.5px";
      if (len > 45) return "12.5px";
      if (len > 35) return "13.5px";
      return "15px";
    }
  };

  return (
    <div className="bg-white min-h-screen flex flex-col items-center text-gray-800">
      {/* === HEADER === */}
      <div className="w-full max-w-[850px] bg-[#2563EB] rounded-lg shadow-md px-6 md:px-10 py-6 text-white">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-3">
          <div>
            <h1 className="text-[22px] md:text-[24px] font-bold tracking-tight">
              Site Performance Report
            </h1>
            <div className="h-[3px] w-14 bg-white/80 rounded-full mt-1 mb-2"></div>
            <div className="flex flex-wrap items-center gap-2 text-sm md:text-base">
              <p className="font-semibold">{siteName || "Unnamed Site"}</p>
              <p className="text-gray-100">
                • COD:{" "}
                <span className="font-medium text-white">{cod || "--"}</span>
              </p>
            </div>
          </div>
          <div className="text-left md:text-right text-xs text-gray-100 leading-5 mt-3 md:mt-1">
            <p>
              Period:{" "}
              <span className="font-medium text-white">{periodText}</span>
            </p>
            <p>
              Generated:{" "}
              <span className="font-medium text-white">{generatedText}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:gap-5 mt-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-[0.9fr_1fr_1.6fr]">
          <div className="bg-white/10 border border-white/25 rounded-xl px-5 py-3">
            <p className="text-[13px] text-gray-200 font-medium mb-1">📍 GPS</p>
            <p className="text-white font-medium text-sm md:text-base">
              {gps || "—"}
            </p>
          </div>
          <div className="bg-white/10 border border-white/25 rounded-xl px-5 py-3">
            <p className="text-[13px] text-gray-200 font-medium mb-1">
              ⚡ Capacity
            </p>
            <p className="text-white font-semibold text-sm md:text-base">
              {installed || "—"}
            </p>
          </div>
          <div className="bg-white/10 border border-white/25 rounded-xl px-5 py-3">
            <p className="text-[13px] text-gray-200 font-medium mb-1">
              🔧 PV / INV
            </p>
            <div className="text-white font-medium leading-snug">
              <p className="truncate text-[12px] md:text-[14px]">
                {module || "—"}
              </p>
              <p
                className="whitespace-normal overflow-hidden text-[12px] md:text-[14px]"
                style={{ fontSize: getFontSizeForInverter(inverter) }}
              >
                {inverter || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* === SUMMARY === */}
      <div className="w-full max-w-[850px] bg-[#F9FBFF] rounded-lg shadow p-6 mb-6 mt-5">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">
          Summary &amp; Performance Trend
        </h2>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Cards */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            {[
              {
                title: ["Actual", "Production"],
                value: (actualProd || 0).toLocaleString(),
                unit: "kWh",
                color: "#9CC9FF",
              },
              {
                title: ["Total", "Irradiation"],
                value: totalIrr,
                unit: "kWh/m²",
                color: "#FFF3B0",
              },
              {
                title: ["Real", "Performance Ratio"],
                value: loadingPR ? "…" : realPR,
                unit: "%",
                color: "#E6C4FF",
              },
              {
                title: ["Performance", "Ratio"],
                value: rprRef,
                unit: "%",
                color: "#B9FBC0",
              },
            ].map((c, i) => (
              <div
                key={i}
                className="rounded-2xl shadow-sm px-4 py-4 flex flex-col items-center justify-center text-center"
                style={{ backgroundColor: c.color }}
              >
                <div className="text-sm font-medium text-gray-700 leading-tight whitespace-pre-line">
                  {c.title.join("\n")}
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-gray-800 leading-tight">
                    {c.value}
                    <span className="text-base font-semibold text-gray-700 ml-1">
                      {c.unit}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="flex-1 bg-[#FFFFFF] rounded-2xl shadow-sm p-4">
            <p className="text-sm font-medium text-gray-700 mb-2 text-center">
              Daily RPR (%) Trend
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={
                  dailyRPR.length > 0
                    ? dailyRPR
                    : [{ date: "01", RPR: Number(realPR) || 0 }]
                }
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="RPR"
                  stroke="#66B2FF"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {!irrFile && (
          <p className="text-left text-gray-500 italic text-xs mt-3 ml-1">
            No irradiation file uploaded — using monthly baseline for reference.
          </p>
        )}
      </div>

      {/* === FOOTER === */}
      <div className="w-full max-w-[850px] flex justify-end pr-3 mt-auto mb-4">
        <p className="text-[11px] italic text-gray-400 font-light">
          Automatically generated by iSolarChecking
        </p>
      </div>
    </div>
  );
}


/* Auto-wired: compute via backend */
import { useEffect, useState } from "react";
import { computeRPR } from "../api";
import { getSessionId } from "../sessionStore";
function useBackendAnalysis(){
  const [data, setData] = useState(null);
  useEffect(()=>{ (async()=>{
    const id = getSessionId();
    if (!id) return;
    const r = await computeRPR({ id });
    if (r.ok) setData(r);
  })(); }, []);
  return data;
}
