// backend/compute/parsePVSyst.js
// PVSyst English parser — robust monthly table extraction (strict Jan..Dec)
// Node20 (ESM) compatible via CommonJS pdf-parse bridge

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

// === Helpers ===
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function normNum(s) {
  if (!s) return null;
  const t = s.replace(/\s/g, "").replace(/,/g, "");
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function findOne(text, re) {
  const m = text.match(re);
  return m ? (m[1] ?? m[0]) : null;
}

// === Monthly Table Parser (strict Jan–Dec required) ===
function parseMonthlyTable(text) {
  const rows = {};

  for (const mon of MONTHS) {
    const re = new RegExp(
      `\\b${mon}\\b\\s+([-\\d.,]+)(?:\\s+([-\\d.,]+))?(?:\\s+([-\\d.,]+))?(?:\\s+([-\\d.,]+))?(?:\\s+([-\\d.,]+))?(?:\\s+([-\\d.,]+))?`,
      "i"
    );
    const m = text.match(re);
    if (!m) continue;

    const v = m.slice(1).map(normNum).filter(x => x !== null);
    if (v.length === 0) continue;

    const ghi  = v.length >= 1 ? v[0] : null;
    const gti  = v.length >= 2 ? v[1] : null;
    let eArray = v.length >= 3 ? v[2] : null;
    let eOut   = v.length >= 4 ? v[3] : (v.length >= 3 ? v[2] : null);

    rows[mon] = { month: mon, ghi, gti, eArray, eOut };
  }

  const monthly = MONTHS.map(m => rows[m]).filter(Boolean);
  if (monthly.length !== 12) {
    const found = monthly.map(x => x.month).join(", ");
    throw new Error(`PVSyst monthly table incomplete. Found: ${found || "none"} — need full Jan..Dec.`);
  }

  return monthly;
}

// === Loss table extractor (optional) ===
function parseLosses(text) {
  const losses = {};
  const pos = text.search(/Loss(es)?|Detailed Loss(es)?/i);
  if (pos === -1) return losses;

  const window = text.slice(pos, pos + 3000);
  const re = /([A-Za-z][A-Za-z ()\/\-]+?)\s*[:=]?\s*([\d.,]+)\s*%/g;
  let m;
  while ((m = re.exec(window)) !== null) {
    const key = m[1].trim().replace(/\s+/g, " ");
    const val = normNum(m[2]);
    if (val !== null && key.length <= 40) {
      losses[key] = val;
    }
  }
  return losses;
}

// === MAIN PARSER ===
export async function parsePVSystPDF(buffer) {
  const data = await pdf(buffer);
  const text = data.text.replace(/\s+/g, " ");

  // Basic site + components
  const projectName = findOne(text, /Project\s*:\s*([A-Za-z0-9\-_ .]+)/i) || "";

  const latitude = findOne(text, /Latitude\s*:\s*([0-9.]+)\s*°?N?/i);
  const longitude = findOne(text, /Longitude\s*:\s*([0-9.]+)\s*°?E?/i);

  const moduleModel =
    findOne(text, /PV module.*?Model\s*:?\s*([A-Za-z0-9\-\/]+)/i) ||
    findOne(text, /\b(JAM|LR|TSM|JKM|CS)[0-9A-Za-z\-\/]+\b/i) || "";

  const inverterModel =
    findOne(text, /Inverter.*?Model\s*:?\s*([A-Za-z0-9\-\/]+)/i) ||
    findOne(text, /\b(SUN2000|SG|STP|PVS)\-[A-Za-z0-9\-]+\b/i) || "";

  // ✅ Capacity Option A (most accurate)
  const dcCapacity_kWp = normNum(findOne(text, /System power\s*:?\s*([0-9.,]+)\s*kWp/i));
  const acCapacity_kW  = normNum(findOne(text, /Total power\s*:?\s*([0-9.,]+)\s*kWac/i));

  // Expected annual + PR
  const expectedProduction_MWh = normNum(findOne(text, /Produced Energy\s*:?\s*([0-9.,]+)\s*MWh\/year/i));
  const performanceRatio_percent = normNum(
    findOne(text, /(Performance Ratio|Perf.? Ratio).*?([\d.,]+)\s*%/i)
  );

  // Monthly budget table
  const monthly = parseMonthlyTable(text);

  // Losses (if present)
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
      monthlyExpected: monthly,
      losses,
    },

    _debug: {
      textPreview: text.slice(0, 1200),
    },
  };
}
