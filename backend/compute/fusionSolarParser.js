// backend/compute/fusionSolarParser.js
import XLSX from "xlsx";
import Papa from "papaparse";

/**
 * Parse CSV file using streaming
 */
async function parseCSV(buffer) {
  const text = buffer.toString("utf8");

  return new Promise((resolve, reject) => {
    const rows = [];

    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      step: (result) => rows.push(result.data),
      complete: () => resolve(rows),
      error: reject
    });
  });
}

/**
 * Parse XLSX by converting to CSV and then streaming
 */
async function parseXLSX(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  // Always take the first sheet (FusionSolar logs are single-sheet)
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(sheet);

  return new Promise((resolve, reject) => {
    const rows = [];

    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      step: (result) => rows.push(result.data),
      complete: () => resolve(rows),
      error: reject
    });
  });
}

/**
 * Main parser (auto-detect CSV or XLSX)
 */
export async function parseFusionSolarLog(buffer, filename) {
  let rows = [];

  if (filename.toLowerCase().endsWith(".csv")) {
    rows = await parseCSV(buffer);
  } else {
    rows = await parseXLSX(buffer);
  }

  // === BUILD DAILY PRODUCTION MAP ===
  const daily = {};

  rows.forEach((r) => {
    const dateStr =
      (r["Date"] ||
        r["Day"] ||
        r["日期"] ||
        r["日"] ||
        r["Daily"] ||
        "").toString().trim();

    const production =
      parseFloat(
        r["Daily Production"] ||
        r["E-Day(kWh)"] ||
        r["Production"] ||
        r["Energy(kWh)"] ||
        r["发电量"] ||
        r["能量"] ||
        0
      );

    if (!dateStr || isNaN(production)) return;

    daily[dateStr] = (daily[dateStr] || 0) + production;
  });

  return {
    dailyProduction: daily,
    totalProduction: Object.values(daily).reduce((a, b) => a + b, 0),
    dayCount: Object.keys(daily).length,
  };
}
/**
 * Legacy compatibility function
 * Used by FileCheckModal to check date range of FusionSolar logs
 */
export async function checkFusionSolarPeriod(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(sheet);

  return new Promise((resolve, reject) => {
    const rows = [];
    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      step: (result) => rows.push(result.data),
      complete: () => {
        const dates = rows
          .map(r => r["Date"] || r["Day"] || r["日期"] || "")
          .filter(Boolean);
        const unique = [...new Set(dates)];
        resolve({
          startDate: unique[0] || null,
          endDate: unique[unique.length - 1] || null,
          dayCount: unique.length,
        });
      },
      error: reject
    });
  });
}
