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
  const blob = textLines.join("\n");

  // 2) PROJECT SUMMARY: latitude/longitude
  let latitude = null, longitude = null;
  try {
    const latMatch = findByRegex(textLines, /latitude\s+([+-]?\d+(?:[\.,]\d+)?)/i);
    if (latMatch.match) latitude = normalizeNum(latMatch.match[1]);
    const lonMatch = findByRegex(textLines, /longitude\s+([+-]?\d+(?:[\.,]\d+)?)/i);
    if (lonMatch.match) longitude = normalizeNum(lonMatch.match[1]);
  } catch { /* noop */ }

  // 3) SYSTEM SUMMARY — tailored to PVsyst layout observed in sample
  // Prefer exact regex matches observed in sample before falling back
  const reModules1 = /Nb\.?\s*of\s*modules\s*([0-9][0-9.,]*)\s*units?/i;
  const reModules2 = /Number\s+of\s+PV\s+modules\s*([0-9][0-9.,]*)\s*units?/i;
  const rePnomTotalDC = /Pnom\s+total\s*([0-9][0-9.,]*)\s*kWp/i;
  const rePnomTotalAC = /Pnom\s+total\s*([0-9][0-9.,]*)\s*kWac\b/i;
  const reUnits = /Nb\.?\s*of\s*units\s*([0-9][0-9.,]*)\s*units?/i;
  const reNumInverters = /Number\s+of\s+inverters\s*([0-9][0-9.,]*)\s*units?/i;
  const rePnomRatio = /Pnom\s+ratio\s*([0-9]+(?:[.,]\d+)?)/i;

  let modules_total = null;
  let capacity_dc_kwp = null;
  let inverter_count = null;
  let capacity_ac_kw = null;
  let dc_ac_ratio = null;

  // Prefer scanning near "System summary" anchor to avoid picking unrelated blocks
  const sysIdx = textLines.findIndex(L => /\bSystem\s+summary\b/i.test(L));
  const scanRanges = [];
  if (sysIdx >= 0) scanRanges.push([Math.max(0, sysIdx - 50), Math.min(textLines.length - 1, sysIdx + 80)]);
  // also scan window around explicit PV Array / Inverters anchor if present
  const pvIdx = textLines.findIndex(L => /\bPV\s*Array\b/i.test(L));
  const invIdx = textLines.findIndex(L => /\bInverters?\b/i.test(L));
  if (pvIdx >= 0) scanRanges.push([Math.max(0, pvIdx - 30), Math.min(textLines.length - 1, pvIdx + 60)]);
  if (invIdx >= 0) scanRanges.push([Math.max(0, invIdx - 30), Math.min(textLines.length - 1, invIdx + 60)]);

  const seen = new Set();
  for (const [a,b] of scanRanges) {
    const key = `${a}:${b}`; if (seen.has(key)) continue; seen.add(key);
    for (let i=a;i<=b;i++) {
      const L = textLines[i];
      if (modules_total == null) {
        let m = L.match(reModules1) || L.match(reModules2);
        if (m) modules_total = normalizeNum(m[1]);
      }
      if (capacity_dc_kwp == null) {
        const m = L.match(rePnomTotalDC);
        if (m) capacity_dc_kwp = normalizeNum(m[1]);
      }
      if (inverter_count == null) {
        let m = L.match(reUnits) || L.match(reNumInverters);
        if (m) inverter_count = normalizeNum(m[1]);
      }
      if (capacity_ac_kw == null) {
        const m = L.match(rePnomTotalAC);
        if (m) capacity_ac_kw = normalizeNum(m[1]);
      }
      if (dc_ac_ratio == null) {
        const m = L.match(rePnomRatio);
        if (m) dc_ac_ratio = normalizeNum(m[1]);
      }
    }
  }
  // Fallbacks within blob
  if (capacity_dc_kwp == null) {
    const reDCg = new RegExp(rePnomTotalDC.source, 'gi');
    const all = [...blob.matchAll(reDCg)].map(m => normalizeNum(m[1])).filter(v => v != null);
    if (all.length) capacity_dc_kwp = Math.max(...all);
  }
  if (capacity_ac_kw == null) {
    const reACg = new RegExp(rePnomTotalAC.source, 'gi');
    const all = [...blob.matchAll(reACg)].map(m => normalizeNum(m[1])).filter(v => v != null);
    if (all.length) capacity_ac_kw = Math.max(...all);
  }
  const reM1g = new RegExp(reModules1.source, 'gi');
  const reM2g = new RegExp(reModules2.source, 'gi');
  if (modules_total == null) {
    const allA = [...blob.matchAll(reM1g)].map(m => normalizeNum(m[1]));
    const allB = [...blob.matchAll(reM2g)].map(m => normalizeNum(m[1]));
    const all = [...allA, ...allB].filter(v => v != null);
    if (all.length) modules_total = Math.max(...all);
  }
  else {
    // prefer the maximum across the whole document
    const allA = [...blob.matchAll(reM1g)].map(m => normalizeNum(m[1]));
    const allB = [...blob.matchAll(reM2g)].map(m => normalizeNum(m[1]));
    const all = [...allA, ...allB].filter(v => v != null);
    if (all.length) {
      const maxV = Math.max(...all);
      if (maxV > modules_total) modules_total = maxV;
    }
  }
  if (inverter_count == null) {
    const m = blob.match(reUnits) || blob.match(reNumInverters);
    if (m) inverter_count = normalizeNum(m[1]);
  }
  // Choose most precise and plausible (<=5) Pnom ratio in entire blob, override if present
  {
    const rePRg = new RegExp(rePnomRatio.source, 'gi');
    const allRatios = [...blob.matchAll(rePRg)].map(m => m[1]).filter(x => normalizeNum(x) != null && normalizeNum(x) <= 5);
    if (allRatios.length) {
      allRatios.sort((a,b)=>{
        const fa = (String(a).split(/[.,]/)[1]||'').length;
        const fb = (String(b).split(/[.,]/)[1]||'').length;
        return fb - fa; // more decimals first
      });
      const precise = normalizeNum(allRatios[0]);
      if (precise != null) dc_ac_ratio = precise;
    }
  }
  if ((dc_ac_ratio == null || !Number.isFinite(dc_ac_ratio)) && capacity_dc_kwp != null && capacity_ac_kw != null && capacity_ac_kw !== 0) {
    dc_ac_ratio = Number((capacity_dc_kwp / capacity_ac_kw).toFixed(3));
  }

  // 4) PV ARRAY CHARACTERISTICS — models
  // Directly extract both Model codes if they appear on the same line
  let module_model = null;
  let inverter_model = null;
  try {
    // Prefer blob-wide extraction to avoid line segmentation issues
  const models = [...blob.matchAll(/Model\s*([A-Za-z0-9][A-Za-z0-9\-\/\.]{4,}?)(?=Model|\s|$)/ig)].map(m => m[1]);
    if (models.length) {
      module_model = models.find(s => !/SUN|KTL|INV|HUAWEI/i.test(s)) || null;
      inverter_model = models.find(s => /SUN|KTL|INV|HUAWEI/i.test(s)) || null;
    }
    if (!(module_model && inverter_model)) {
      for (const L of textLines) {
        if (!/\bModel\b/i.test(L)) continue;
  const all = [...L.matchAll(/Model\s*([A-Za-z0-9][A-Za-z0-9\-\/\.]{4,}?)(?=Model|\s|$)/ig)].map(m => m[1]);
        if (!module_model && all.length) {
          const pick = all.find(s => !/SUN|KTL|INV|HUAWEI/i.test(s)) || all[0];
          if (pick) module_model = pick;
        }
        if (!inverter_model && all.length) {
          const pickInv = all.find(s => /SUN|KTL|INV|HUAWEI/i.test(s));
          if (pickInv) inverter_model = pickInv;
        }
        if (module_model && inverter_model) break;
      }
    }
    // If still missing, search near PV module / Inverter anchors within ±20 lines
    if (!module_model) {
      const pvIdx = textLines.findIndex(L => /\bPV\s*module\b/i.test(L));
      if (pvIdx >= 0) {
        for (let i = Math.max(0, pvIdx - 20); i <= Math.min(textLines.length - 1, pvIdx + 20); i++) {
          const m = textLines[i].match(/Model\s+([A-Za-z0-9][A-Za-z0-9\-\/\.]{4,})/i);
          if (m && !/SUN|KTL|INV|HUAWEI/i.test(m[1])) { module_model = m[1]; break; }
        }
      }
    }
    if (!inverter_model) {
      const invIdx = textLines.findIndex(L => /\bInverter\b/i.test(L));
      if (invIdx >= 0) {
        for (let i = Math.max(0, invIdx - 20); i <= Math.min(textLines.length - 1, invIdx + 20); i++) {
          const m = textLines[i].match(/Model\s+([A-Za-z0-9][A-Za-z0-9\-\/\.]{4,})/i);
          if (m && /SUN|KTL|INV|HUAWEI/i.test(m[1])) { inverter_model = m[1]; break; }
        }
      }
    }
  } catch { /* noop */ }

  // 5) ARRAY LOSSES → soiling
  let soiling_loss_percent = null;
  try {
    // Prefer explicit 'Soiling loss' line; fall back to any 'Soiling' with % following or preceding
    const soilingCand = textLines.find((L) => /Soiling/i.test(L) && /%/.test(L)) ||
                        textLines.find((L) => /%/.test(L) && /Soiling/i.test(L));
    if (soilingCand) {
      const m = soilingCand.match(/([0-9]+(?:[\.,]\d+)?)\s*%/);
      if (m) soiling_loss_percent = normalizeNum(m[1]);
    }
    if (soiling_loss_percent == null) {
      const m = blob.match(/Soiling[^%]*?([0-9]+(?:[\.,]\d+)?)\s*%/i) || blob.match(/([0-9]+(?:[\.,]\d+)?)\s*%[^\n]*Soiling/i);
      if (m) soiling_loss_percent = normalizeNum(m[1]);
    }
  } catch { /* noop */ }

  // 6) BALANCES & MAIN RESULTS — monthly table (12 rows)
  let monthly = [];
  try {
    // Build a map month->line (first occurrence)
    const monthLabels = [
      "January","February","March","April","May","June","July","August","September","October","November","December"
    ];
    const monthMap = new Map();
    for (const L of textLines) {
      for (const m of monthLabels) {
        const re = new RegExp(`(^|\\s)${m}`, 'i');
        if (re.test(L) && !monthMap.has(m)) {
          monthMap.set(m, L);
        }
      }
    }
    if (monthMap.size >= 12) {
      const keys = ["GlobHor","DiffHor","T_Amb","GlobInc","GlobEff","EArray","E_Grid","PR"];
      for (const m of monthLabels) {
        const row = monthMap.get(m);
        const nums = (row.match(/[+-]?\d+(?:[.,]\d+)?/g) || []).map(x => x.replace(',', '.'));
        // first token(s) may include year/time; keep the last 8 numbers in the row to align with columns
        const take = nums.slice(-8);
        const entry = { month: m };
        for (let i = 0; i < take.length && i < keys.length; i++) entry[keys[i]] = take[i];
        monthly.push(entry);
      }
    } else {
      monthly = [];
    }
  } catch (e) {
    console.debug("[PVSyst] monthly parse warn:", e?.message);
    monthly = [];
  }

  // Latitude/Longitude enhancements: detect with cardinal signs as fallback
  try {
    if (latitude == null) {
      const m = blob.match(/Latitude[^0-9]*([0-9]+(?:[.,]\d+)?)°\s*([NS])/i) || blob.match(/([0-9]+(?:[.,]\d+)?)°\s*([NS])/i);
      if (m) {
        const val = normalizeNum(m[1]);
        latitude = (m[2].toUpperCase() === 'S') ? (val != null ? -val : null) : val;
      }
    }
    if (longitude == null) {
      const m = blob.match(/Longitude[^0-9]*([0-9]+(?:[.,]\d+)?)°\s*([EW])/i) || blob.match(/([0-9]+(?:[.,]\d+)?)°\s*([EW])/i);
      if (m) {
        const val = normalizeNum(m[1]);
        longitude = (m[2].toUpperCase() === 'W') ? (val != null ? -val : null) : val;
      }
    }
  } catch { /* noop */ }

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
