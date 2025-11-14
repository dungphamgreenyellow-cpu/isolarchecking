import ExcelJS from "exceljs";
import { Readable } from "stream";

// Convert Excel date or string date → YYYY-MM-DD
function normalizeDate(raw) {
  if (!raw) return null;

  // Excel numeric date
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

// Normalize ManageObject → "INV-XXXX"
function normalizeInverter(v) {
  if (!v) return null;
  const base = String(v).split("/")[0].trim();
  if (!base) return null;
  const cleaned = base.replace(/inv-?/i, "").trim().toUpperCase();
  return cleaned ? `INV-${cleaned}` : null;
}

export async function streamParseAndCompute(buffer) {
  const stream = Readable.from(buffer);

  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(stream, {
    entries: "emit",
    worksheets: "emit",
    sharedStrings: "cache",
    styles: "cache"
  });

  let headers = null;
  let headerRowIndex = -1;
  let rowIndex = 0;

  let startCol = -1;
  let yieldCol = -1;
  let invCol = -1;
  let siteCol = -1;

  let siteName = null;
  let parsedRecordsCount = 0;
  const invDayMap = {};

  for await (const entry of workbook) {
    if (entry.type !== "worksheet") continue;

    for await (const row of entry) {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        let v = cell.value;
        if (v && typeof v === "object") {
          if ("text" in v) v = v.text;
          else if ("result" in v) v = v.result;
        }
        cells[colNum - 1] = v == null ? "" : String(v).trim();
      });

      // Header detection (prefer row index 3)
      if (!headers && rowIndex < 10) {
        const lower = cells.map(c => c.toLowerCase());
        const REQUIRED = ["start time", "total yield", "manageobject"];
        const score = REQUIRED.reduce((a,k)=>a+(lower.some(c=>c.includes(k))?1:0),0);

        if (rowIndex === 3 && score >= 3) {
          headers = cells; headerRowIndex = rowIndex;
        } else if (!headers && score >= 3) {
          headers = cells; headerRowIndex = rowIndex;
        }

        if (rowIndex === 9 && !headers) {
          return { success:false, message:"Không tìm thấy header hợp lệ trong 10 dòng đầu" };
        }
      }

      // Map header columns
      if (headers && rowIndex === headerRowIndex) {
        headers.forEach((h, i) => {
          const t = (h || "").toLowerCase();
          if (/start\s*time/.test(t)) startCol = i;
          if (/total\s*yield/.test(t)) yieldCol = i;
          if (/manageobject|device name|inverter/.test(t)) invCol = i;
          if (t.includes("site name")) siteCol = i;
        });
      }

      // Data rows
      if (headers && rowIndex > headerRowIndex) {
        const rawT = cells[startCol];
        const rawE = cells[yieldCol];
        const rawInv = cells[invCol];

        if (siteName == null && siteCol !== -1) {
          const sn = cells[siteCol];
          if (sn) siteName = sn;
        }

        const day = normalizeDate(rawT);
        if (!day || !rawInv || !rawE) { rowIndex++; continue; }

        const inv = normalizeInverter(rawInv);
        if (!inv) { rowIndex++; continue; }

        const numStr = String(rawE).replace(/[\,\s]/g,"");
        if (/^(na|null|undefined)$/i.test(numStr) || numStr==="") {
          rowIndex++; continue;
        }

        const eac = Number(numStr);
        if (!Number.isFinite(eac)) { rowIndex++; continue; }

        if (!invDayMap[day]) invDayMap[day] = {};
        if (!invDayMap[day][inv]) invDayMap[day][inv] = {min:eac,max:eac};
        else {
          invDayMap[day][inv].min = Math.min(invDayMap[day][inv].min,eac);
          invDayMap[day][inv].max = Math.max(invDayMap[day][inv].max,eac);
        }

        parsedRecordsCount++;
      }

      rowIndex++;
    }
  }

  // Aggregate
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

  const keys = Object.keys(daily).sort();
  return {
    success: true,
    siteName,
    dailyProduction: daily,
    dailyProductionTotal: keys.reduce((a,d)=>a+daily[d],0),
    firstDay: keys[0] || null,
    lastDay: keys[keys.length - 1] || null,
    parsedRecordsCount
  };
}

export default { streamParseAndCompute };
