/* eslint-disable */
import * as XLSX from "xlsx";

/**
 * Expect: ArrayBuffer of an XLSX file (single sheet), header at Excel row 4 (index 3).
 * Output: { records: Array<Object>, columns: string[], rows: number }
 * Notes: Keep ALL columns (no drop). Add normalized helpers: timestamp, inverter, total_yield_kwh (if present).
 */
self.onmessage = async (e) => {
  try {
    const buf = e.data;
    const wb = XLSX.read(buf, { type: "array" });
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];

    // Read all rows as arrays, then use row 4 (index 3) as header:
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    if (!rows || rows.length < 4) {
      postMessage({ error: "XLSX has fewer than 4 rows; cannot find header at row 4." });
      return;
    }

    const header = rows[3].map(h => (typeof h === "string" ? h.trim() : h)); // Excel row 4
    const dataRows = rows.slice(4); // from row 5 downward (0-based)
    const records = [];
    const colCount = header.length;

    // Build objects with original columns intact
    for (const r of dataRows) {
      if (!r || r.length === 0) continue;
      const obj = {};
      for (let i = 0; i < colCount; i++) {
        const key = header[i] ?? `__col_${i}`;
        obj[key] = (r[i] === undefined) ? null : r[i];
      }

      // Normalization helpers (non-destructive)
      const tKeys = ["Start Time", "StartTime", "Time", "Timestamp"];
      const invKeys = ["ManageObject", "Device name", "Inverter", "Inverter Name"];
      const eacKeys = ["Total yield(kWh)", "Total Yield(kWh)", "Total Yield (kWh)"];

      const rawT = tKeys.map(k => obj[k]).find(v => v != null && v !== "");
      const rawInv = invKeys.map(k => obj[k]).find(v => v != null && v !== "");
      const rawEac = eacKeys.map(k => obj[k]).find(v => v != null && v !== "" && Number.isFinite(Number(v)));

      // timestamp (as-is string), inverter normalized, eac numeric
      obj.timestamp = (typeof rawT === "number") ? XLSX.SSF.format("yyyy-mm-dd HH:MM:ss", rawT) : (rawT ?? null);
      let inv = rawInv ? String(rawInv).split("/")[0].trim().replace(/\s+/g, "") : null;
      if (inv) inv = inv.startsWith("INV-") ? inv : `INV-${inv}`;
      obj.inverter = inv ?? null;
      obj.total_yield_kwh = (rawEac != null && rawEac !== "" && isFinite(Number(rawEac))) ? Number(rawEac) : null;

      records.push(obj);
    }

    postMessage({ records, columns: header, rows: records.length });
  } catch (err) {
    postMessage({ error: String(err?.message || err) });
  }
};
