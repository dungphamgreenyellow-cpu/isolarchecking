// backend/compute/fusionSolarParser.js — ExcelJS Streaming XLSX parser
import ExcelJS from "exceljs";
import { Readable } from "stream";

const toYMD = (d) => {
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const normalizeInverter = (raw) => {
  const base = String(raw || "").split("/")[0].trim();
  if (!base) return null;
  const serial = base.replace(/^INV-?/i, "").replace(/\s+/g, "").toUpperCase();
  return `INV-${serial}`;
};

export async function streamParseAndCompute(buffer) {
  // ExcelJS WorkbookReader expects a stream; wrap buffer
  const bufStream = Readable.from(buffer);
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(bufStream, { entries: "emit", worksheets: "emit" });

  let headers = null;
  let headerRowIndex = -1;
  let rowIndex = 0;
  let startTimeCol = -1;
  let totalYieldColIndex = -1;
  let inverterColIndex = -1;
  let siteNameColIndex = -1;
  let siteName = null;
  let parsedRecordsCount = 0;
  const invDayMap = {};

  try {
    for await (const entry of workbook) {
      if (entry.type !== "worksheet") continue;

      for await (const row of entry) {
        const values = Array.isArray(row.values) ? row.values : [];
        const cells = values.map((v) => (v == null ? "" : String(v).trim()));

        // Header detection within first 10 rows using REQUIRED keys
        if (!headers && rowIndex < 10) {
          const lower = cells.map((c) => c.toLowerCase());
          const REQUIRED = ["start time", "total yield", "manageobject"];
          const score = REQUIRED.reduce((acc, k) => acc + (lower.some((c) => c.includes(k)) ? 1 : 0), 0);

          if (rowIndex === 3 && score >= 3) {
            headers = cells;
            headerRowIndex = 3;
          } else if (score >= 3 && headers == null) {
            headers = cells;
            headerRowIndex = rowIndex;
          }

          if (rowIndex === 9 && !headers) {
            return { success: false, message: "Không tìm thấy header hợp lệ trong 10 dòng đầu" };
          }
        }

        // Lock header and locate column indexes
        if (headers && rowIndex === headerRowIndex) {
          headers.forEach((h, i) => {
            const txt = String(h || "").toLowerCase();
            if (/start\s*time/.test(txt)) startTimeCol = i;
            if (/total\s*yield/.test(txt)) totalYieldColIndex = i;
            if (/manageobject|device name|inverter|inverter name/.test(txt)) inverterColIndex = i;
            if (txt.includes("site name")) siteNameColIndex = i;
          });
        }

        // Data rows
        if (headers && rowIndex > headerRowIndex) {
          const rawT = cells[startTimeCol];
          const rawE = cells[totalYieldColIndex];
          const rawInv = cells[inverterColIndex];

          if (siteName == null && siteNameColIndex !== -1) {
            const sn = cells[siteNameColIndex];
            if (sn) siteName = String(sn).trim();
          }

          const day = toYMD(rawT);
          if (day && rawInv && rawE) {
            const inv = normalizeInverter(rawInv);
            const numStr = String(rawE).replace(/[\,\s]/g, "");
            if (numStr !== "" && !/^(na|null|undefined)$/i.test(numStr)) {
              const eac = Number(numStr);
              if (Number.isFinite(eac)) {
                if (!invDayMap[day]) invDayMap[day] = {};
                if (!invDayMap[day][inv]) invDayMap[day][inv] = { min: eac, max: eac };
                else {
                  if (eac < invDayMap[day][inv].min) invDayMap[day][inv].min = eac;
                  if (eac > invDayMap[day][inv].max) invDayMap[day][inv].max = eac;
                }
                parsedRecordsCount++;
              }
            }
          }
        }

        rowIndex++;
      }
    }

    // Aggregate daily totals
    const daily = {};
    for (const day of Object.keys(invDayMap)) {
      let sum = 0;
      for (const inv of Object.keys(invDayMap[day])) {
        const { min, max } = invDayMap[day][inv];
        const gain = Math.max(0, max - min);
        if (gain > 0) sum += gain;
      }
      daily[day] = sum;
    }

    const dayKeys = Object.keys(daily).sort();
    const firstDay = dayKeys[0] || null;
    const lastDay = dayKeys.length ? dayKeys[dayKeys.length - 1] : null;

    return {
      success: true,
      siteName,
      dailyProduction: daily,
      dailyProductionTotal: dayKeys.reduce((acc, d) => acc + (daily[d] || 0), 0),
      firstDay,
      lastDay,
      parsedRecordsCount,
      allHeaders: headers,
    };
  } catch (err) {
    return { success: false, note: `Parse failed: ${err?.message || err}` };
  }
}
