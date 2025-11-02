// backend/compute/fusionSolarParser.js
// Updated to v9.9-LTS behavior: group by ManageObject (inverter), compute daily Eac delta per inverter, sum across inverters.
// Date conversion to YYYY-MM-DD uses local timezone (not UTC). Phantom dates like "31/8" are skipped.

import * as XLSX from "xlsx";

function toNumber(v) {
  if (typeof v === "number") return v;
  if (!v) return NaN;
  const n = Number(String(v).replace(/,/g, "").replace(/\s+/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function toLocalYMD(d) {
  if (!d) return null;
  const x = new Date(d);
  if (isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export async function checkFusionSolarPeriod(file) {
  const buffer = file?.data ?? (file?.arrayBuffer ? Buffer.from(await file.arrayBuffer()) : file);
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  if (!raw || raw.length < 2) {
    return { success: true, records: [], dailyProduction: {}, monthlyProduction: {}, totalProduction: 0, dayCount: 0, startDate: null, endDate: null, inverterList: [], note: "Sheet trống" };
  }

  // Tìm dòng header chứa "Start Time"
  const headerIndex = raw.findIndex(r => r.some(v => typeof v === "string" && v.toLowerCase().includes("start time")));
  if (headerIndex === -1) {
    return { success: true, records: [], dailyProduction: {}, monthlyProduction: {}, totalProduction: 0, dayCount: 0, startDate: null, endDate: null, inverterList: [], note: "Không tìm thấy header" };
  }

  const header = raw[headerIndex].map(h => (h || "").toString().trim());
  const dataRows = raw.slice(headerIndex + 1);

  const dateCol = header.find(h => h.toLowerCase().includes("start time"));
  const invCol = header.find(h => h.toLowerCase().includes("manageobject") || h.toLowerCase().includes("inverter"));
  const eacCol = header.find(h => h.toLowerCase().includes("total yield"));
  const pCol = header.find(h => h.toLowerCase().includes("active power"));

  const records = dataRows.map(r => {
    const o = {};
    header.forEach((col, i) => { o[col] = r[i]; });
    o._timestamp = o[dateCol] ? new Date(o[dateCol]) : null;
    o._power = toNumber(o[pCol]);
    o._eac = toNumber(o[eacCol]);
    o._inv = (o[invCol] || "Unknown").toString().trim();
    o._day = o._timestamp ? toLocalYMD(o._timestamp) : null;
    return o;
  });

  // Gom daily = sum(max - min) theo inverter
  const dailyMap = {};
  const invSet = new Set();
  for (const r of records) {
    if (!r._day || !Number.isFinite(r._eac)) continue;
    invSet.add(r._inv);
    dailyMap[r._day] ??= {};
    const rec = dailyMap[r._day][r._inv] ?? { min: r._eac, max: r._eac };
    if (r._eac < rec.min) rec.min = r._eac;
    if (r._eac > rec.max) rec.max = r._eac;
    dailyMap[r._day][r._inv] = rec;
  }

  const dailyProduction = {};
  for (const d of Object.keys(dailyMap)) {
    let s = 0;
    for (const inv in dailyMap[d]) {
      const { min, max } = dailyMap[d][inv];
      if (max > min) s += (max - min);
    }
    if (s > 0) dailyProduction[d] = Number(s.toFixed(3));
  }

  const monthlyProduction = {};
  for (const d in dailyProduction) {
    const m = d.slice(0, 7);
    monthlyProduction[m] = (monthlyProduction[m] || 0) + dailyProduction[d];
  }

  const days = Object.keys(dailyProduction).sort();
  const totalProduction = Number(Object.values(dailyProduction).reduce((a, b) => a + b, 0).toFixed(3));

  return {
    success: true,
    records,
    dailyProduction,
    monthlyProduction,
    totalProduction,
    dayCount: days.length,
    startDate: days[0] || null,
    endDate: days.at(-1) || null,
    inverterList: [...invSet]
  };
}
