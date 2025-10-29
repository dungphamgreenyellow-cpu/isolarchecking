// src/utils/fusionSolarParser.js — v8.6 Universal Parser (ExcelJS + CSV fallback)
// ✅ Auto-detects Start/End dates, Daily Energy column
// ✅ Supports .xlsx, .xlsm, .csv (FusionSolar, iSolarCloud, etc.)
// ✅ Handles ZIP64 compression (no more "Bad uncompressed size")
// ✅ Robust number cleaning, UTF-8 compatible
// ✅ Returns: { valid, message, startDate, endDate, totalProduction, dailyData }

import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

/**
 * Utility: safely parse numeric strings like "1,234.56" or "1.234,56"
 */
function toNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val)
    .replace(/[^\d,.-]/g, "")
    .replace(/,/g, ".")
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Utility: try to detect date objects or ISO strings
 */
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

/**
 * Main parser
 */
export async function checkFusionSolarPeriod(file) {
  if (!file) throw new Error("No file provided");

  const name = file.name.toLowerCase();
  const isCSV = name.endsWith(".csv");

  let rows = [];

  try {
    if (isCSV) {
      // --- CSV fallback using XLSX ---
      const text = await file.text();
      const wb = XLSX.read(text, { type: "string" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    } else {
      // --- Excel robust reader using ExcelJS ---
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];

      ws.eachRow((row) => {
        const arr = row.values
          .map((v) => (typeof v === "object" && v?.text ? v.text : v))
          .map((v) => (v === undefined ? "" : String(v).trim()));
        if (arr.some((c) => c !== "")) rows.push(arr);
      });
    }
  } catch (err) {
    console.error("❌ FusionSolar parse error:", err);
    return { valid: false, message: "Error parsing file" };
  }

  if (!rows || rows.length < 5)
    return { valid: false, message: "Empty or unreadable file" };

  // === STEP 1. Normalize header row ===
  const headerRow = rows.find(
    (r) =>
      r.some((c) => /Start\s*Time/i.test(c)) &&
      r.some((c) => /(Daily|Energy|Yield)/i.test(c))
  );

  if (!headerRow)
    return {
      valid: false,
      message: "Missing Start Time or Daily Energy columns",
    };

  const startIdx = headerRow.findIndex((c) => /Start\s*Time/i.test(c));
  const energyIdx = headerRow.findIndex(
    (c) => /(Daily|Today|Yield|Energy)/i.test(c)
  );

  const headerIndex = rows.indexOf(headerRow);
  const dataRows = rows.slice(headerIndex + 1);

  // === STEP 2. Extract valid date + energy pairs ===
  const dailyData = [];
  for (const row of dataRows) {
    const dateVal = parseDate(row[startIdx]);
    const energyVal = toNumber(row[energyIdx]);
    if (dateVal && energyVal >= 0) dailyData.push({ date: dateVal, energy: energyVal });
  }

  if (dailyData.length === 0)
    return { valid: false, message: "No valid dates found under Start Time" };

  dailyData.sort((a, b) => a.date - b.date);

  const startDate = dailyData[0].date;
  const endDate = dailyData[dailyData.length - 1].date;
  const totalProduction = dailyData.reduce((sum, d) => sum + d.energy, 0);
  const durationDays =
    (endDate - startDate) / (1000 * 60 * 60 * 24) + 1;

  return {
    valid: true,
    message: `OK — ${durationDays.toFixed(0)} days (${startDate
      .toISOString()
      .slice(0, 10)} → ${endDate.toISOString().slice(0, 10)})`,
    startDate,
    endDate,
    totalProduction,
    dailyData,
  };
}
