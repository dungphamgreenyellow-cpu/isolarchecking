// === /server/compute/fusionSolarParser.js — v9.9.2 Cloud Edition ===
// ✅ Works with Node Buffer (express-fileupload)
// ✅ Auto detects EN/VN/ZH headers
// ✅ Calculates ΔTotalYield per inverter per day
// ✅ ≤ 31 days range validation

import * as XLSX from "xlsx";

export async function checkFusionSolarPeriod(file) {
  try {
    if (!file?.data) throw new Error("Invalid file buffer");
    const ext = file.name.split(".").pop().toLowerCase();

    const workbook =
      ext === "csv"
        ? XLSX.read(file.data.toString("utf-8"), { type: "string" })
        : XLSX.read(file.data, { type: "buffer" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!raw?.length) throw new Error("Empty or invalid file");

    const norm = (s) =>
      String(s || "")
        .replace(/\s+/g, "")
        .replace(/[^\w()/%\-]/g, "")
        .toLowerCase();

    const TIME_KEYS = ["time", "timestamp", "采集时间", "thờigian", "starttime"];
    const TOTAL_KEYS = ["totalyield", "totalenergy", "累计发电量"];
    const INV_KEYS = ["manageobject", "inverter", "设备名称"];

    let headerRow = -1;
    for (let i = 0; i < Math.min(raw.length, 30); i++) {
      const n = raw[i].map(norm);
      if (
        n.some((h) => TIME_KEYS.some((k) => h.includes(k))) &&
        n.some((h) => INV_KEYS.some((k) => h.includes(k)))
      ) {
        headerRow = i;
        break;
      }
    }
    if (headerRow === -1) throw new Error("Header not found");

    const headers = raw[headerRow];
    const nHeaders = headers.map(norm);
    const data = raw.slice(headerRow + 1);

    const tIdx = nHeaders.findIndex((h) => TIME_KEYS.some((k) => h.includes(k)));
    const invIdx = nHeaders.findIndex((h) => INV_KEYS.some((k) => h.includes(k)));
    const totalIdx = nHeaders.findIndex((h) => TOTAL_KEYS.some((k) => h.includes(k)));

    const parseExcelTime = (v) => {
      if (typeof v === "number") return new Date((v - 25569) * 86400 * 1000);
      const d = new Date(v);
      return isNaN(d) ? null : d;
    };

    const cleanNum = (val) => {
      if (val == null || val === "") return NaN;
      let s = String(val).replace(/[^\d.,\-]/g, "");
      if (!s) return NaN;
      const comma = (s.match(/,/g) || []).length;
      const dot = (s.match(/\./g) || []).length;
      if (comma > 0 && dot > 0) s = s.replace(/\./g, "").replace(",", ".");
      else if (comma > 0 && dot === 0) s = s.replace(",", ".");
      const n = parseFloat(s);
      return isNaN(n) ? NaN : n;
    };

    const inverterMap = new Map();
    for (const r of data) {
      const t = parseExcelTime(r[tIdx]);
      if (!t) continue;
      const day = t.toISOString().slice(0, 10);
      const inv = String(r[invIdx] || "Unknown");
      const e = cleanNum(r[totalIdx]);
      if (isNaN(e)) continue;
      if (!inverterMap.has(inv)) inverterMap.set(inv, new Map());
      const dMap = inverterMap.get(inv);
      if (!dMap.has(day)) dMap.set(day, []);
      dMap.get(day).push(e);
    }

    const perDay = new Map();
    for (const [, dMap] of inverterMap.entries()) {
      for (const [day, vals] of dMap.entries()) {
        const diff = Math.max(0, Math.max(...vals) - Math.min(...vals));
        perDay.set(day, (perDay.get(day) || 0) + diff);
      }
    }

    const days = [...perDay.keys()].sort();
    const start = days[0];
    const end = days[days.length - 1];
    const span = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    const totalProduction = Math.round([...perDay.values()].reduce((a, b) => a + b, 0));

    return {
      success: true,
      valid: span <= 31,
      startDate: start,
      endDate: end,
      totalProduction,
      dailyProduction: days.map((d) => ({
        date: d,
        production: Math.round(perDay.get(d)),
      })),
      availableMetrics: [],
      message: `✅ OK — ${span} days (${start} → ${end}) — ${totalProduction.toLocaleString()} kWh`,
    };
  } catch (err) {
    console.error("⚠️ FusionSolar parse error:", err);
    return { success: false, message: err.message || "Error parsing file" };
  }
}
