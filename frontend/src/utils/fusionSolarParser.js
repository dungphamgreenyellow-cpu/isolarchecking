// === /src/utils/fusionSolarParser.js — v10.1-LTS (Keep Text Columns for Status) ===
// ✅ Parse all measurable numeric & text columns (Active Power, Status, Voltage, etc.)
// ✅ Multi-language header detection (EN/VN/ZH)
// ✅ Outputs: { valid, totalProduction, dailyProduction[], records[], availableMetrics[] }

import * as XLSX from "xlsx";

export async function checkFusionSolarPeriod(file) {
  try {
    const ext = file.name.split(".").pop().toLowerCase();
    const ab = await file.arrayBuffer();

    // Suppress noisy XLSX warnings
    const prevErr = console.error;
    console.error = (...args) => {
      if (typeof args[0] === "string" && args[0].includes("Bad uncompressed size")) return;
      prevErr(...args);
    };
    let workbook;
    try {
      workbook =
        ext === "csv"
          ? XLSX.read(await new Response(ab).text(), { type: "string" })
          : XLSX.read(ab, { type: "array" });
    } finally {
      console.error = prevErr;
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!raw?.length) throw new Error("Empty or invalid file.");

    const norm = (s) =>
      String(s || "")
        .replace(/\s+/g, "")
        .replace(/[^\w()/%\-]/g, "")
        .toLowerCase();

    const TIME_KEYS = ["time", "timestamp", "采集时间", "thờigian", "starttime"];
    const TOTAL_YIELD_KEYS = ["totalyield", "totalenergy", "累计发电量", "annualenergy(kwh)"];
    const MANAGE_OBJ_KEYS = ["manageobject", "inverter", "设备名称"];

    // --- locate header row ---
    let headerRow = -1;
    for (let i = 0; i < Math.min(raw.length, 30); i++) {
      const rowN = raw[i].map(norm);
      if (
        rowN.some((h) => TIME_KEYS.some((k) => h.includes(k))) &&
        rowN.some((h) => MANAGE_OBJ_KEYS.some((k) => h.includes(k)))
      ) {
        headerRow = i;
        break;
      }
    }
    if (headerRow === -1) throw new Error("Header not found.");

    const headers = raw[headerRow];
    const nHeaders = headers.map(norm);
    const dataRows = raw.slice(headerRow + 1);

    const timeIdx = nHeaders.findIndex((h) => TIME_KEYS.some((k) => h.includes(k)));
    const invIdx = nHeaders.findIndex((h) => MANAGE_OBJ_KEYS.some((k) => h.includes(k)));
    const totalIdx = nHeaders.findIndex((h) => TOTAL_YIELD_KEYS.some((k) => h.includes(k)));

    if (timeIdx === -1 || invIdx === -1)
      throw new Error("Missing Time or Inverter column.");

    const parseExcelTime = (v) => {
      if (v == null || v === "") return null;
      if (typeof v === "number") {
        const ms = Math.round((v - 25569) * 86400 * 1000);
        const d = new Date(ms);
        return isNaN(d) ? null : d;
      }
      const s = String(v).trim();
      const d1 = new Date(s);
      return isNaN(d1) ? null : d1;
    };

    const dayKeyLocal = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

    const cleanNum = (val) => {
      if (val == null || val === "") return NaN;
      let s = String(val).replace(/[^\d.,\-]/g, "").trim();
      if (!s) return NaN;
      const comma = (s.match(/,/g) || []).length;
      const dot = (s.match(/\./g) || []).length;
      if (comma > 0 && dot > 0) s = s.replace(/\./g, "").replace(",", ".");
      else if (comma > 0 && dot === 0) s = s.replace(",", ".");
      const n = parseFloat(s);
      return isNaN(n) ? NaN : n;
    };

    // === Collect records ===
    const records = [];
    const inverterMap = new Map();

    for (const row of dataRows) {
      const t = parseExcelTime(row[timeIdx]);
      if (!t) continue;
      const inv = String(row[invIdx] || "Unknown").trim();
      const dKey = dayKeyLocal(t);

      // Tạo record chi tiết
      const rec = {
        time: t.toISOString(),
        day: dKey,
        inverter: inv,
      };

      // --- Cập nhật giữ lại cả text & numeric fields ---
      headers.forEach((h, i) => {
        if (i === timeIdx || i === invIdx) return;
        const rawVal = row[i];
        const numVal = cleanNum(rawVal);
        if (!isNaN(numVal)) {
          rec[headers[i].trim()] = numVal;
        } else if (typeof rawVal === "string" && rawVal.trim() !== "") {
          rec[headers[i].trim()] = rawVal.trim();
        }
      });

      records.push(rec);

      // --- Thu thập production cho daily map ---
      const e = cleanNum(row[totalIdx]);
      if (!isNaN(e)) {
        if (!inverterMap.has(inv)) inverterMap.set(inv, new Map());
        const dayMap = inverterMap.get(inv);
        if (!dayMap.has(dKey)) dayMap.set(dKey, []);
        dayMap.get(dKey).push(e);
      }
    }

    // === Daily production summary ===
    const perDay = new Map();
    for (const [, dayMap] of inverterMap.entries()) {
      for (const [day, vals] of dayMap.entries()) {
        const diff = Math.max(0, Math.max(...vals) - Math.min(...vals));
        perDay.set(day, (perDay.get(day) || 0) + diff);
      }
    }

    const allDays = Array.from(perDay.keys()).sort();
    if (!allDays.length) {
      return {
        valid: false,
        message: "No valid data rows.",
        totalProduction: 0,
        dailyProduction: [],
        records: [],
      };
    }

    const startDate = allDays[0];
    const endDate = allDays[allDays.length - 1];
    const diffDays = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
    const totalProduction = Math.round([...perDay.values()].reduce((a, b) => a + b, 0));

    // === List of all available numeric metrics ===
    const metricSet = new Set();
    records.forEach((r) => {
      Object.keys(r).forEach((k) => {
        if (!["time", "day", "inverter"].includes(k)) metricSet.add(k);
      });
    });

    // === Log 1 record for debug ===
    console.log("🔍 Sample parsed record:", records[0]);

    // === Return final structured result ===
    return {
      valid: diffDays <= 31,
      startDate,
      endDate,
      days: diffDays,
      totalProduction,
      dailyProduction: allDays.map((d) => ({
        date: d,
        production: Math.round(perDay.get(d)),
      })),
      records,
      availableMetrics: Array.from(metricSet),
      message: `✅ OK — ${diffDays} days (${startDate} → ${endDate}), metrics: ${metricSet.size}`,
    };
  } catch (err) {
    console.error("⚠️ FusionSolar parse error:", err);
    return {
      valid: false,
      message: "Error parsing file",
      totalProduction: 0,
      dailyProduction: [],
      records: [],
    };
  }
}
