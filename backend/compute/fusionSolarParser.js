// backend/compute/fusionSolarParser.js — CSV Streaming Parser (fast baseline)
import { Readable } from "stream";
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
  // If XLSX (ZIP signature PK\u0003\u0004), parse via xlsx
  if (buffer?.slice?.(0, 4)?.toString?.() === "PK\u0003\u0004") {
    try {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      if (!rows || rows.length === 0) {
        return { success: false, note: "Empty XLSX worksheet" };
      }

      // Auto-detect header row within first 6 rows by letter ratio and density
      const range = XLSX.utils.decode_range(ws['!ref']);
      let headerRowIndex = range.s.r; // default to first row
      let detectedHeaderValues = null;
      for (let r = range.s.r; r < Math.min(range.s.r + 6, range.e.r + 1); r++) {
        const rowValues = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          rowValues.push(cell ? String(cell.v).trim() : "");
        }
        const nonEmpty = rowValues.filter(v => v !== "").length;
        const letterCount = rowValues.filter(v => /[A-Za-z]/.test(v)).length;
        if ((letterCount / (nonEmpty || 1)) > 0.6 && nonEmpty >= 10) {
          headerRowIndex = r;
          detectedHeaderValues = rowValues;
          break;
        }
      }

      // If not detected by heuristic, fall back to first non-empty row in rows[]
      if (!detectedHeaderValues) {
        const firstNonEmpty = rows.find(r => Array.isArray(r) && r.some(v => v != null && String(v).trim() !== "")) || rows[0] || [];
        detectedHeaderValues = firstNonEmpty.map(h => (typeof h === "string" ? h.trim() : h));
        // best-effort mapping headerRowIndex to rows index
        headerRowIndex = range.s.r + rows.indexOf(firstNonEmpty);
      }

      const header = detectedHeaderValues.map(h => (typeof h === "string" ? h.trim() : h));
      const startIdx = (headerRowIndex - range.s.r + 1);
      const dataRows = rows.slice(startIdx);

      // Determine EAC column: ONLY accept exact "Total yield(kWh)"
      const headers = header.map(h => (h == null ? null : String(h)));
      const totalYieldColIndex = headers.findIndex(
        (h) => typeof h === "string" && h.trim().toLowerCase() === "total yield(kwh)"
      );
      if (totalYieldColIndex === -1) {
        throw new Error("Không tìm thấy cột Total yield(kWh)");
      }

  const tKeys = ["Start Time", "StartTime", "Time", "Timestamp"];
  const invKeys = ["ManageObject", "Device name", "Inverter", "Inverter Name"];

      const colCount = header.length;
      const toYMD = (val) => {
        try {
          if (typeof val === "number") {
            // Excel date serial → format then to Date
            const s = XLSX.SSF.format("yyyy-mm-dd HH:MM:ss", val);
            const d = new Date(s.replace(/\//g, "-"));
            const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
          }
          if (typeof val === "string") {
            const d = new Date(val);
            if (!isNaN(d)) { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }
          }
        } catch {}
        return null;
      };

      // === Inverter normalization based on unique tokens across all ManageObject values ===
      function tokenize(str) {
        return String(str)
          .split(/[\s\/\-()_]+/)
          .filter(Boolean);
      }
      function extractUniqueTokens(allManageObjects) {
        const freq = {};
        for (const obj of allManageObjects) {
          const tokens = new Set(tokenize(obj));
          for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
        }
        const totalObjs = allManageObjects.length || 1;
        return Object.keys(freq).filter((t) => freq[t] < totalObjs);
      }

      // Determine ManageObject column index from headers
      const manageHeaderCandidates = ["ManageObject", "Device name", "Inverter", "Inverter Name"];
      const manageObjectColIndex = manageHeaderCandidates
        .map((h) => headers.indexOf(h))
        .find((i) => i !== -1);

      const rawManageObjects = (manageObjectColIndex != null)
        ? dataRows.map((r) => r?.[manageObjectColIndex]).filter((v) => v != null)
        : [];
      const uniqueTokens = extractUniqueTokens(rawManageObjects);
      function normalizeInverterName(raw) {
        const tokens = tokenize(raw);
        const diff = tokens.find((t) => uniqueTokens.includes(t));
        return `INV-${diff}`;
      }

      const invDayMap = {}; // { day: { INV-*: {min, max} } }
      let parsedRecordsCount = 0;

      for (const r of dataRows) {
        if (!r || r.length === 0) continue;
        // Build a tiny object map for key lookup convenience
        const obj = {};
        for (let i = 0; i < colCount; i++) {
          const key = header[i] ?? `__col_${i}`;
          obj[key] = r[i] === undefined ? null : r[i];
        }
        // pick required fields
        const rawT = tKeys.map((k) => obj[k]).find((v) => v != null && v !== "");
        const rawMo = (manageObjectColIndex != null) ? r[manageObjectColIndex] : invKeys.map((k) => obj[k]).find((v) => v != null && v !== "");
        const rawEac = r[totalYieldColIndex];
        if (!rawT || !rawMo || rawEac == null) continue;

        const day = toYMD(rawT);
        if (!day) continue;
        const inv = normalizeInverterName(rawMo);
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

      const daily = {};
      let dailyProductionTotal = 0;
      for (const day of Object.keys(invDayMap)) {
        let sum = 0;
        for (const inv of Object.keys(invDayMap[day])) {
          const { min, max } = invDayMap[day][inv];
          const energy = Math.max(0, max - min);
          if (energy > 0) sum += energy;
        }
        daily[day] = sum;
      }
      for (const d in daily) dailyProductionTotal += daily[d];

      // Determine overall first/last day from aggregated daily keys
      const dayKeys = Object.keys(daily).sort();
      const firstDay = dayKeys.length ? dayKeys[0] : null;
      const lastDay = dayKeys.length ? dayKeys[dayKeys.length - 1] : null;

      return {
        success: true,
        dailyProduction: daily,
        dailyProductionTotal,
        firstDay,
        lastDay,
        parsedRecordsCount,
        allHeaders: headers,
      };
    } catch (err) {
      return { success: false, note: `XLSX parse failed: ${err?.message || err}` };
    }
  }
  // CSV path removed — XLSX-only parser
}
