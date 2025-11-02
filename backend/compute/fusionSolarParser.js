// backend/compute/fusionSolarParser.js
// Updated to v9.9-LTS behavior: group by ManageObject (inverter), compute daily Eac delta per inverter, sum across inverters.
// Date conversion to YYYY-MM-DD uses local timezone (not UTC). Phantom dates like "31/8" are skipped.

import * as XLSX from "xlsx";
import Papa from "papaparse";

// Helper: parse CSV buffer into rows (array of objects)
async function parseCSV(buffer) {
  const text = buffer.toString("utf8");
  return new Promise((resolve, reject) => {
    const rows = [];
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      worker: false,
      step: (result) => rows.push(result.data),
      complete: () => resolve(rows),
      error: (err) => reject(err),
    });
  });
}

// Helper: parse XLSX buffer by reading first sheet and converting to CSV for Papa
async function parseXLSX(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  // Header thật nằm ở dòng 4 (index = 3)
  const headerRaw = (sheetData[3] || []).map(h => (h || "").toString().trim());

  // Dữ liệu từ dòng 5 trở đi — giữ nguyên tất cả cột
  const rows = (sheetData.slice(4) || []).map(row => {
    const obj = {};
    headerRaw.forEach((colName, index) => {
      obj[colName] = row[index];
    });
    return obj;
  });

  // Trả về rows; header có thể lấy lại bằng Object.keys(rows[0]) khi cần
  return rows;
}

// Normalize possible column names for ManageObject (inverter identifier)
const MANAGE_KEYS = [
  "ManageObject",
  "Manage Object",
  "Inverter",
  "Device",
  "设备名称",
  "逆变器",
  "ManageObjectName",
];

// Possible Eac (cumulative energy) keys
const EAC_KEYS = ["Eac", "Eac(kWh)", "E-AC(kWh)", "累计发电量", "E(AC)", "EAC", "累计(kWh)"];

// Possible datetime/date keys
const DATE_KEYS = ["Date", "Day", "日期", "DateTime", "Timestamp", "Time", "Datetime", "Date Time"];

function pickField(row, keys) {
  for (const k of keys) {
    if (k in row && row[k] !== undefined && row[k] !== null && (''+row[k]).trim() !== "") return row[k];
  }
  // case-insensitive fallback
  const lower = Object.keys(row).reduce((acc, k) => { acc[k.toLowerCase()] = k; return acc; }, {});
  for (const k of keys) {
    const lk = k.toLowerCase();
    if (lk in lower) return row[lower[lk]];
  }
  return undefined;
}

// Detect columns from a header row (used for FujiSeal-like exports)
function detectColumns(header) {
  const lower = header.map(h => (h || '').toString().toLowerCase());

  const find = (patterns) =>
    header[ lower.findIndex(h => patterns.some(p => h.includes(p))) ];

  const dateCol = find(["start time", "time", "date"]);
  const invCol  = find(["manageobject", "inverter", "device"]);
  const eacCol  = find(["total yield", "total pv yield", "today's yield", "daily energy"]);

  return { dateCol, invCol, eacCol };
}

