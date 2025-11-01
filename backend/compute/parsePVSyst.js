// backend/compute/parsePVSyst.js
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function normNum(s) {
  if (!s) return null;
  const v = Number(s.replace(/[, ]/g, ""));
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
      `\\b${mon}\\b\\s+([-\\d.,]+)\\s+([-\\d.,]+)?\\s+([-\\d.,]+)?\\s+([-\\d.,]+)?`,
      "i"
    );
    const m = text.match(re);
    if (!m) continue;
    const vals = m.slice(1).map(normNum);
    rows[mon] = {
      month: mon,
      ghi: vals[0] ?? null,
      gti: vals[1] ?? null,
      eArray: vals[2] ?? null,
      eOut: vals[3] ?? vals[2] ?? null,
    };
  }
  const monthly = MONTHS.map(m => rows[m]).filter(Boolean);
  if (monthly.length !== 12) {
    throw new Error(`Monthly expected energy table not complete.`);
  }
  return monthly;
}

export async function parsePVSystPDF(buffer) {
  const data = await pdf(buffer);
  const text = data.text.replace(/\s+/g, " ");

  return {
    projectName: findOne(text, /Project\s*:\s*([^\n]+)/i) || "",

    location: {
      latitude: normNum(findOne(text, /Latitude\s*:\s*([0-9.,]+)/i)),
      longitude: normNum(findOne(text, /Longitude\s*:\s*([0-9.,]+)/i)),
    },

    components: {
      moduleModel:
        findOne(text, /\b(JAM|LR|TSM|JKM|CS)[0-9A-Za-z\-\/]+\b/i) || "",
      inverterModel:
        findOne(text, /\b(SUN2000|SG|STP|PVS)-[A-Za-z0-9\-]+\b/i) || "",
    },

    capacity: {
      dc_kWp: normNum(findOne(text, /System power\s*:\s*([0-9.,]+)\s*kWp/i)),
      ac_kW: normNum(findOne(text, /Total power\s*:\s*([0-9.,]+)\s*kWac/i)),
    },

    budget: {
      annualEnergy_MWh: normNum(findOne(text, /Produced Energy\s*:\s*([0-9.,]+)\s*MWh\/year/i)),
      PR_percent: normNum(findOne(text, /(Performance Ratio).*?([0-9.,]+)\s*%/i)),
      monthlyExpected: parseMonthlyTable(text),
    },

    _debug: text.slice(0, 800),
  };
}
