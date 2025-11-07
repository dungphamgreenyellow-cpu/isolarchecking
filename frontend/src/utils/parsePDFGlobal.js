// Frontend helper to parse PVSyst PDF via backend and normalize fields
// Normalized output aligns with ProjectConfirmModal expectations
// { siteName, gps: {lat, lon}, capacity_dc_kwp, capacity_ac_kw, module_model, inverter_model, tilt_deg, azimuth_deg, soiling_loss_percent, dc_ac_ratio, _raw }

export async function parsePDFGlobal(file) {
  const backendURL = import.meta.env.VITE_BACKEND_URL || "";
  const fd = new FormData();
  // '/analysis/parse-pvsyst' accepts either 'pvsyst' or 'file'
  fd.append("pvsyst", file);

  try {
    const res = await fetch(`${backendURL}/analysis/parse-pvsyst`, {
      method: "POST",
      body: fd,
    });
    const json = await res.json().catch(() => null);
    if (!json?.success) return null;
    const d = json.data || {};

    const lat = d?.gps?.lat ?? d?.latitude ?? null;
    const lon = d?.gps?.lon ?? d?.longitude ?? null;
    const capacityDC = d?.capacities?.dc_kWp ?? d?.capacity_dc_kwp ?? null;
    const capacityAC = d?.capacities?.ac_kW ?? d?.capacity_ac_kw ?? null;
    const moduleModel = d.moduleModel ?? d.module_model ?? null;
    const inverterModel = d.inverterModel ?? d.inverter_model ?? null;

    const normalized = {
      siteName: d.siteName || d.site_name || d.project_name || null,
      gps: lat != null && lon != null ? { lat, lon } : null,
      capacity_dc_kwp: capacityDC,
      capacity_ac_kw: capacityAC,
      // Backward-compatible keys expected by ProjectConfirmModal
      capacityDCkWp: capacityDC,
      capacityACkWac: capacityAC,
      module_model: moduleModel,
      inverter_model: inverterModel,
      pvModuleModel: moduleModel,
      inverterModel: inverterModel,
      tilt_deg: d.tilt_deg ?? null,
      azimuth_deg: d.azimuth_deg ?? null,
      soiling_loss_percent: d.soiling_loss_percent ?? null,
      soilingPercent: d.soiling_loss_percent ?? null,
      dc_ac_ratio: d.dc_ac_ratio ?? null,
      _raw: d,
    };
    return normalized;
  } catch (e) {
    console.warn("[parsePDFGlobal] parse failed:", e?.message || e);
    return null;
  }
}
