// backend/compute/fusionSolarParser.js — CSV streaming only (v9.9-LTS baseline)
import { parse } from "csv-parse";
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
  try {
    const magic = buffer?.slice?.(0, 4)?.toString?.();
    const isXlsx = magic === "PK\u0003\u0004"; // ZIP header for XLSX
    let csvReadable;

    if (isXlsx) {
      console.warn("[FusionSolarParser] XLSX file detected. Please export FusionSolar log as CSV and upload the CSV file for best performance.");
      return {
        success: false,
        error: "XLSX file detected. Please export FusionSolar log as CSV from FusionSolar and upload the CSV file instead of XLSX.",
      };
    } else {
      // CSV buffer → UTF-8 text → stream
      const text = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer || "");
      if (!text) return { success: false, note: "Empty CSV buffer" };
      csvReadable = Readable.from(text);
    }

    return await new Promise((resolve, reject) => {
      const parser = parse({ relax_column_count: true, skip_empty_lines: true });

      const REQUIRED = ["start time", "total yield(kwh)", "manageobject"];
      let rowIndex = 0;
      let headerRowIndex = -1;
      let bestScore = -1;
      let headers = null;
      let startTimeCol = -1;
      let totalYieldColIndex = -1;
      let inverterColIndex = -1;
      let siteNameColIndex = -1;

      const invDayMap = {};
      let siteName = null;
      let parsedRecordsCount = 0;
      let headerLocked = false;

      const considerHeader = (row, i) => {
        const lower = row.map((s) => String(s || "").trim().toLowerCase());
        const score = REQUIRED.reduce(
          (acc, key) => acc + (lower.some((cell) => cell.includes(key)) ? 1 : 0),
          0
        );
        if (i === 3 && score >= 3) {
          headerRowIndex = i;
          bestScore = score;
          return true;
        }
        if (score > bestScore) {
          bestScore = score;
          headerRowIndex = i;
        }
        return false;
      };

      parser.on("readable", () => {
        let rec;
        while ((rec = parser.read())) {
          const row = (rec || []).map((c) => (c == null ? "" : String(c).trim()));

          // Header discovery within first 10 rows
          if (!headerLocked && rowIndex < 10) {
            const locked = considerHeader(row, rowIndex);
            if (rowIndex === 9 && (headerRowIndex === -1 || bestScore <= 0)) {
              // fail fast if not found in first 10 rows
              csvReadable.destroy();
              parser.destroy();
              return resolve({ success: false, message: "Không tìm thấy header FusionSolar hợp lệ trong 10 dòng đầu" });
            }
            if (locked) headerLocked = true;
          }

          // When we hit the header row, capture headers and locate columns
          if (rowIndex === headerRowIndex && !headers) {
            headers = row.slice();
            // Locate required columns
            headers.forEach((cell, i) => {
              const txt = (cell || "").toString().trim().toLowerCase();
              if (/start\s*time/.test(txt)) startTimeCol = i;
              if (/total\s*yield.*kwh/.test(txt)) totalYieldColIndex = i;
              if (
                txt === "manageobject" ||
                txt === "device name" ||
                txt === "inverter" ||
                txt === "inverter name"
              )
                inverterColIndex = i;
              if (txt.includes("site name")) siteNameColIndex = i;
            });
            if (inverterColIndex === -1) {
              headers.forEach((cell, i) => {
                const txt = (cell || "").toString().trim().toLowerCase();
                if (/(manageobject|device name|inverter|inverter name)/.test(txt)) inverterColIndex = i;
              });
            }
          }

          // Process data rows
          if (headers && rowIndex > headerRowIndex) {
            const rawT = row[startTimeCol];
            const rawMo = row[inverterColIndex];
            const rawEac = row[totalYieldColIndex];
            if (siteName == null && siteNameColIndex !== -1) {
              const sn = row[siteNameColIndex];
              if (sn != null && String(sn).trim() !== "") siteName = String(sn).trim();
            }

            if (rawT != null && rawMo != null && rawEac != null) {
              const day = toYMD(rawT);
              if (day) {
                const inv = normalizeInverter(rawMo);
                // sanitize EAC number
                const s = String(rawEac).trim();
                const isNA = s === "" || /^na$/i.test(s) || /^null$/i.test(s) || /^undefined$/i.test(s);
                if (inv && !isNA) {
                  const num = Number(s.replace(/[,\s]/g, ""));
                  if (Number.isFinite(num)) {
                    if (!invDayMap[day]) invDayMap[day] = {};
                    if (!invDayMap[day][inv]) invDayMap[day][inv] = { min: num, max: num };
                    else {
                      if (num < invDayMap[day][inv].min) invDayMap[day][inv].min = num;
                      if (num > invDayMap[day][inv].max) invDayMap[day][inv].max = num;
                    }
                    parsedRecordsCount++;
                  }
                }
              }
            }
          }

          rowIndex++;
        }
      });

      parser.on("end", () => {
        if (!headers || startTimeCol === -1 || totalYieldColIndex === -1 || inverterColIndex === -1) {
          return resolve({ success: false, message: "Header thiếu cột bắt buộc", hint: headers || [] });
        }

        // Aggregate daily production
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

        resolve({
          success: true,
          siteName,
          dailyProduction: daily,
          dailyProductionTotal: dayKeys.reduce((acc, d) => acc + (daily[d] || 0), 0),
          firstDay,
          lastDay,
          parsedRecordsCount,
          allHeaders: headers,
        });
      });

      parser.on("error", (err) => reject(err));
      csvReadable.on("error", (err) => reject(err));
      csvReadable.pipe(parser);
    });
  } catch (err) {
    return { success: false, note: `Parse failed: ${err?.message || err}` };
  }
}
