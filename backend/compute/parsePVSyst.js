// backend/compute/parsePVSyst.js

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

export async function parsePVSystPDF(buffer) {
  try {
    const data = await pdf(buffer);
    const text = data.text.replace(/\s+/g, " ");

    const gpsMatch = text.match(/(-?\d{1,3}\.\d{2,})[°,]?\s*(\d{1,3}\.\d{2,})/);
    const moduleMatch = text.match(/\b(JAM|LR|TSM|JKM|CS)[0-9A-Za-z\-\/]+\b/);
    const inverterMatch = text.match(/\b(SUN2000|SG|STP|PVS)\-[A-Za-z0-9\-]+/);
    const codMatch = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);

    return {
      gps: gpsMatch ? `${gpsMatch[1]}, ${gpsMatch[2]}` : "",
      module: moduleMatch?.[0] || "",
      inverter: inverterMatch?.[0] || "",
      cod: codMatch?.[0] || "",
      rawText: text,
    };
  } catch (err) {
    console.error("❌ parsePVSystPDF error:", err);
    return {};
  }
}
