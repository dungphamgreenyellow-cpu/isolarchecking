import { parseXlsxStream } from "./parseXlsxStream.js";

function normalizeDate(raw) {
  if (!raw) return null;
  const num = Number(raw);
  if (Number.isFinite(num) && num > 20000 && num < 90000) {
    const origin = new Date(1899, 11, 30);
    const dt = new Date(origin.getTime() + num * 86400000);
    if (!isNaN(dt)) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const dt = new Date(raw);
  if (isNaN(dt)) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeInverter(v) {
  if (!v) return null;
  const base = String(v).split("/")[0].trim();
  const cleaned = base.replace(/inv-?/i, "").trim().toUpperCase();
  return cleaned ? `INV-${cleaned}` : null;
}

export async function computeFusionFromXlsx(buffer) {
  const rows = await parseXlsxStream(buffer);
  if (!rows?.length) return { success: false, message: "No records in XLSX" };

  const sample = rows.find((r) => r && Object.keys(r).length > 0);
  if (!sample) return { success: false, message: "No valid data rows in XLSX" };

  const keys = Object.keys(sample);
  let startKey = null,
    yieldKey = null,
    invKey = null,
    siteKey = null;
  keys.forEach((k) => {
    const l = k.toLowerCase();
    if (l.includes("start") && l.includes("time")) startKey = k;
    if (l.includes("total") && l.includes("yield")) yieldKey = k;
    if (l.includes("manageobject") || l.includes("inverter") || l.includes("device name")) invKey = k;
    if (l.includes("site name") || l.includes("plant name")) siteKey = k;
  });

  if (!startKey || !yieldKey || !invKey) {
    return { success: false, message: "Missing required columns (Start Time / Total Yield / ManageObject)" };
  }

  const invDayMap = {};
  let parsedRecordsCount = 0;
  let siteName = null;

  for (const row of rows) {
    const rawT = row[startKey];
    const rawE = row[yieldKey];
    const rawInv = row[invKey];
    if (!rawT || !rawE || !rawInv) continue;

    if (!siteName && siteKey && row[siteKey]) siteName = String(row[siteKey]).trim();

    const day = normalizeDate(rawT);
    if (!day) continue;

    const inv = normalizeInverter(rawInv);
    if (!inv) continue;

    const num = Number(String(rawE).replace(/[\,\s]/g, ""));
    if (!Number.isFinite(num)) continue;

    if (!invDayMap[day]) invDayMap[day] = {};
    if (!invDayMap[day][inv]) invDayMap[day][inv] = { min: num, max: num };
    else {
      invDayMap[day][inv].min = Math.min(invDayMap[day][inv].min, num);
      invDayMap[day][inv].max = Math.max(invDayMap[day][inv].max, num);
    }
    parsedRecordsCount++;
  }

  const daily = {};
  for (const d of Object.keys(invDayMap)) {
    let sum = 0;
    for (const inv of Object.keys(invDayMap[d])) {
      const { min, max } = invDayMap[d][inv];
      const gain = Math.max(0, max - min);
      sum += gain;
    }
    daily[d] = sum;
  }

  const days = Object.keys(daily).sort();
  return {
    success: true,
    source: "xlsx",
    siteName,
    dailyProduction: daily,
    dailyProductionTotal: days.reduce((a, d) => a + daily[d], 0),
    firstDay: days[0] || null,
    lastDay: days[days.length - 1] || null,
    parsedRecordsCount,
  };
}
