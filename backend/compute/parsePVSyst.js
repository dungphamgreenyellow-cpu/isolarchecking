// backend/compute/parsePVSyst.js — tolerant parser (B) using pdfjs-dist token XY → lines
import pdfjs from "pdfjs-dist/legacy/build/pdf.js";

// Month aliases
const MONTH_FULL = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december"
];
const MONTH_ABBR = [
  "jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"
];
const MONTH_NUM = [
  "01","02","03","04","05","06","07","08","09","10","11","12"
];

// ============ Utilities ============
function normalizeNum(s) {
  try {
    if (s == null) return null;
    let t = String(s).trim().toLowerCase();
    // keep only first numeric with optional decimal , or .
    const m = t.match(/[+-]?\d+(?:[.,]\d+)?/);
    if (!m) return null;
    let n = m[0];
    if (n.includes(',') && !n.includes('.')) {
      // treat comma as decimal separator
      n = n.replace(',', '.');
    } else if (n.includes(',') && n.includes('.')) {
      // ambiguous; prefer last separator as decimal; remove others
      const lastDot = n.lastIndexOf('.');
      const lastComma = n.lastIndexOf(',');
      if (lastComma > lastDot) {
        n = n.replace(/\./g, '').replace(',', '.');
      } else {
        n = n.replace(/,/g, '');
      }
    }
    const v = parseFloat(n);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function includesSoft(line, keywords) {
  if (!line) return false;
  const L = line.toLowerCase();
  return keywords.some((kw) => L.includes(String(kw).toLowerCase()));
}

function sectionBetween(lines, startKw = [], endKw = []) {
  try {
    const N = lines.length;
    let si = -1;
    for (let i = 0; i < N; i++) {
      if (includesSoft(lines[i], startKw)) { si = i; break; }
    }
    if (si < 0) return [];
    let ei = N;
    for (let j = si + 1; j < N; j++) {
      if (includesSoft(lines[j], endKw)) { ei = j; break; }
    }
    return lines.slice(si, ei);
  } catch {
    return [];
  }
}

function findFirst(lines, keywords) {
  for (let i = 0; i < lines.length; i++) {
    if (includesSoft(lines[i], keywords)) return { idx: i, text: lines[i] };
  }
  return { idx: -1, text: null };
}

function findByRegex(lines, re) {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]?.match(re);
    if (m) return { idx: i, text: lines[i], match: m };
  }
  return { idx: -1, text: null, match: null };
}

function monthSignatureScore(blockLines) {
  const blob = (blockLines || []).join('\n').toLowerCase();
  let score = 0;
  for (let i = 0; i < 12; i++) {
    const f = MONTH_FULL[i];
    const a = MONTH_ABBR[i];
    const n = MONTH_NUM[i];
    if (blob.includes(f)) score++;
    if (blob.match(new RegExp(`\\b${a}\\b`))) score++;
    if (blob.match(new RegExp(`\\b${n}\\b`))) score++;
  }
  return score;
}

function groupByY(tokens, tol = 1.5) {
  const lines = [];
  const sorted = tokens.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  for (const t of sorted) {
    let line = lines.find((ln) => Math.abs(ln.y - t.y) <= tol);
    if (!line) {
      line = { y: t.y, tokens: [] };
      lines.push(line);
    }
    line.tokens.push(t);
  }
  lines.forEach((ln) => ln.tokens.sort((a, b) => a.x - b.x));
  return lines;
}

function tokensToTextLine(line) {
  return line.tokens.map((t) => t.str).join("").replace(/\s+/g, " ").trim();
}

// split with X gaps to approximate columns when needed
function splitColumnsByX(line, gap = 8) {
  const cols = [];
  let cur = [];
  let prevX = null;
  for (const t of line.tokens) {
    if (prevX != null && Math.abs(t.x - prevX) > gap) {
      if (cur.length) cols.push(cur), cur = [];
    }
    cur.push(t);
    prevX = t.x;
  }
  if (cur.length) cols.push(cur);
  return cols.map((g) => g.map((x) => x.str).join("").trim());
}

function extractFirstNumber(line) {
  const m = line ? line.match(/[+-]?\d+(?:[.,]\d+)?/) : null;
  return m ? normalizeNum(m[0]) : null;
}

function pickModelFromBlock(blockLines) {
  // Prefer explicit "model XYZ" form
  for (const L of blockLines) {
    const m = L.match(/model\s+([A-Za-z0-9][A-Za-z0-9\-\/\.]{4,})/i);
    if (m) return m[1];
  }
  // Fallback: scan tokens that look like part numbers (>=8 chars, alnum, contains a letter)
  for (const L of blockLines) {
    const parts = (L || "").split(/[^A-Za-z0-9\-\/\.]+/).filter(Boolean);
    for (const p of parts) {
      if (p.length >= 8 && /[A-Za-z]/.test(p) && /[A-Za-z0-9]/.test(p)) return p;
    }
  }
  return null;
}

