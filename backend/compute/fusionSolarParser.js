// backend/compute/fusionSolarParser.js — XLSX -> CSV -> streaming parse
import { parse } from "csv-parse";
import * as XLSX from "xlsx";

const trim = (s) => (typeof s === "string" ? s.trim() : s);
const toYMD = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export async function streamParseAndCompute(buffer) {
  // Only handle XLSX by converting to CSV, then parse via csv-parse
  if (buffer?.slice?.(0, 4)?.toString?.() === "PK\u0003\u0004") {
    try {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      if (!ws) return { success: false, note: "Empty XLSX worksheet" };

      // Convert first sheet to CSV string
      const csvString = XLSX.utils.sheet_to_csv(ws, { FS: ",", RS: "\n" });

      // Parse CSV into records (array of arrays)
      const records = await new Promise((resolve, reject) => {
        parse(csvString, { columns: false, relax_column_count: true, skip_empty_lines: true }, (err, out) => {
          if (err) reject(err);
          else resolve(out);
        });
      });
      if (!records || records.length === 0) return { success: false, note: "Empty CSV after XLSX conversion" };

      // Header detection: scan first 10 lines; prefer row index = 3 if it matches required headers
      const REQUIRED = ["start time", "total yield(kwh)", "manageobject"];
      let headerRowIndex = -1;
      let bestScore = -1;
      for (let i = 0; i < Math.min(10, records.length); i++) {
        const row = (records[i] || []).map((c) => (c == null ? "" : String(c))).map((s) => s.trim());
        const lower = row.map((s) => s.toLowerCase());
        const score = REQUIRED.reduce((acc, key) => acc + (lower.some((cell) => cell.includes(key)) ? 1 : 0), 0);
        // Prefer index 3 if it fully matches (>80% of 3 → 3)
        if (i === 3 && score >= 3) {
          headerRowIndex = i;
          bestScore = score;
          break;
        }
        if (score > bestScore) {
          bestScore = score;
          headerRowIndex = i;
        }
      }
      if (headerRowIndex === -1 || bestScore <= 0) {
        return { success: false, message: "Không tìm thấy header FusionSolar hợp lệ trong 10 dòng đầu" };
      }

      const header = (records[headerRowIndex] || []).map((h) => (h == null ? null : String(h).trim()));
      const headers = header.map((h) => (h == null ? null : String(h)));

      // Locate required columns
      let startTimeCol = -1;
      let totalYieldColIndex = -1;
      let inverterColIndex = -1;
      let siteNameColIndex = -1;
      headers.forEach((cell, i) => {
        const txt = (cell || "").toString().trim().toLowerCase();
        if (/start\s*time/.test(txt)) startTimeCol = i;
        if (/total\s*yield.*kwh/.test(txt)) totalYieldColIndex = i;
        if (txt === "manageobject" || txt === "device name" || txt === "inverter" || txt === "inverter name") inverterColIndex = i;
        if (txt.includes("site name")) siteNameColIndex = i;
      });
      if (inverterColIndex === -1) {
        headers.forEach((cell, i) => {
          const txt = (cell || "").toString().trim().toLowerCase();
          if (/(manageobject|device name|inverter|inverter name)/.test(txt)) inverterColIndex = i;
        });
      }
      if (startTimeCol === -1 || totalYieldColIndex === -1 || inverterColIndex === -1) {
        return { success: false, message: "Header thiếu cột bắt buộc", hint: headers };
      }

      // Parse data rows
      const startIdx = headerRowIndex + 1;
      const invDayMap = {};
      let siteName = null;
      let parsedRecordsCount = 0;

      for (let r = startIdx; r < records.length; r++) {
        const row = records[r];
        if (!row || row.length === 0) continue;

        const rawT = row[startTimeCol];
        const rawMo = row[inverterColIndex];
        const rawEac = row[totalYieldColIndex];
        if (siteName == null && siteNameColIndex !== -1) {
          const sn = row[siteNameColIndex];
          if (sn != null && String(sn).trim() !== "") siteName = String(sn).trim();
        }
        if (rawT == null || rawMo == null || rawEac == null) continue;

        const day = toYMD(rawT);
        if (!day) continue;

        // Normalize inverter: take token before '/'
        const inv = String(rawMo).split("/")[0].trim();
        const val = Number(String(rawEac).replace(/[, ]/g, ""));
        if (!Number.isFinite(val)) continue;

        if (!invDayMap[day]) invDayMap[day] = {};
        if (!invDayMap[day][inv]) invDayMap[day][inv] = { min: val, max: val };
        else {
          if (val < invDayMap[day][inv].min) invDayMap[day][inv].min = val;
          if (val > invDayMap[day][inv].max) invDayMap[day][inv].max = val;
        }
        parsedRecordsCount++;
      }

      // Aggregate daily production (max-min per inverter)
      const daily = {};
      for (const day of Object.keys(invDayMap)) {
        let sum = 0;
        for (const inv of Object.keys(invDayMap[day])) {
          const { min, max } = invDayMap[day][inv];
          const energy = Math.max(0, max - min);
          if (energy > 0) sum += energy;
        }
        daily[day] = sum;
      }

      const dayKeys = Object.keys(daily).sort();
      const firstDay = dayKeys.length ? dayKeys[0] : null;
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
      return { success: false, note: `XLSX parse failed: ${err?.message || err}` };
    }
  }
  // CSV path removed — only handle XLSX via CSV conversion
}
