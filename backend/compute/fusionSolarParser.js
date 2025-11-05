// backend/compute/fusionSolarParser.js — CSV Streaming Parser (fast baseline)
import { Readable } from "stream";
import { parse } from "csv-parse";

const trim = (s) => (typeof s === "string" ? s.trim() : s);
const toYMD = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export async function streamParseAndCompute(buffer) {
  // reject XLSX instantly
  if (buffer?.slice?.(0, 4)?.toString?.() === "PK\u0003\u0004")
    return { success: false, note: "Please export FusionSolar log as CSV, not XLSX." };

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
