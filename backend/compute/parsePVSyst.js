    import fs from "fs";
import pdfParse from "pdf-parse";

function toNumber(str) {
  if (!str && str !== 0) return null;
  const normalized = String(str).replace(/[^0-9.+\-]/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function extractSection(text, startAnchor, endAnchor) {
  if (!text) return "";
  const startRegex = new RegExp(startAnchor, "i");
  const endRegex = endAnchor ? new RegExp(endAnchor, "i") : null;

  const startMatch = text.match(startRegex);
  if (!startMatch) return "";
  const startIdx = startMatch.index ?? 0;

  if (!endRegex) {
    return text.slice(startIdx);
  }

  const rest = text.slice(startIdx + startMatch[0].length);
  const endMatch = rest.match(endRegex);
  if (!endMatch) return text.slice(startIdx);

  const endIdx = (endMatch.index ?? 0) + startMatch[0].length + startIdx;
  return text.slice(startIdx, endIdx);
}

function extractValue(regex, text) {
  if (!regex || !text) return null;
  const match = text.match(regex);
  if (!match) return null;
  return match[1] ?? null;
}

function extractAll(regexGlobal, text) {
  if (!regexGlobal || !text) return [];
  const out = [];
  let m;
  const re = new RegExp(regexGlobal.source, regexGlobal.flags);
  while ((m = re.exec(text)) !== null) {
    out.push(m);
  }
  return out;
}

export async function parsePVSystPDF(fileOrBuffer) {
  try {
    const buffer = Buffer.isBuffer(fileOrBuffer)
      ? fileOrBuffer
      : fs.readFileSync(fileOrBuffer);

    const { text } = await pdfParse(buffer);
    const fullText = cleanText(text);

    // Project / site name (keep simple, no strict anchor given in spec)
    const siteNameMatch =
      fullText.match(/Site\s*name\s*[:\-]\s*(.+)/i) ||
      fullText.match(/Project\s*name\s*[:\-]\s*(.+)/i) ||
      fullText.match(/Project\s*[:\-]\s*(.+)/i);
    const siteName = siteNameMatch ? siteNameMatch[1].trim() : null;

    // Geographical site section → GPS + timezone
    const geoSection = extractSection(
      fullText,
      "Geographical site",
      "System summary|PV Array Characteristics|Array losses|Results summary|Balances and main results|Loss diagram"
    );

    const gpsMatch = geoSection.match(
      /Latitude\s*:\s*([\d.\-]+).*?Longitude\s*:\s*([\d.\-]+)/i
    );
    const latitude = gpsMatch ? toNumber(gpsMatch[1]) : null;
    const longitude = gpsMatch ? toNumber(gpsMatch[2]) : null;

    const timezoneMatch = geoSection.match(/Time\s*zone\s*:?\s*([^\n]+)/i);
    const timezone = timezoneMatch ? timezoneMatch[1].trim() : null;

    // System summary section → DC/AC sizes, module/inverter counts
    const systemSection = extractSection(
      fullText,
      "System summary",
      "PV Array Characteristics|Array losses|Results summary|Balances and main results|Loss diagram"
    );

    const dcSizeKWp = toNumber(
      extractValue(/Pnom total\s+([\d.]+)\s*kWp/i, systemSection)
    );
    const acSizeKW = toNumber(
      extractValue(/Total\s+AC.*?([\d.]+)\s*kW/i, systemSection)
    );

    // PV Array characteristics → module/inverter model + counts
    const pvSection = extractSection(
      fullText,
      "PV Array Characteristics",
      "Array losses|Results summary|Balances and main results|Loss diagram"
    );

    const moduleModelRaw = extractValue(
      /Module[\s\S]*?Model\s*:\s*([A-Za-z0-9\-\/]+)/i,
      pvSection
    );
    const moduleModel = moduleModelRaw ? moduleModelRaw.trim() : null;

    const moduleCount = toNumber(
      extractValue(/Number of modules\s*:\s*(\d+)/i, pvSection)
    );

    const inverterModelRaw = extractValue(
      /Inverter[\s\S]*?Model\s*:\s*([A-Za-z0-9\-\/]+)/i,
      pvSection
    );
    const inverterModel = inverterModelRaw ? inverterModelRaw.trim() : null;

    const inverterCount = toNumber(
      extractValue(/Number of inverters\s*:\s*(\d+)/i, pvSection)
    );

    // Results summary → produced energy, specific yield, PR
    const resultsSection = extractSection(
      fullText,
      "Results summary",
      "Balances and main results|Loss diagram"
    );

    const producedEnergyMWh = toNumber(
      extractValue(/Produced Energy\s+([\d.]+)\s*MWh/i, resultsSection)
    );
    const specificYield = toNumber(
      extractValue(/Specific.*?([\d.]+)\s*kWh\/kWp/i, resultsSection)
    );
    const performanceRatio = toNumber(
      extractValue(/Performance Ratio.*?([\d.]+)\s*%/i, resultsSection)
    );

    // Report date (global)
    const reportDateRaw = extractValue(
      /Report Date.*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      fullText
    );
    const reportDate = reportDateRaw || null;

    // Balances and main results → monthly table
    const balancesSection = extractSection(
      fullText,
      "Balances and main results",
      "Loss diagram"
    );

    const monthRegex = new RegExp(
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/.source,
      "gim"
    );

    const monthlyMatches = extractAll(monthRegex, balancesSection);
    const monthly = monthlyMatches.map((m) => ({
      month: m[1],
      globHor: toNumber(m[2]),
      diffHor: toNumber(m[3]),
      tAmb: toNumber(m[4]),
      globInc: toNumber(m[5]),
      globEff: toNumber(m[6]),
      eArray: toNumber(m[7]),
      eGrid: toNumber(m[8]),
    }));

    // Loss diagram → list of label/value pairs
    const lossSection = extractSection(fullText, "Loss diagram", null);
    const lossRegex = /([A-Za-z \/\-]+)\s*:\s*([\-\+]?\d+\.\d+)\s*%/g;
    const lossMatches = extractAll(lossRegex, lossSection);
    const losses = lossMatches.map((m) => ({
      label: m[1].trim(),
      value: toNumber(m[2]),
    }));

    return {
      success: true,
      siteName,
      latitude,
      longitude,
      timezone,
      moduleModel,
      moduleCount,
      inverterModel,
      inverterCount,
      dcSizeKWp,
      acSizeKW,
      producedEnergyMWh,
      specificYield,
      performanceRatio,
      monthly,
      losses,
      reportDate,
    };
  } catch (err) {
    console.error("Error parsing PVSyst PDF:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

export default parsePVSystPDF;
