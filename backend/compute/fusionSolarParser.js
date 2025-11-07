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
      // v9.10-dev — Fix flexible header detection, prevent parse crash
      console.log("[FusionSolarParser] Đang đọc file XLSX...");
      const wb = XLSX.read(buffer, { type: "buffer" });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      // === [v9.9-Flex++ Optimized Header Detection] ===
      const HEADER_KEYWORDS = [
        { key: "manageobject", weight: 1 },
        { key: "start time", weight: 1 },
        { key: "active power", weight: 1 },
        { key: "total yield", weight: 1 },
      ];

      let headerRowIndex = -1;
      let headerScore = 0;
      for (let i = 0; i < 10; i++) {
        const row = XLSX.utils.sheet_to_json(ws, { header: 1, range: i, raw: false })[0];
        if (!row) continue;
        const lower = row.map((c) => (c || "").toString().toLowerCase());
        let score = 0;
        HEADER_KEYWORDS.forEach((k) => {
          if (lower.some((cell) => cell.includes(k.key))) score += k.weight;
        });
        if (score >= 3) {
          headerRowIndex = i;
          headerScore = score;
          console.log(`[FusionSolarParser] Header xác định tại dòng ${i} (điểm ${score})`);
          break;
        }
      }

      if (headerRowIndex === -1) {
        console.warn("[FusionSolarParser] Không tìm thấy header FusionSolar hợp lệ trong 10 dòng đầu.");
        return { success: false, message: "Không tìm thấy header FusionSolar hợp lệ (cần ManageObject, Start Time, Active power, Total yield)" };
      }

      console.log(`[FusionSolarParser] Sử dụng header dòng ${headerRowIndex}`);
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      if (!rows || rows.length === 0) {
        return { success: false, note: "Empty XLSX worksheet" };
      }
      const header = (rows[headerRowIndex] || []).map((h) => (typeof h === "string" ? h.trim() : h));
      const startIdx = headerRowIndex + 1;
      const dataRows = rows.slice(startIdx);

  // Flexible header detection: detect Start Time, Total yield(kWh), and Inverter/ManageObject columns
  // TODO: consider broader localization variants of FusionSolar headers (e.g., non-English)
  const headers = header.map(h => (h == null ? null : String(h)));
  console.log("[FusionSolarParser] Headers đọc được:", headers);
      let startTimeCol = -1, totalYieldColIndex = -1, inverterColIndex = -1;
      headers.forEach((cell, i) => {
        const txt = (cell || "").toString().trim().toLowerCase();
        if (/start\s*time/i.test(txt)) startTimeCol = i;
        if (/total.*yield.*kwh/i.test(txt)) totalYieldColIndex = i;
        // Prefer specific known headers; avoid matching 'Management Domain'
        if (txt === 'manageobject' || txt === 'device name' || txt === 'inverter' || txt === 'inverter name') {
          inverterColIndex = i;
        }
      });

      // If not found by exact known headers, try a safer fallback that won't match 'management domain'
      if (inverterColIndex === -1) {
        headers.forEach((cell, i) => {
          const txt = (cell || "").toString().trim().toLowerCase();
          if (/(manageobject|device name|inverter|inverter name)/i.test(txt)) inverterColIndex = i;
        });
      }

      if (startTimeCol === -1 || totalYieldColIndex === -1 || inverterColIndex === -1) {
        console.warn("[FusionSolarParser] Header thiếu:", headers);
        // NOTE: return non-throwing failure so FE can show friendly message
        return { success: false, message: "Header thiếu cột bắt buộc", hint: headers };
      }

      console.log("[FusionSolarParser] Header phát hiện:", headers.slice(0, 10));

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
      const manageObjectColIndex = (inverterColIndex !== -1)
        ? inverterColIndex
        : manageHeaderCandidates
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
  // Prefer detected header indices; fall back to key lookup
  const rawT = (startTimeCol !== -1) ? r[startTimeCol] : tKeys.map((k) => obj[k]).find((v) => v != null && v !== "");
  const rawMo = (manageObjectColIndex != null) ? r[manageObjectColIndex] : invKeys.map((k) => obj[k]).find((v) => v != null && v !== "");
  const rawEac = (totalYieldColIndex !== -1) ? r[totalYieldColIndex] : null;
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
