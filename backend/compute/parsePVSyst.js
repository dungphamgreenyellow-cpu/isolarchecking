// backend/compute/parsePVSyst.js
// PVSyst English parser — robust, strict monthly required (Jan..Dec)
// Node20 (ESM) compatible with CommonJS pdf-parse

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

// Helpers
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function normNum(s) {
  if (!s) return null;
  // Accept "1,234.56" or "1 234.56" or "1234,56" (rare)
  const t = s.replace(/\s/g, "").replace(/,/g, "");
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function findOne(text, re) {
  const m = text.match(re);
  return m ? (m[1] ?? m[0]) : null;
}

// Try many column names PVSyst may use for monthly energy (kWh)
function parseMonthlyTable(text) {
  // Strategy:
  // 1) Slice a big window around anchors like "Month" or "Monthly"
  // 2) For each month ("Jan"..."Dec"), find the row and parse numeric columns
  // 3) We try to return fields if they exist: ghi, gti, eArray, eOut
  const anchor = findOne(text, /(MONTHLY|Monthly|Month\s+)\S*/i);
  // Even if anchor not found, we still try global search by month rows
  const block = text; // PVSyst pdf-parse text often flattened; global scan works better

  const rows = {};
  for (const mon of MONTHS) {
    // A loose pattern: Month then a sequence of numbers (capture up to 8 nums)
    // e.g. "Jan  142.5  163.2  12034  11876  82.1"
    const re = new RegExp(
      `\\b${mon}\\b\\s+([-\\d.,]+)(?:\\s+([-\\d.,]+))?(?:\\s+([-\\d.,]+))?(?:\\s+([-\\d.,]+))?(?:\\s+([-\\d.,]+))?(?:\\s+([-\\d.,]+))?`,
      "i"
    );
    const m = block.match(re);
    if (!m) continue;

    // We don't know exact column order; common columns seen:
    // [GHI, GTI, EArray, EOut/E_Grid, PR, ...]
    // We'll assign heuristically:
    // - If there are 4+ values, treat values[3] as EOut (most common)
    // - If there are 3 values only, treat values[2] as EOut
    // - Also record GHI/GTI if we have 1st/2nd numbers.
    const v = m.slice(1).map(normNum).filter(x => x !== null);
    if (v.length === 0) continue;

    const ghi  = v.length >= 1 ? v[0] : null; // often global horizontal
    const gti  = v.length >= 2 ? v[1] : null; // often global in-plane
    let eArray = v.length >= 3 ? v[2] : null; // DC-side
    let eOut   = v.length >= 4 ? v[3] : (v.length >= 3 ? v[2] : null); // AC-side energy (fallback to 3rd if only 3)

    rows[mon] = {
      month: mon,
      ghi,
      gti,
      eArray,
      eOut
    };
  }

  // Must have full 12 months
  const monthly = MONTHS.map(m => rows[m]).filter(Boolean);
  if (monthly.length !== 12) {
    const found = monthly.map(x => x.month).join(", ");
    throw new Error(`PVSyst monthly table incomplete. Found months: ${found || "none"}. Need all Jan..Dec.`);
  }

  return monthly;
}

function parseLosses(text) {
  // Loose capture around “Losses”, “System losses”, “Detailed losses” blocks
  // Pattern: Name ... number %
  const losses = {};
  const lossBlockStart = text.search(/Loss(es)?|Detailed Loss(es)?/i);
  if (lossBlockStart === -1) return losses;

  const window = text.slice(lossBlockStart, lossBlockStart + 3000);
  const re = /([A-Za-z][A-Za-z ()\/\-]+?)\s*[:=]?\s*([\d.,]+)\s*%/g;
  let m;
  while ((m = re.exec(window)) !== null) {
    const key = m[1].trim()
      .replace(/\s+/g, " ")
      .replace(/ %$/, "");
    const val = normNum(m[2]);
    if (val !== null && key.length <= 40) {
      losses[key] = val;
    }
  }
  return losses;
}

export async function parsePVSystPDF(buffer) {
  const data = await pdf(buffer);
  const text = data.text.replace(/\s+/g, " ");

  // Basic fields
  const projectName = findOne(text, /Project\s*:\s*([A-Za-z0-9\-_ .]+)/i) || "";
  const latitude = findOne(text, /Latitude\s*:\s*([0-9.]+)\s*°?N?/i);
  const longitude = findOne(text, /Longitude\s*:\s*([0-9.]+)\s*°?E?/i);

  const moduleModel =
    findOne(text, /PV module.*?Model\s*:?\s*([A-Za-z0-9\-\/]+)/i) ||
    findOne(text, /\b(JAM|LR|TSM|JKM|CS)[0-9A-Za-z\-\/]+\b/i) || "";

  const inverterModel =
    findOne(text, /Inverter.*?Model\s*:?\s*([A-Za-z0-9\-\/]+)/i) ||
    findOne(text, /\b(SUN2000|SG|STP|PVS)\-[A-Za-z0-9\-]+\b/i) || "";

  const dcCapacity_kWp = normNum(findOne(text, /System power\s*:?\s*([0-9.,]+)\s*kWp/i));
  const acCapacity_kW  = normNum(findOne(text, /Total power\s*:?\s*([0-9.,]+)\s*kWac/i));

  const expectedProduction_MWh = normNum(findOne(text, /Produced Energy\s*:?\s*([0-9.,]+)\s*MWh\/year/i));
  const performanceRatio_percent = normNum(
    findOne(text, /(Performance Ratio|Perf.? Ratio).*?([\d.,]+)\s*%/i)
  );

  // Monthly table (strict)
  const monthly = parseMonthlyTable(text);

  // Loss breakdown (optional)
  const losses = parseLosses(text);

  return {
    projectName,

    location: {
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
    },

    components: {
      moduleModel,
      inverterModel,
    },

    capacity: {
      dc_kWp: dcCapacity_kWp ?? null,
      ac_kW: acCapacity_kW ?? null,
    },

    budget: {
      annualEnergy_MWh: expectedProduction_MWh ?? null,
      PR_percent: performanceRatio_percent ?? null,
      monthlyExpected: monthly, // [{month, ghi, gti, eArray, eOut}]
      losses,                   // { "Soiling": 3.2, "Clipping": 0.8, ... }
    },

    // keep for debug
    _debug: {
      textPreview: text.slice(0, 1200)
    }
  };
}
