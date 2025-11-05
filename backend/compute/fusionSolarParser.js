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
      // Prefer header at Excel row 4 (index 3) similar to FE worker; fallback to first row
      const header = rows[3] && rows[3].some(v => v != null) ? rows[3].map(h => (typeof h === "string" ? h.trim() : h)) : rows[0].map(h => (typeof h === "string" ? h.trim() : h));
      const startIdx = (rows[3] && rows[3].some(v => v != null)) ? 4 : 1;
      const dataRows = rows.slice(startIdx);

      // Determine EAC column by instruction
      const exactEacNames = ["Total yield(kWh)"]; // exact only
      const aliasEacNames = [
        "Feed-in energy(kWh)",
        "Annual energy(kWh)",
        "Accumulated amount of absorbed electricity(kWh)",
        "Total Yield (kWh)",
      ];
      const forbidden = ["Total PV yield(kWh)"];

      const headers = header.map(h => (h == null ? null : String(h)));
      let eacCol = null;
      for (const name of exactEacNames) {
        const idx = headers.indexOf(name);
        if (idx !== -1) { eacCol = name; break; }
      }
      if (!eacCol) {
        for (const name of aliasEacNames) {
          const idx = headers.indexOf(name);
          if (idx !== -1) { eacCol = name; break; }
        }
      }
      if (forbidden.includes(eacCol)) eacCol = null;

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

      const perInvDay = new Map();
      let parsedRecordsCount = 0;

      for (const r of dataRows) {
        if (!r || r.length === 0) continue;
        const obj = {};
        for (let i = 0; i < colCount; i++) {
          const key = header[i] ?? `__col_${i}`;
          obj[key] = (r[i] === undefined) ? null : r[i];
        }
        // pick columns
        const rawT = tKeys.map(k => obj[k]).find(v => v != null && v !== "");
        const rawInv = invKeys.map(k => obj[k]).find(v => v != null && v !== "");
        const rawEac = eacCol ? obj[eacCol] : null;
        if (!rawT || !rawInv || rawEac == null) continue;

        const day = toYMD(rawT);
        if (!day) continue;
        let inv = String(rawInv).split("/")[0].trim().replace(/\s+/g, "");
        inv = inv.startsWith("INV-") ? inv : `INV-${inv}`;
        const val = Number(String(rawEac).replace(/[, ]/g, ""));
        if (!Number.isFinite(val)) continue;

        const key = inv + "|" + day;
        const cur = perInvDay.get(key);
        if (!cur) perInvDay.set(key, { min: val, max: val });
        else { if (val < cur.min) cur.min = val; if (val > cur.max) cur.max = val; }
        parsedRecordsCount++;
      }

      const daily = {};
      let dailyProductionTotal = 0;
      for (const [key, { min, max }] of perInvDay.entries()) {
        const day = key.split("|")[1];
        const prod = Math.max(0, max - min);
        daily[day] = (daily[day] || 0) + prod;
      }
      for (const d in daily) dailyProductionTotal += daily[d];

      return {
        success: true,
        dailyProduction: daily,
        dailyProductionTotal,
        parsedRecordsCount,
        allHeaders: headers,
      };
    } catch (err) {
      return { success: false, note: `XLSX parse failed: ${err?.message || err}` };
    }
  }

  const perInvDay = new Map();
  let firstDay = null, lastDay = null;
  let eacCol = null; // determined from headers (first row keys)

  const parser = parse({ columns: true, skip_empty_lines: true, bom: true, trim: true });
  const stream = Readable.from(buffer).pipe(parser);

  for await (const row of stream) {
    // Determine EAC column once using header names from the first row
    if (!eacCol) {
      const headers = Object.keys(row);
      // Bắt buộc ưu tiên đúng counter:
      const exactEacNames = [
        "Total yield(kWh)",    // tên chuẩn
        "Total Yield(kWh)",
        "Total Yield (kWh)"
      ];

      // Alias hợp lệ bổ sung:
      const aliasEacNames = [
        "Accumulated amount of absorbed electricity(kWh)",
        "Feed-in energy(kWh)",
        "Annual energy(kWh)",
        "Yield(kWh)"
      ];

      // Cột sai tuyệt đối cần loại bỏ:
      const forbidden = ["Total PV yield(kWh)"];

      // Tìm cột đúng
      for (const name of exactEacNames) {
        if (headers.includes(name)) {
          eacCol = name;
          break;
        }
      }
      if (!eacCol) {
        for (const name of aliasEacNames) {
          if (headers.includes(name)) {
            eacCol = name;
            break;
          }
        }
      }
      // Chặn trường hợp match nhầm
      if (forbidden.some(f => eacCol === f)) {
        eacCol = null;
      }

      // Debug chọn cột EAC
      console.log("[DEBUG] EAC Column Selected:", eacCol);
    }

    const t = row["Start Time"] ?? row["StartTime"] ?? row["Time"];
    const mo = row["ManageObject"] ?? row["Device name"] ?? row["Inverter"];
    const eac = eacCol ? row[eacCol] : undefined;
    if (!t || !mo || eac == null) continue;

    const day = toYMD(t);
    const inv = ("INV-" + String(mo).split("/")[0].replace(/\s+/g, "")).replace("INV-INV-", "INV-");
    const val = Number(String(eac).replace(/[, ]/g, ""));
    if (!Number.isFinite(val)) continue;

    if (!firstDay || day < firstDay) firstDay = day;
    if (!lastDay || day > lastDay) lastDay = day;

    const key = inv + "|" + day;
    const cur = perInvDay.get(key);
    if (!cur) perInvDay.set(key, { min: val, max: val });
    else { if (val < cur.min) cur.min = val; if (val > cur.max) cur.max = val; }
  }

  const daily = {};
  let total = 0;
  for (const [key, { min, max }] of perInvDay.entries()) {
    const day = key.split("|")[1];
    const prod = Math.max(0, max - min);
    daily[day] = (daily[day] || 0) + prod;
  }
  for (const d in daily) total += daily[d];

  const days = firstDay && lastDay ? (new Date(lastDay) - new Date(firstDay)) / 86400000 + 1 : 0;
  return { success: true, firstDay, lastDay, days, dailyProduction: daily, total };
}
