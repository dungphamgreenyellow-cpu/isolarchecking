// backend/compute/fusionSolarParser.js
// Updated to v9.9-LTS behavior: group by ManageObject (inverter), compute daily Eac delta per inverter, sum across inverters.
// Date conversion to YYYY-MM-DD uses local timezone (not UTC). Phantom dates like "31/8" are skipped.

import * as XLSX from "xlsx";

// Chuẩn hoá ngày LOCAL, không UTC
function toLocalYMD(v) {
  const d0 = new Date(v);
  if (isNaN(d0.getTime())) return null;
  const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Chuẩn hoá số (bỏ dấu phẩy/khoảng trắng)
function toNumber(v) {
  if (typeof v === "number") return v;
  if (v == null) return NaN;
  const n = Number(String(v).replace(/\s+/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export async function checkFusionSolarPeriod(file) {
  // Buffer từ express-fileupload (file.data) hoặc từ File/Blob (arrayBuffer)
  const buffer = file?.data ? file.data : (file?.arrayBuffer ? Buffer.from(await file.arrayBuffer()) : file);

  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // Đọc thô -> header ở DÒNG 4
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
  if (!raw || raw.length < 5) {
    return {
      records: [],
      dailyProduction: {},
      monthlyProduction: {},
      totalProduction: 0,
      dayCount: 0,
      startDate: null,
      endDate: null,
      inverterList: [],
      note: "Sheet rỗng hoặc không đủ hàng."
    };
  }

  // Header thật (dòng 4), data từ dòng 5
  const header = raw[3].map(h => (h || "").toString().trim());
  const rows = raw.slice(4).map(r => {
    const o = {};
    header.forEach((col, i) => { o[col] = r[i]; });
    return o;
  });

  // Map cột CHỐT (FujiSeal/FS):
  const dateCol = header.find(h => h.toLowerCase().includes("start time")) || header.find(h => h.toLowerCase().includes("date"));
  const invCol = header.find(h => h.toLowerCase().includes("manageobject")) || header.find(h => h.toLowerCase().includes("inverter"));
  const eacCol = header.find(h => h.toLowerCase().includes("total yield")) || header.find(h => h.toLowerCase().includes("total pv yield"));
  const pCol = header.find(h => h.toLowerCase().includes("active power")) || null; // P5 để tính RPR

  // Debug nhẹ (xuất ra logs server)
  console.log("[parser-cols]", { dateCol, invCol, eacCol, pCol });

  // Bổ sung _timestamp & _power trong records để phục vụ RPR
  for (const r of rows) {
    const ts = r[dateCol];
    r._timestamp = ts ? new Date(ts) : null;
    r._power = pCol ? toNumber(r[pCol]) : NaN;
    r._eac = toNumber(r[eacCol]);
    r._inv = (r[invCol] ?? "Unknown").toString().trim();
    r._day = r._timestamp ? toLocalYMD(r._timestamp) : null;
  }

  // Gom daily theo inverter: sum(max(Eac) - min(Eac))
  const dailyMap = {};
  const invSet = new Set();
  for (const r of rows) {
    if (!r._day || !Number.isFinite(r._eac)) continue;
    invSet.add(r._inv);
    dailyMap[r._day] ??= {};
    const rec = dailyMap[r._day][r._inv] ?? { min: r._eac, max: r._eac };
    if (r._eac < rec.min) rec.min = r._eac;
    if (r._eac > rec.max) rec.max = r._eac;
    dailyMap[r._day][r._inv] = rec;
  }

  const dailyProduction = {};
  for (const day of Object.keys(dailyMap)) {
    let sum = 0;
    for (const inv of Object.keys(dailyMap[day])) {
      const d = dailyMap[day][inv];
      const delta = d.max - d.min;
      if (Number.isFinite(delta) && delta > 0) sum += delta;
    }
    if (sum > 0) dailyProduction[day] = Number(sum.toFixed(3));
  }

  // Monthly từ daily
  const monthlyProduction = {};
  for (const day of Object.keys(dailyProduction)) {
    const m = day.slice(0, 7); // YYYY-MM
    monthlyProduction[m] = (monthlyProduction[m] || 0) + dailyProduction[day];
  }

  const days = Object.keys(dailyProduction).sort();
  const totalProduction = Number(Object.values(dailyProduction).reduce((a, b) => a + b, 0).toFixed(3));

  return {
    records: rows,                         // FULL 5-min để tính RPR
    dailyProduction,
    monthlyProduction,
    totalProduction,
    dayCount: days.length,
    startDate: days[0] || null,
    endDate: days.at(-1) || null,
    inverterList: [...invSet]
  };
}
