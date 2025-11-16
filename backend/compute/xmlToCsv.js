import { XMLParser } from "fast-xml-parser";

const HEADER = [
  "Start Time",
  "ManageObject",
  "Total yield(kWh)",
];

function normalizeRecord(node = {}) {
  const flat = {};
  const stack = [{ prefix: "", obj: node }];
  while (stack.length) {
    const { prefix, obj } = stack.pop();
    if (!obj || typeof obj !== "object") continue;
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        stack.push({ prefix: key, obj: v });
      } else {
        flat[key] = v;
      }
    }
  }

  const entries = Object.entries(flat).reduce((acc, [k, v]) => {
    const lk = k.toLowerCase();
    if (!acc.start && /(start[_ ]?time|timestamp)/i.test(lk)) acc.start = v;
    if (!acc.inv && /(manageobject|device|inverter)/i.test(lk)) acc.inv = v;
    if (!acc.yield && /(total[_ ]?yield(\(kwh\))?|yield|eac|energy)/i.test(lk)) acc.yield = v;
    return acc;
  }, { start: null, inv: null, yield: null });

  // Require all three fields to avoid noisy rows
  if (entries.start == null || entries.inv == null || entries.yield == null) {
    return null;
  }
  return [String(entries.start), String(entries.inv), String(entries.yield)];
}

export function xmlToCsv(buffer) {
  const text = buffer.toString("utf8");
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const xml = parser.parse(text);

  const rows = [];
  const stack = [xml];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    if (Array.isArray(node)) {
      for (const it of node) stack.push(it);
      continue;
    }

    const keys = Object.keys(node);
    if (keys.some((k) => /row|item|record/i.test(k))) {
      for (const key of keys) {
        if (/row|item|record/i.test(key)) {
          const val = node[key];
          if (Array.isArray(val)) {
            for (const rec of val) {
              const norm = normalizeRecord(rec);
              if (norm) rows.push(norm);
            }
          } else if (val && typeof val === "object") {
            const norm = normalizeRecord(val);
            if (norm) rows.push(norm);
          }
        }
      }
    } else {
      for (const v of Object.values(node)) {
        if (v && typeof v === "object") stack.push(v);
      }
    }
  }

  const lines = [HEADER.join(",")];
  for (const r of rows) {
    const escaped = r.map((c) => {
      const s = c == null ? "" : String(c);
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    });
    lines.push(escaped.join(","));
  }

  return lines.join("\n");
}

export default { xmlToCsv };