// Chuẩn hoá ngày & số (helper)
function toLocalYMD(v) {
  if (v == null || v === "") return null;
  const d0 = new Date(v);
  if (isNaN(d0.getTime())) return null;
  const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toNumber(v) {
  if (typeof v === "number") return v;
  if (v == null) return NaN;
  const s = String(v).replace(/\s+/g,"").replace(/,/g,"");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// Detect simple phantom date like '31/8' (no year) -> skip
function isPhantomDate(str) {
  if (!str) return false;
  const s = (''+str).trim();
  // pattern DD/MM or D/M (no year)
  if (/^\d{1,2}\/\d{1,2}$/.test(s)) return true;
  return false;
}

// Parse a date/time string into a local YYYY-MM-DD
function toLocalYYYYMMDD(dateStr, timeStr) {
  if (!dateStr) return null;
  const s = (''+dateStr).trim();

  if (isPhantomDate(s)) return null; // explicitly skip phantom

  // Try ISO first
  let d = null;
  // Remove extra whitespace
  const combined = timeStr ? `${s} ${timeStr}` : s;

  // Common ISO formats
  const isoMatch = combined.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?)?)?/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const time = isoMatch[4] || '00:00:00';
    const tparts = time.split(':').map(p=>parseInt(p||0,10));
    d = new Date(y, m, day, tparts[0]||0, tparts[1]||0, tparts[2]||0);
  }

  if (!d) {
    // Try DD/MM/YYYY or DD-MM-YYYY
    const dmy = combined.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?)?)?/);
    if (dmy) {
      const day = parseInt(dmy[1],10);
      const mon = parseInt(dmy[2],10) - 1;
      let year = parseInt(dmy[3],10);
      if (year < 100) year += 2000;
      const time = dmy[4] || '00:00:00';
      const tparts = time.split(':').map(p=>parseInt(p||0,10));
      d = new Date(year, mon, day, tparts[0]||0, tparts[1]||0, tparts[2]||0);
    }
  }

  if (!d) {
    // Try MM/DD/YYYY (US) if first part <=12 and second >12 is unlikely
    const mdy = combined.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?)?)?/);
    if (mdy) {
      const part1 = parseInt(mdy[1],10);
      const part2 = parseInt(mdy[2],10);
      let day, mon;
      // Heuristic: if part1 > 12 it's day first
      if (part1 > 12) {
        day = part1; mon = part2 - 1;
      } else {
        // ambiguous: assume day-first for FusionSolar (most exports are day-first)
        day = part1; mon = part2 - 1;
      }
      let year = parseInt(mdy[3],10); if (year < 100) year += 2000;
      const time = mdy[4] || '00:00:00';
      const tparts = time.split(':').map(p=>parseInt(p||0,10));
      d = new Date(year, mon, day, tparts[0]||0, tparts[1]||0, tparts[2]||0);
    }
  }

  if (!d) {
    // Fallback: let Date parse it and then convert to local components
    const parsed = new Date(combined);
    if (!isNaN(parsed.getTime())) d = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), parsed.getHours(), parsed.getMinutes(), parsed.getSeconds());
  }

  if (!d || isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = `${d.getMonth()+1}`.padStart(2,'0');
  const day = `${d.getDate()}`.padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// Main function required by callers
export async function checkFusionSolarPeriod(file) {
  // `file` is expected to be an object from express-fileupload or similar { name, data }
  const buffer = file.data || Buffer.from(await file.arrayBuffer());

  // Parse rows
  let rows = [];
  const filename = (file.name || '').toString();
  try {
    if (filename.toLowerCase().endsWith('.csv')) {
      rows = await parseCSV(buffer);
    } else {
      rows = await parseXLSX(buffer);
    }
  } catch (err) {
    // If parsing fails, rethrow for caller handling
    throw new Error('Failed to parse FusionSolar file: ' + err.message);
  }

  // Build rows header and find required columns
  const header = Object.keys(rows[0] || {});

  const norm = s => (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
  const findHeader = (candidates) => {
    for (const cand of candidates) {
      const nc = norm(cand);
      const exact = header.find(h => norm(h) === nc);
      if (exact) return exact;
    }
    // fallback: includes
    for (const h of header) {
      const nh = norm(h);
      if (candidates.some(c => nh.includes(norm(c)))) return h;
    }
    return null;
  };

  const dateCol = findHeader(["Start Time", "Date Time", "DateTime", "StartTime"]);
  const invCol  = findHeader(["ManageObject", "Manage Object", "Inverter", "Device"]);
  const eacCol  = findHeader([
    "Accumulated amount of absorbed electricity(kWh)",
    "Accumulated amount of absorbed electricity (kWh)",
    "Accumulated amount of absorbed electricity",
    "Eac",
  ]);
  const activeCol = findHeader(["Active power(kW)", "Active power", "Active Power (kW)"]);

  console.log('[parser] cols:', { dateCol, invCol, eacCol, activeCol });

  // Collect daily min/max per inverter using Eac
  const dailyMap = {};
  for (const r of rows) {
    const day = toLocalYMD(r[dateCol]);
    if (!day) continue;

    const inv = (r[invCol] ?? "Unknown").toString().trim();
    const eac = toNumber(r[eacCol]);
    if (!Number.isFinite(eac)) continue;

    if (!dailyMap[day]) dailyMap[day] = {};
    if (!dailyMap[day][inv]) dailyMap[day][inv] = { min: eac, max: eac };
    if (eac < dailyMap[day][inv].min) dailyMap[day][inv].min = eac;
    if (eac > dailyMap[day][inv].max) dailyMap[day][inv].max = eac;
  }

  // dailyProduction: sum positive deltas per day
  const dailyProduction = {};
  for (const day of Object.keys(dailyMap).sort()) {
    let sum = 0;
    for (const inv of Object.keys(dailyMap[day])) {
      const { min, max } = dailyMap[day][inv];
      const delta = max - min;
      if (Number.isFinite(delta) && delta > 0) sum += delta;
    }
    if (sum > 0) dailyProduction[day] = Number(sum.toFixed(3));
  }

  // monthlyProduction: sum dailyProduction per YYYY-MM
  const monthlyProduction = {};
  for (const [day, value] of Object.entries(dailyProduction)) {
    const month = day.slice(0,7); // YYYY-MM
    monthlyProduction[month] = (monthlyProduction[month] || 0) + value;
  }
  for (const m of Object.keys(monthlyProduction)) monthlyProduction[m] = Number(monthlyProduction[m].toFixed(3));

  const days = Object.keys(dailyProduction).sort();
  return {
    records: rows,
    dailyProduction,
    monthlyProduction,
    startDate: days[0] || null,
    endDate: days[days.length-1] || null,
  };
}
