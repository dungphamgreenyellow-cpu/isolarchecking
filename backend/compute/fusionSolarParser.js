import * as XLSX from "xlsx";

// Auto-detect column names from header
function detectColumns(header) {
  let dateCol = header.find(h => /date|time|day/i.test(h));
  let invCol  = header.find(h => /manage|inverter|device|logger|name/i.test(h));
  let eacCol  = header.find(h => /e[- ]?day|eac|yield|active energy/i.test(h));

  return { dateCol, invCol, eacCol };
}

export async function checkFusionSolarPeriod(file) {
  const buffer = file.data || Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: true });

  if (!rows.length) return { success: false, error: "Empty sheet" };

  const header = Object.keys(rows[0]);
  const { dateCol, invCol, eacCol } = detectColumns(header);

  if (!dateCol || !invCol || !eacCol)
    return { success: false, error: "Required columns not found" };

  const daily = {};

  for (const r of rows) {
    const d = new Date(r[dateCol]);
    if (isNaN(d.getTime())) continue;
    const day = d.toISOString().slice(0, 10);

    const inv = (r[invCol] || "Unknown").toString();
    const eac = Number((r[eacCol] + "").replace(/,/g, ""));
    if (!Number.isFinite(eac)) continue;

    if (!daily[day]) daily[day] = {};
    if (!daily[day][inv]) daily[day][inv] = { min: eac, max: eac };
    daily[day][inv].min = Math.min(daily[day][inv].min, eac);
    daily[day][inv].max = Math.max(daily[day][inv].max, eac);
  }

  const dailyProduction = {};
  for (const day of Object.keys(daily)) {
    let sum = 0;
    for (const inv of Object.keys(daily[day])) {
      sum += daily[day][inv].max - daily[day][inv].min;
    }
    dailyProduction[day] = Number(sum.toFixed(3));
  }

  const days = Object.keys(dailyProduction).sort();
  return {
    success: true,
    dailyProduction,
    totalProduction: days.reduce((a,b)=>a+dailyProduction[b],0),
    dayCount: days.length,
    startDate: days[0] || null,
    endDate: days.at(-1) || null
  };
}
// backend/compute/fusionSolarParser.js
// Updated to v9.9-LTS behavior: group by ManageObject (inverter), compute daily Eac delta per inverter, sum across inverters.
// Date conversion to YYYY-MM-DD uses local timezone (not UTC). Phantom dates like "31/8" are skipped.

import XLSX from "xlsx";
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
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return new Promise((resolve, reject) => {
    const rows = [];
    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      worker: false,
      step: (result) => rows.push(result.data),
      complete: () => resolve(rows),
      error: (err) => reject(err),
    });
  });
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

  // Map: dateStr -> Map(manageObject -> array of Eac values)
  const dateMap = new Map();
  const encounteredDates = new Set();

  for (const r of rows) {
    // pick ManageObject identifier
    const manageRaw = pickField(r, MANAGE_KEYS) || '';
    const manage = (''+manageRaw).toString().trim() || 'DEFAULT';

    // pick Eac cumulative value
    const eacRaw = pickField(r, EAC_KEYS);
    const eac = eacRaw === undefined || eacRaw === null || eacRaw === '' ? NaN : Number((''+eacRaw).replace(/,/g, '').trim());
    if (!Number.isFinite(eac)) continue;

    // pick date/time
    const dateRaw = pickField(r, DATE_KEYS) || pickField(r, ['Date', '日期', 'Day']);
    const timeRaw = (r['Time'] || r['时间'] || r['时刻']) || '';
    if (!dateRaw) continue;

    if (isPhantomDate(dateRaw)) continue; // skip phantom entries like '31/8'

    const dateKey = toLocalYYYYMMDD(dateRaw, timeRaw);
    if (!dateKey) continue;

    encounteredDates.add(dateKey);

    if (!dateMap.has(dateKey)) dateMap.set(dateKey, new Map());
    const invMap = dateMap.get(dateKey);
    if (!invMap.has(manage)) invMap.set(manage, []);
    invMap.get(manage).push(eac);
  }

  // Aggregate per-date: sum over inverters (max-min of Eac per inverter)
  const dailyProduction = {};
  for (const [date, invMap] of dateMap.entries()) {
    let daySum = 0;
    for (const [inv, vals] of invMap.entries()) {
      if (!vals || vals.length === 0) continue;
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      const delta = max - min;
      if (Number.isFinite(delta) && delta >= 0) daySum += delta;
    }
    dailyProduction[date] = Number(daySum.toFixed(3));
  }

  const datesSorted = Array.from(new Set(Object.keys(dailyProduction))).sort();
  const totalProduction = Object.values(dailyProduction).reduce((a,b)=>a+b,0);

  return {
    dailyProduction,
    totalProduction: Number(totalProduction.toFixed(3)),
    dayCount: Object.keys(dailyProduction).length,
    startDate: datesSorted[0] || null,
    endDate: datesSorted[datesSorted.length-1] || null,
  };
}
