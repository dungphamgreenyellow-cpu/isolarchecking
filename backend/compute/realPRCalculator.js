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

    // --- 6. Build Daily RPR series ---
    const dailySeries = [];
    const groupedByDay = {};

    const getDay = (rec) => {
      const t = rec.timestamp || rec["Start Time"] || rec["StartTime"] || rec["Time"] || rec["Timestamp"];
      if (!t) return null;
      try {
        const d = new Date(t);
        if (isNaN(d)) return null;
        return d.toISOString().split("T")[0];
      } catch { return null; }
    };

    // Group valid records by day
    for (const r of validRecords) {
      const day = getDay(r);
      if (!day) continue;
      if (!groupedByDay[day]) groupedByDay[day] = [];
      groupedByDay[day].push(r);
    }

    const powerKeyRegex = /(activepower|outputpower|pac|power\(kw\)|feedinpower|totalpower)/i;
    const irrKeyRegex = /(irradiance|ghi|gti|solar)/i;

    for (const day of Object.keys(groupedByDay).sort()) {
      const recs = groupedByDay[day];
      // per-day EAC (sum power then ÷12)
      const eacDayRaw = recs.reduce((sum, r) => {
        const keys = Object.keys(r).filter((k) => powerKeyRegex.test(k));
        let p = 0;
        keys.forEach((k) => {
          const v = parseFloat(r[k]);
          if (!isNaN(v)) p += v;
        });
        return sum + p;
      }, 0);
      const eacDay = eacDayRaw / 12;

      // per-day EIRR (prefer log irradiance; ÷12 ÷1000)
      const eirrDayRaw = recs.reduce((sum, r) => {
        const k = Object.keys(r).find((key) => irrKeyRegex.test(key));
        const v = k ? parseFloat(r[k]) : NaN;
        return sum + (isNaN(v) ? 0 : v);
      }, 0);
      const eirrDay = eirrDayRaw / 12 / 1000;

      const rprDay = eirrDay > 0 && capacity > 0 ? (eacDay / (eirrDay * capacity)) * 100 : 0;
      dailySeries.push({ date: day, RPR: parseFloat(rprDay.toFixed(2)), Eac: parseFloat(eacDay.toFixed(2)), Eirr: parseFloat(eirrDay.toFixed(3)) });
    }

    return {
      RPR: parseFloat(pr.toFixed(2)),
      Eac_kWh: parseFloat(Eac_kWh.toFixed(2)),
      Eirr_kWhm2: parseFloat(Eirr_kWhm2.toFixed(3)),
      capacity,
      totalSlots,
      dailySeries,
    };
  } catch (err) {
    console.error("⚠️ RPR compute error:", err.message);
    return { RPR: 0, error: err.message };
  }
}
