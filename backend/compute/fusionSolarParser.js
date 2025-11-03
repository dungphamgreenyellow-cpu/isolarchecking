// backend/compute/fusionSolarParser.js
// Updated to v9.9-LTS behavior: group by ManageObject (inverter), compute daily Eac delta per inverter, sum across inverters.
// Date conversion to YYYY-MM-DD uses local timezone (not UTC). Phantom dates like "31/8" are skipped.

import * as XLSX from "xlsx";

function normalizeInverter(obj) {
  if (!obj) return "Unknown";
  let name = obj.toString();
  if (name.includes("/")) name = name.split("/")[1];
  if (name.includes("(")) name = name.split("(")[0];
  return name.trim();
}

const EAC_KEYS = [
  "Eac",
  "Eac(kWh)",
  "E-AC(kWh)",
  "累计发电量",
  "Accumulated amount of absorbed electricity(kWh)",
  "Total yield(kWh)",
  "Today’s yield(kWh)",
];

const DATE_KEYS = [
  "Date",
  "Day",
  "Start Time",
  "StartTime",
  "日期",
  "Timestamp",
  "Time",
  "Datetime",
  "Date Time"
];

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

// Alias for compatibility with incoming snippet
function toLocalYYYYMMDD(d) {
  return toLocalYMD(d);
}

export async function checkFusionSolarPeriod(file) {
  const buffer = file?.data ?? (file?.arrayBuffer ? Buffer.from(await file.arrayBuffer()) : file);
  const wb = XLSX.read(buffer, { type: "buffer" });
  // Chọn sheet: ưu tiên tên có "Plant" hoặc "Logger", nếu không có thì sheet đầu tiên
  const sheetName = wb.SheetNames.find(n => /plant/i.test(n) || /logger/i.test(n)) || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  if (!raw || raw.length < 2) {
    return { success: true, records: [], dailyProduction: {}, monthlyProduction: {}, totalProduction: 0, dayCount: 0, startDate: null, endDate: null, inverterList: [], note: "Sheet trống" };
  }

  // Header nằm ở dòng 4 (zero-index = 3)
  const headerIndex = 3;
  if (!raw || raw.length <= headerIndex) {
    return { success: true, records: [], dailyProduction: {}, monthlyProduction: {}, totalProduction: 0, dayCount: 0, startDate: null, endDate: null, inverterList: [], note: "Sheet trống" };
  }

  const header = raw[headerIndex].map(h => (h || "").toString().trim());
  // Header = row index 3 → dữ liệu phải bắt đầu từ row index 4
  const dataRows = raw.slice(headerIndex + 1);

  // Tìm index cột ngày và EAC theo các hằng DATE_KEYS / EAC_KEYS
  const dateIndex = header.findIndex(h => DATE_KEYS.some(k => (h || "").toString().toLowerCase().includes(k.toLowerCase())));
  const invCol = header.find(h => h.toLowerCase().includes("manageobject") || h.toLowerCase().includes("inverter"));
  const eacIndex = header.findIndex(h => EAC_KEYS.some(k => (h || "").toString().toLowerCase().includes(k.toLowerCase())));
  const pCol = header.find(h => h.toLowerCase().includes("active power"));

  if (dateIndex === -1 || eacIndex === -1) {
    return { success: false, note: "Không tìm thấy cột Date hoặc EAC" };
  }

  // Build records by iterating rows starting at headerIndex + 1 (row index 4 => data starts at row 5)
  const invIndex = header.findIndex(h => h.toLowerCase().includes("manageobject") || h.toLowerCase().includes("inverter"));
  const records = [];
  for (let i = headerIndex + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length === 0) continue;

    const dateVal = row[dateIndex] || row[dateIndex - 1] || row[dateIndex + 1];
    if (!dateVal) continue;
    const dateKey = toLocalYYYYMMDD(dateVal);
    if (!dateKey) continue;

    const invRaw = row[invIndex] || "";
    const inv = normalizeInverter(invRaw);

    const eacVal = row[eacIndex];
    const eac = Number(('' + eacVal).replace(/,/g, "").trim());
    if (!Number.isFinite(eac)) continue;

    records.push({ dateKey, inv, eac });
  }

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
