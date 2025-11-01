// backend/compute/parsePVSyst.js
// ✅ Works on Node20 + Render + ESM
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse"); // <-- this is correct for ESM

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

function parseMonthlyTable(text) {
  const rows = {};
  for (const mon of MONTHS) {
    const re = new RegExp(
      `\\b${mon}\\b\\s+([-\\d.,]+)(?:\\s+([-\\d.,]+))?(?:\\s+([-\\d.,]+))?(?:\\s+([-\\d.,]+))?`,
      "i"
    );
    const m = text.match(re);
    if (!m) continue;
    const v = m.slice(1).map(normNum).filter(x => x !== null);
    if (v.length === 0) continue;
    rows[mon] = {
      month: mon,
      ghi: v[0] ?? null,
      gti: v[1] ?? null,
      eArray: v[2] ?? null,
      eOut: v[3] ?? v[2] ?? null,
    };
  }

  const monthly = MONTHS.map(m => rows[m]).filter(Boolean);
  if (monthly.length !== 12) {
    throw new Error("PVSyst monthly table incomplete.");
  }
  return monthly;
}

function parseLosses(text) {
  const losses = {};
  const re = /([A-Za-z][A-Za-z() \/-]+)\s*[:=]?\s*([\d.,]+)\s*%/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = m[1].trim().replace(/\s+/g, " ");
    const val = normNum(m[2]);
    if (val !== null) losses[key] = val;
  }
  return losses;
}

export async function parsePVSystPDF(buffer) {
  const { text } = await pdf(buffer);
  const clean = text.replace(/\s+/g, " ");

  const projectName = findOne(clean, /Project\s*:\s*([A-Za-z0-9\-_ .]+)/i) || "";
  const latitude = findOne(clean, /Latitude\s*:\s*([0-9.]+)/i);
  const longitude = findOne(clean, /Longitude\s*:\s*([0-9.]+)/i);

  const moduleModel = findOne(clean, /\b(JAM|LR|TSM|JKM|CS)[0-9A-Za-z\-\/]+\b/i) || "";
  const inverterModel = findOne(clean, /\b(SUN2000|SG|STP|PVS)\-[A-Za-z0-9\-]+/i) || "";

  const dcCapacity_kWp = normNum(findOne(clean, /([0-9.,]+)\s*kWp/i));
  const acCapacity_kW = normNum(findOne(clean, /([0-9.,]+)\s*kWac/i));

  const expectedProduction_MWh = normNum(findOne(clean, /([0-9.,]+)\s*MWh\/year/i));
  const performanceRatio_percent = normNum(findOne(clean, /([0-9.,]+)\s*%/i));

  const monthly = parseMonthlyTable(clean);
  const losses = parseLosses(clean);

  return {
    projectName,
    location: { latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null },
    components: { moduleModel, inverterModel },
    capacity: { dc_kWp: dcCapacity_kWp ?? null, ac_kW: acCapacity_kW ?? null },
    budget: {
      annualEnergy_MWh: expectedProduction_MWh ?? null,
      PR_percent: performanceRatio_percent ?? null,
      monthlyExpected: monthly,
      losses,
    },
  };
}
