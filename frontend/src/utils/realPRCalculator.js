// === src/utils/realPRCalculator.js — v9.9.7-Pro (Full Stable) ===
// ✅ Adds computeDailyRPRSeries()
// ✅ Physically Correct Dynamic-Sin logic retained
// ✅ Auto-normalized GHI (5-min slots = ÷12)
// ✅ Detects "grid connected : power limit" / bilingual / mixed case
// ✅ Compatible with Report v8.5.2-LTS

export function computeRealPerformanceRatio(parsed, dailyGHI, capKWp) {
  console.log("===== [RPR v9.9.7-Pro] – Physically Correct Dynamic-Sin =====");
  if (!parsed?.records?.length || !capKWp) {
    console.warn("No valid records or missing capacity → return 0");
    return "0.00";
  }

  // --- Filter unique grid-connected slots ---
  const uniqueSlots = new Map();
  parsed.records.forEach((r) => {
    const t = r?.StartTime || r?.time || r?.Time || "";
    if (isGridConnected(r) && t && !uniqueSlots.has(t)) {
      uniqueSlots.set(t, r);
    }
  });

  const slotsArr = Array.from(uniqueSlots.values());
  const connectedSlots = slotsArr.length;
  console.log("Connected UNIQUE slots:", connectedSlots);

  // --- Compute total E_ac ---
  const eac =
    slotsArr.reduce(
      (sum, r) => sum + (Number(r["Active power(kW)"] || r["Active power"] || 0) / 12),
      0
    ) || 0;
  console.log("⚡ E_ac (from Active Power):", eac.toFixed(3), "kWh");

  // --- Estimate total E_irr ---
  const avgDailyGHI =
    dailyGHI?.length > 0 ? dailyGHI.reduce((a, b) => a + b, 0) / dailyGHI.length : 0;
  const eirr = avgDailyGHI * (connectedSlots / 288);
  console.log("☀️ E_irr (from Irradiance):", eirr.toFixed(3), "kWh/m²");

  console.log("System Capacity (kWp):", capKWp);

  // --- Compute Real PR ---
  const pr = capKWp > 0 && eirr > 0 ? (eac / (capKWp * eirr)) * 100 : 0;
  console.log("➜ Real PR:", pr.toFixed(2), "%");

  console.log("===== [RPR CALC END] =====");
  return pr.toFixed(2);
}

// === Daily RPR Series (for trendline chart) ===
export function computeDailyRPRSeries(parsed, dailyGHI, capKWp) {
  console.log("===== [RPR v9.9.7-Pro] – computeDailyRPRSeries() =====");
  if (!parsed?.dailyProduction?.length || !capKWp) {
    console.warn("No dailyProduction data found → returning empty series");
    return [];
  }

  const ghi = dailyGHI?.length ? dailyGHI : Array(30).fill(5);
  const series = parsed.dailyProduction.map((d, i) => {
    const eac = Number(d.production || d.Eac || d["Daily Production"] || 0);
    const rpr =
      capKWp > 0 && ghi[i] > 0 ? (eac / (capKWp * ghi[i])) * 100 : 0;
    return { date: String(i + 1).padStart(2, "0"), RPR: Number(rpr.toFixed(1)) };
  });

  console.log("Generated daily RPR series:", series.length, "days");
  return series;
}

// === Helper: Detect “Grid Connected” in multiple languages / cases ===
function isGridConnected(r) {
  const raw =
    (
      r["Inverter status"] ||
      r["Inverter Status"] ||
      r["Status"] ||
      r.status ||
      ""
    ).toLowerCase();

  return (
    (raw.includes("grid") && raw.includes("connect")) ||
    raw.includes("power limit") ||
    raw.includes("grid-connected") ||
    raw.includes("kết nối lưới") ||
    raw.includes("hòa lưới") ||
    raw.includes("并网") ||
    raw.includes("connected : power limit")
  );
}
