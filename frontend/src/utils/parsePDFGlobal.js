// Frontend helper to parse PVSyst PDF via backend and normalize fields
// Returns a compact object with at least keys:
// { siteName, gps, cod, pvModule, inverter, dcCapacity, acCapacity, totalModules, totalInverters }

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

    const hasGPS = d.latitude != null && d.longitude != null;
    const normalized = {
      siteName: d.site_name || d.project_name || null,
      gps: hasGPS ? { lat: d.latitude, lon: d.longitude } : null,
      cod: d.cod || null,
      pvModule: d.module_model ?? null,
      inverter: d.inverter_model ?? null,
      dcCapacity: d.capacity_dc_kwp ?? null,
      acCapacity: d.capacity_ac_kw ?? null,
      totalModules: d.modules_total ?? null,
      totalInverters: d.inverter_count ?? null,
      // also expose raw for consumers that want more
      _raw: d,
    };
    return normalized;
  } catch (e) {
    console.warn("[parsePDFGlobal] parse failed:", e?.message || e);
    return null;
  }
}
