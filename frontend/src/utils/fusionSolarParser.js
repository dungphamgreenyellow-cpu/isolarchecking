// Frontend utility now delegates parsing to backend CSV-only endpoint
// Output shape stays compatible with FileCheckModal expectations
import api from "./apiClient";

export async function checkFusionSolarPeriod(file) {
  try {
    const form = new FormData();
    form.append("logfile", file);
    const { data } = await api.post("/analysis/compute", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const r = data?.data || {};
    if (!data?.success || !r?.success) {
      return {
        valid: false,
        message: r?.note || data?.error || "CSV parse failed",
        totalProduction: 0,
        dailyProduction: [],
      };
    }
    const arr = Object.entries(r.dailyProduction || {}).map(([date, production]) => ({ date, production }));
    return {
      valid: (r.days ?? 0) <= 31 && (r.days ?? 0) > 0,
      startDate: r.firstDay || null,
      endDate: r.lastDay || null,
      days: r.days || 0,
      totalProduction: Math.round(r.total || 0),
      dailyProduction: arr,
      message: r.days ? `✅ OK — ${r.days} days (${r.firstDay} → ${r.lastDay})` : (r.note || "Parsed"),
    };
  } catch (err) {
    console.error("⚠️ FusionSolar backend parse error:", err);
    return {
      valid: false,
      message: "Error contacting backend",
      totalProduction: 0,
      dailyProduction: [],
    };
  }
}
