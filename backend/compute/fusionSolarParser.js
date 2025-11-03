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

  // Tìm index cột ngày và EAC theo chuẩn FusionSolar v9.9-LTS
  // Header matching: Start Time và Accumulated amount of absorbed electricity(kWh)
  const dateIndex = header.findIndex(h => (h || "").toLowerCase().includes("start time"));
  const eacIndex = header.findIndex(h => (h || "").toLowerCase().includes("accumulated amount of absorbed electricity(kwh)"));
  const invIndex = header.findIndex(h => (h || "").toLowerCase().includes("manageobject"));

  if (dateIndex === -1 || eacIndex === -1) {
    return { success: false, note: "Không tìm thấy cột Start Time hoặc Accumulated EAC" };
  }

  // Build compactRecords: dateKey = YYYY-MM-DD (local), inverter = INV-<serial>, eac = numeric
  const compactRecords = [];
  for (let r = headerIndex + 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row || row.length === 0) continue;

    // read date value from the Start Time column
    const dateVal = row[dateIndex];
    if (!dateVal) continue;
    const dayKey = toLocalYMD(new Date(dateVal));
    if (!dayKey) continue;

    // inverter serial: take part before '/' and format INV-<serial>
    const invRaw = (invIndex !== -1 ? (row[invIndex] || "") : "") + "";
    const serial = invRaw.split("/")[0].trim();
    const inverter = serial ? `INV-${serial}` : "INV-Unknown";

    // parse EAC numeric
    const eacRaw = row[eacIndex];
    const e = Number(('' + (eacRaw ?? '')).replace(/,/g, '').trim());
    if (!Number.isFinite(e)) continue;

    compactRecords.push({ dateKey: dayKey, inverter, eac: Number(e) });
  }

  // Aggregate dailyProduction per inverter
  const dailyMap = {}; // { dayStr: { INV-xxx: {min, max} } }
  const inverterSet = new Set();
  for (const r of compactRecords) {
    const day = r.dateKey; // already YYYY-MM-DD local
    if (!day) continue;
    inverterSet.add(r.inverter);
    dailyMap[day] ??= {};
    const invObj = dailyMap[day][r.inverter] ?? { min: r.eac, max: r.eac };
    if (r.eac < invObj.min) invObj.min = r.eac;
    if (r.eac > invObj.max) invObj.max = r.eac;
    dailyMap[day][r.inverter] = invObj;
  }

  const dailyProduction = {}; // day -> sum of (max-min) across inverters
  for (const day of Object.keys(dailyMap).sort()) {
    let sum = 0;
    for (const inv of Object.keys(dailyMap[day])) {
      const { min, max } = dailyMap[day][inv];
      if (max > min) sum += (max - min);
    }
    if (sum > 0) dailyProduction[day] = Number(sum.toFixed(3));
  }

  const monthlyProduction = {};
  for (const d in dailyProduction) {
    const m = d.slice(0, 7);
    monthlyProduction[m] = (monthlyProduction[m] || 0) + dailyProduction[d];
  }

  const days = Object.keys(dailyProduction).sort();
  const totalProduction = Number(Object.values(dailyProduction).reduce((a, b) => a + b, 0).toFixed(3));

  // session store in-memory with TTL 45 minutes
  const sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const inverterList = [...inverterSet].sort();
  // Ensure a module-level memoryStore exists
  if (typeof globalThis.__fusionMemoryStore === 'undefined') globalThis.__fusionMemoryStore = {};
  globalThis.__fusionMemoryStore[sessionId] = {
    compactRecords,
    dailyProduction,
    monthlyProduction,
    inverterList,
    createdAt: Date.now()
  };
  // TTL remove
  setTimeout(() => { delete globalThis.__fusionMemoryStore[sessionId]; }, 45 * 60 * 1000);

  return {
    success: true,
    sessionId,
    inverterList,
    totalProduction,
    dayCount: days.length,
    startDate: days[0] || null,
    endDate: days.at(-1) || null,
    note: compactRecords.length ? "Parsed OK" : "Sheet trống"
  };
}

export function getFusionSession(id) {
  return (globalThis.__fusionMemoryStore || {})[id] || null;
}
