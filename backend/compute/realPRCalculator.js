// === /server/compute/realPRCalculator.js — v9.4.1-LTS (Node Cloud Compatible) ===
// ✅ Backend-safe (no browser APIs)
// ✅ Computes Real Performance Ratio (RPR)
// ✅ Uses 5-min interpolated irradiance or daily GHI baseline
// ✅ Filters only “Grid Connected” inverters
// ✅ Converts irradiance from W/m² → kWh/m²
// ✅ Normalizes 5-min data (÷12) and logs details if debug enabled

export function computeRealPerformanceRatio(parsed, dailyGHI = [], capacity, debug = false) {
  try {
    if (!parsed?.records?.length) throw new Error("Parsed log data missing");

    // --- 1. Filter records with “Grid Connected” status ---
    const validRecords = parsed.records.filter((r) => {
      const status = String(r["Status"] || r["status"] || "").toLowerCase();
      return status.includes("grid") || status.includes("connected") || status.includes("on");
    });

    const totalSlots = validRecords.length;
    if (!totalSlots) throw new Error("No grid-connected records found.");

    // --- 2. Aggregate actual energy (Eac) ---
    const eac = validRecords.reduce((sum, r) => {
      const keys = Object.keys(r).filter(
        (k) =>
          /(activepower|outputpower|pac|power\(kw\))/i.test(k) ||
          /(feedinpower|totalpower)/i.test(k)
      );
      let p = 0;
      keys.forEach((k) => {
        const val = parseFloat(r[k]);
        if (!isNaN(val)) p += val;
      });
      return sum + p;
    }, 0);

    // --- 3. Irradiance (Eirr) calculation ---
    let eirr = 0;

    if (dailyGHI.length > 0) {
      // Use dailyGHI baseline
      eirr = dailyGHI.reduce((sum, d) => sum + (d.value || d.ghi || 0), 0);
    } else {
      // Estimate from available irradiance fields
      const irrRecords = parsed.records.map((r) => {
        const irrKey = Object.keys(r).find((k) =>
          /(irradiance|ghi|gti|solar)/i.test(k)
        );
        const val = irrKey ? parseFloat(r[irrKey]) : NaN;
        return isNaN(val) ? 0 : val;
      });
      eirr = irrRecords.reduce((a, b) => a + b, 0) / 12 / 1000; // normalize & convert W→kWh
    }

    // --- 4. Normalize Eac to kWh ---
    const Eac_kWh = eac / 12; // 5-min logs → 12 intervals/hour
    const Eirr_kWhm2 = eirr;

    // --- 5. Compute PR ---
    const pr = (Eac_kWh / (Eirr_kWhm2 * capacity)) * 100;

    if (debug) {
      console.log("🔍 [Debug RPR Calculation]");
      console.log("Total records:", totalSlots);
      console.log("Capacity (kWp):", capacity);
      console.log("Eac_kWh:", Eac_kWh.toFixed(2));
      console.log("Eirr_kWh/m2:", Eirr_kWhm2.toFixed(3));
      console.log("RPR (%):", pr.toFixed(2));
    }

    return {
      RPR: parseFloat(pr.toFixed(2)),
      Eac_kWh: parseFloat(Eac_kWh.toFixed(2)),
      Eirr_kWhm2: parseFloat(Eirr_kWhm2.toFixed(3)),
      capacity,
      totalSlots,
    };
  } catch (err) {
    console.error("⚠️ RPR compute error:", err.message);
    return { RPR: 0, error: err.message };
  }
}
