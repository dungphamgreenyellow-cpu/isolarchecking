import fs from "fs";
import pdfParse from "pdf-parse";

function parseNumberFlexible(str) {
  if (!str) return null;
  const normalized = String(str)
    .replace(/[^0-9.,+-]/g, "")
    .replace(/,/g, ".");
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

export async function parsePVSystPDF(fileOrBuffer) {
  try {
    const buffer = Buffer.isBuffer(fileOrBuffer)
      ? fileOrBuffer
      : fs.readFileSync(fileOrBuffer);

    const { text } = await pdfParse(buffer);
    const fullText = cleanText(text);

    // Site name as written in the PDF title/header
    const siteNameMatch =
      fullText.match(/Site\s*name[:\s]+(.+)/i) ||
      fullText.match(/Project\s*name[:\s]+(.+)/i) ||
      fullText.match(/Project[:\s]+(.+)/i);
    const siteName = siteNameMatch ? siteNameMatch[1].trim() : null;

    const reportDateMatch =
      fullText.match(/Report Date[:\s]+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i) ||
      fullText.match(/Generated on[:\s]+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
    const reportDate = reportDateMatch ? reportDateMatch[1] : null;

    const gps = {
      lat:
        parseNumberFlexible(
          fullText.match(/Latitude[:\s]+([0-9.+-]+)/i)?.[1]
        ) ||
        parseNumberFlexible(fullText.match(/([0-9.]+)°\s*[NS]/i)?.[1]) ||
        null,
      lon:
        parseNumberFlexible(
          fullText.match(/Longitude[:\s]+([0-9.+-]+)/i)?.[1]
        ) ||
        parseNumberFlexible(fullText.match(/([0-9.]+)°\s*[EW]/i)?.[1]) ||
        null,
      alt: parseNumberFlexible(fullText.match(/Altitude[:\s]+([0-9.]+)/i)?.[1]),
      timezone:
        fullText.match(/Time\s*zone[:\s]+(UTC[+-]?\d+)/i)?.[1] ||
        fullText.match(/UTC[+-]?\d+/i)?.[0] ||
        null,
    };

    const systemInfo = {
      systemPowerDC_kWp: parseNumberFlexible(
        fullText.match(/Pnom\s*total[:\s]+([0-9.]+)\s*kWp/i)?.[1]
      ),
      systemPowerAC_kW: parseNumberFlexible(
        fullText.match(/Pnom\s*total[:\s]+([0-9.]+)\s*kWac?/i)?.[1]
      ),
      moduleCount: parseNumberFlexible(
        fullText.match(/Nb\.?\s*of\s*modules[:\s]+([0-9.]+)/i)?.[1]
      ),
      inverterCount: parseNumberFlexible(
        fullText.match(/Nb\.?\s*of\s*units[:\s]+([0-9.]+)/i)?.[1]
      ),
      dcacRatio: null,
    };
    if (systemInfo.systemPowerDC_kWp && systemInfo.systemPowerAC_kW) {
      systemInfo.dcacRatio = parseFloat(
        (systemInfo.systemPowerDC_kWp / systemInfo.systemPowerAC_kW).toFixed(3)
      );
    }

    const pvArray = {
      moduleManufacturer:
        fullText.match(/Module\s*Manufacturer[:\s]+(.+)/i)?.[1]?.trim() || null,
      moduleModel:
        fullText.match(/Module\s*Model[:\s]+(.+)/i)?.[1]?.trim() || null,
      moduleUnitWp: parseNumberFlexible(
        fullText.match(/Module\s*Unit\s*Power[:\s]+([0-9.]+)\s*Wp/i)?.[1]
      ),
      inverterManufacturer:
        fullText.match(/Inverter\s*Manufacturer[:\s]+(.+)/i)?.[1]?.trim() || null,
      inverterModel:
        fullText.match(/Inverter\s*Model[:\s]+(.+)/i)?.[1]?.trim() || null,
      inverterUnit_kW: parseNumberFlexible(
        fullText.match(/Inverter\s*Unit\s*Power[:\s]+([0-9.]+)\s*kW/i)?.[1]
      ),
    };

    const arrayLossesBlock =
      fullText.match(/Array\s*losses[\s\S]{1,400}/i)?.[0] || "";
    const arrayLosses = {
      soilingLoss_percent: parseNumberFlexible(
        arrayLossesBlock.match(/Soiling[:\s]+([0-9.]+)%/i)?.[1]
      ),
      thermalLoss_percent: parseNumberFlexible(
        arrayLossesBlock.match(/Thermal\s*loss(?:es)?[:\s]+([0-9.]+)%/i)?.[1]
      ),
      mismatch_percent: parseNumberFlexible(
        arrayLossesBlock.match(/Mismatch[:\s]+([0-9.]+)%/i)?.[1]
      ),
      lidd_percent: parseNumberFlexible(
        arrayLossesBlock.match(/LID[:\s]+([0-9.]+)%/i)?.[1]
      ),
    };

    const expected = {
      producedEnergy_MWh: parseNumberFlexible(
        fullText.match(/Produced\s*Energy[:\s]+([0-9.]+)\s*MWh/i)?.[1]
      ),
      specificProduction_kWh_kWp: parseNumberFlexible(
        fullText.match(/Specific\s*production[:\s]+([0-9.]+)\s*kWh\/kWp/i)?.[1]
      ),
      pr_percent: parseNumberFlexible(
        fullText.match(/Performance\s*Ratio[:\s]+([0-9.]+)%/i)?.[1]
      ),
    };

    const monthlyRaw =
      fullText.match(/Balances\s*and\s*Main\s*Results[\s\S]{200,5000}/i)?.[0] ||
      "";
    const lines = monthlyRaw.split("\n").map((l) => l.trim());
    let headerLine = lines.find((l) =>
      /Month/i.test(l) && /E_Grid|PR|GlobHor/i.test(l)
    );

    let monthly = [];
    if (headerLine) {
      const headers = headerLine
        .split(/\s+/)
        .map((h) => h.trim())
        .filter((h) => h.length > 0);

      const monthLines = lines.filter((l) => /^[A-Za-z]{3}\s+/i.test(l));

      for (const ml of monthLines) {
        const parts = ml.split(/\s+/);
        if (parts.length < headers.length) continue;

        const row = {};
        headers.forEach((h, idx) => {
          const value = parts[idx];
          row[h] = parseNumberFlexible(value) ?? value;
        });

        monthly.push(row);
      }
    }

    return {
      success: true,
      siteName,
      reportDate,
      gps,
      systemInfo,
      pvArray,
      expected,
      arrayLosses,
      monthly: monthly.length > 0 ? monthly : null,
    };
  } catch (err) {
    console.error("Error parsing PVSyst PDF:", err);
    return {
      success: false,
      error: err.message || "Unknown error",
    };
  }
}

export default parsePVSystPDF;
