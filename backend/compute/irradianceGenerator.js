// === /src/utils/irradianceGenerator.js — v9.6-LTS (Sinusoidal Power Profile, Safe Export) ===
// ✅ Input: dailyGHI[]  (kWh/m² per day), stepMinutes (2,5,10,15...)
// ✅ Output: per-slot *power* array (kW/m²/slot). Tổng POWER/12 = GHI energy.
// ✅ Shape: nửa sin từ 06:00–18:00 (có thể chỉnh daylightHours và dayStartHour)
//
// Công thức: s_j = sin(pi*(j+0.5)/N), j=0..N-1
// Tổng công suất được scale sao cho sum(power)/12 == GHI(day)

export const generateDailyIrrPowerProfile = (
  dailyGHI,
  stepMinutes = 5,
  daylightHours = 12,
  dayStartHour = 6
) => {
  try {
    if (!Array.isArray(dailyGHI) || dailyGHI.length === 0) return [];

    const stepsPerDay = Math.round(1440 / stepMinutes); // slot/ngày
    const daylightSlots = Math.round((daylightHours * 60) / stepMinutes);
    const startIdx = Math.round((dayStartHour * 60) / stepMinutes);
    const result = [];

    // --- Nửa sin ban ngày ---
    const s = new Array(daylightSlots).fill(0).map((_, j) =>
      Math.sin(Math.PI * (j + 0.5) / daylightSlots)
    );
    const sumS = s.reduce((a, v) => a + v, 0);

    // --- Xây dựng profile cho từng ngày ---
    for (let d = 0; d < dailyGHI.length; d++) {
      const ghiDay = parseFloat(dailyGHI[d]) || 0; // kWh/m²/day
      const A = sumS > 0 ? (ghiDay * 12) / sumS : 0; // scale kW/m²/slot

      for (let i = 0; i < stepsPerDay; i++) {
        const idxInDay = i - startIdx;
        if (idxInDay >= 0 && idxInDay < daylightSlots) {
          result.push(A * s[idxInDay]); // power(kW/m²)
        } else {
          result.push(0);
        }
      }
    }

    console.log(`✅ generateDailyIrrPowerProfile: ${result.length} slots created (sin profile)`);
    return result; // power per slot (kW/m²)
  } catch (err) {
    console.error("❌ Error in generateDailyIrrPowerProfile:", err);
    return [];
  }
};