export async function parsePVSyst(buffer) {
  // 1) Read PDF → tokens {str,x,y} → lines
  let data;
  try {
    if (Buffer.isBuffer && Buffer.isBuffer(buffer)) {
      data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else if (buffer instanceof Uint8Array) {
      data = buffer;
    } else {
      data = new Uint8Array(buffer);
    }
  } catch (e) {
    console.debug("[PVSyst] buffer normalize failed:", e?.message);
    return null;
  }

  let pdf;
  try {
    const loadingTask = pdfjs.getDocument({ data });
    pdf = await loadingTask.promise;
  } catch (e) {
    console.debug("[PVSyst] pdf load failed:", e?.message);
    return {
      latitude: null,
      longitude: null,
      modules_total: null,
      capacity_dc_kwp: null,
      inverter_count: null,
      capacity_ac_kw: null,
      dc_ac_ratio: null,
      module_model: null,
      inverter_model: null,
      soiling_loss_percent: null,
      monthly: []
    };
  }

  const allTokens = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const tokens = content.items.map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
      allTokens.push(...tokens);
    }
  } catch (e) {
    console.debug("[PVSyst] text extract failed:", e?.message);
  }

  const lines = groupByY(allTokens);
  const textLines = lines.map(tokensToTextLine);

  // 2) PROJECT SUMMARY: latitude/longitude
  let latitude = null, longitude = null;
  try {
    const latMatch = findByRegex(textLines, /latitude\s+([+-]?\d+(?:[\.,]\d+)?)/i);
    if (latMatch.match) latitude = normalizeNum(latMatch.match[1]);
    const lonMatch = findByRegex(textLines, /longitude\s+([+-]?\d+(?:[\.,]\d+)?)/i);
    if (lonMatch.match) longitude = normalizeNum(lonMatch.match[1]);
  } catch { /* noop */ }

  // 3) SYSTEM SUMMARY
  const pvArrayBlock = sectionBetween(
    textLines,
    ["pv array","system information"],
    ["inverters","tables on a building","array characteristics","array losses"]
  );
  const inverterBlock = sectionBetween(
    textLines,
    ["inverters"],
    ["array losses","pv array characteristics","pv module","legends"]
  );

  // modules_total
  let modules_total = null;
  try {
    const target = pvArrayBlock.find((L) => includesSoft(L, [
      "nb. of modules","modules number","number of modules","nb. of pv modules","modules"
    ]));
    if (target) modules_total = extractFirstNumber(target);
  } catch { /* noop */ }
  if (modules_total == null) {
    // fallback: scan whole doc for modules count lines
    const any = textLines.find((L) => includesSoft(L, [
      "nb. of modules","modules number","number of modules","nb. of pv modules","modules"
    ]));
    if (any) modules_total = extractFirstNumber(any);
  }

  // capacity_dc_kwp
  let capacity_dc_kwp = null;
  try {
    const target = pvArrayBlock.find((L) => includesSoft(L, [
      "pnom total","dc power","array power","nominal","stc"
    ]) && /kwp/i.test(L));
    if (target) capacity_dc_kwp = normalizeNum(target);
  } catch { /* noop */ }
  if (capacity_dc_kwp == null) {
    // fallback: prefer lines with kWp and context words
    let cand = textLines.find((L) => /kwp\b/i.test(L) && includesSoft(L, ["pnom total","total power","nominal","stc","dc"]));
    if (!cand) cand = textLines.find((L) => /kwp\b/i.test(L));
    if (cand) capacity_dc_kwp = normalizeNum(cand);
  }

  // inverter_count
  let inverter_count = null;
  try {
    const tgt = inverterBlock.find((L) => includesSoft(L, [
      "nb. of units","number of inverters","inverters"
    ]) && includesSoft(L, ["inverter","inverters","inv."]));
    if (tgt) inverter_count = extractFirstNumber(tgt);
  } catch { /* noop */ }
  if (inverter_count == null) {
    const any = textLines.find((L) => includesSoft(L, [
      "nb. of units","number of inverters","inverters"
    ]) && includesSoft(L, ["inverter","inverters","inv."]));
    if (any) inverter_count = extractFirstNumber(any);
  }

  // capacity_ac_kw
  let capacity_ac_kw = null;
  try {
    const tgt = inverterBlock.find((L) => includesSoft(L, [
      "pnom total","ac power","ac output","total power","kwac","kva","ac rating"
    ]) && (/(kw\s*ac|kwac|kva|\bak\b)/i.test(L) || includesSoft(L, ["ac"])));
    if (tgt) capacity_ac_kw = normalizeNum(tgt);
  } catch { /* noop */ }
  if (capacity_ac_kw == null) {
    // fallback: prefer kWac, else kW with AC context
    let cand = textLines.find((L) => /(kw\s*ac|kwac)/i.test(L));
    if (!cand) cand = textLines.find((L) => /\bkw\b/i.test(L) && includesSoft(L, ["ac","ac power","ac output","pnom total","total power","inverter"]));
    if (!cand) cand = textLines.find((L) => /\bkva\b/i.test(L));
    if (cand) capacity_ac_kw = normalizeNum(cand);
  }

  // dc_ac_ratio
  let dc_ac_ratio = null;
  try {
    const r = inverterBlock.find((L) => includesSoft(L, ["pnom ratio","dc/ac","dc-ac ratio"]));
    if (r) dc_ac_ratio = extractFirstNumber(r);
    if (dc_ac_ratio == null && capacity_dc_kwp != null && capacity_ac_kw != null && capacity_ac_kw !== 0) {
      dc_ac_ratio = Number((capacity_dc_kwp / capacity_ac_kw).toFixed(3));
    }
  } catch { /* noop */ }

  // 4) PV ARRAY CHARACTERISTICS
  const pvModuleBlock = sectionBetween(textLines, ["pv module"], ["inverter","array losses","legends"]);
  const inverterCharBlock = sectionBetween(textLines, ["inverter"], ["array losses","legends"]);

  let module_model = null;
  let inverter_model = null;
  try { module_model = pickModelFromBlock(pvModuleBlock) || null; } catch { /* noop */ }
  try { inverter_model = pickModelFromBlock(inverterCharBlock) || null; } catch { /* noop */ }

  // 5) ARRAY LOSSES → soiling
  const arrayLossBlock = sectionBetween(textLines, ["array losses"], ["legends","balances and main results","normalized productions","performance ratio"]);
  let soiling_loss_percent = null;
  try {
    const soilingLine = arrayLossBlock.find((L) => includesSoft(L, ["soiling"]));
    if (soilingLine) {
      const m = soilingLine.match(/([\d]+(?:[\.,]\d+)?)\s*%/);
      if (m) soiling_loss_percent = normalizeNum(m[1]);
    }
  } catch { /* noop */ }

  // 6) BALANCES & MAIN RESULTS — monthly table (12 rows)
  // split textLines into blocks by empty line
  const blocks = [];
  let cur = [];
  for (const L of textLines) {
    if (!L || !L.trim()) {
      if (cur.length) { blocks.push(cur); cur = []; }
    } else {
      cur.push(L);
    }
  }
  if (cur.length) blocks.push(cur);

  let bestBlock = null, bestScore = -1, bestIdx = -1;
  for (let i = 0; i < blocks.length; i++) {
    const score = monthSignatureScore(blocks[i]);
    if (score > bestScore) { bestScore = score; bestBlock = blocks[i]; bestIdx = i; }
  }

  let monthly = [];
  try {
    if (bestBlock && bestScore >= 8) {
      // detect header line (assume first non-empty before first month row)
      let firstMonthRow = -1;
      for (let i = 0; i < bestBlock.length; i++) {
        const L = bestBlock[i].toLowerCase();
        const hasMonth = MONTH_FULL.some((m) => L.includes(m)) || MONTH_ABBR.some((a) => L.match(new RegExp(`\\b${a}\\b`))) || MONTH_NUM.some((n) => L.match(new RegExp(`\\b${n}\\b`)));
        if (hasMonth) { firstMonthRow = i; break; }
      }
      // header is line just before the first month row, if any
      let headerCols = null;
      if (firstMonthRow > 0) {
        const header = bestBlock[firstMonthRow - 1];
        const split = header.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
        if (split.length >= 2) headerCols = split;
      }

      // map bestBlock rows back into original token lines region (approximate by searching textLines indices)
      const startGlobal = textLines.indexOf(bestBlock[firstMonthRow]);
      if (firstMonthRow >= 0 && startGlobal >= 0) {
        const rows = [];
        for (let r = 0; r < 12; r++) {
          const lineIdx = startGlobal + r;
          if (lineIdx >= 0 && lineIdx < lines.length) rows.push(lines[lineIdx]);
        }
        if (rows.length === 12) {
          for (let r = 0; r < 12; r++) {
            const cols = splitColumnsByX(rows[r], 8);
            if (!cols.length) { monthly = []; break; }
            // first col is month label
            const monthCell = cols[0] || '';
            const entry = { month: monthCell };
            const dataCols = cols.slice(1);
            if (headerCols && headerCols.length >= dataCols.length) {
              for (let c = 0; c < dataCols.length; c++) {
                const key = headerCols[c] || `c${c+1}`;
                entry[key] = dataCols[c];
              }
            } else {
              for (let c = 0; c < dataCols.length; c++) entry[`c${c+1}`] = dataCols[c];
            }
            monthly.push(entry);
          }
        } else {
          monthly = [];
        }
      }
    }
  } catch (e) {
    console.debug("[PVSyst] monthly parse warn:", e?.message);
    monthly = [];
  }

  // 7) Return tolerant JSON (never throw)
  return {
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    modules_total: modules_total ?? null,
    capacity_dc_kwp: capacity_dc_kwp ?? null,
    inverter_count: inverter_count ?? null,
    capacity_ac_kw: capacity_ac_kw ?? null,
    dc_ac_ratio: dc_ac_ratio ?? null,
    module_model: module_model ?? null,
    inverter_model: inverter_model ?? null,
    soiling_loss_percent: soiling_loss_percent ?? null,
    monthly: Array.isArray(monthly) && (monthly.length === 12 || monthly.length === 0) ? monthly : []
  };
}
