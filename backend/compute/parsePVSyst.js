import fs from "fs";
import pdfParse from "pdf-parse";

export async function parsePVSystPDF(fileOrBuffer) {
  try {
    const buffer = Buffer.isBuffer(fileOrBuffer)
      ? fileOrBuffer
      : fs.readFileSync(fileOrBuffer);

    const { text } = await pdfParse(buffer);

    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const fullText = lines.join("\n");

    const parseNumberFlexible = (str) => {
      if (!str) return null;
      const normalized = str.replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
      const num = parseFloat(normalized);
      return isNaN(num) ? null : num;
    };

    const reportDate = fullText.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i)?.[1] || null;

    const gps = {
      lat: parseNumberFlexible(fullText.match(/Latitude[:\s]+([0-9.]+)/i)?.[1]),
      lon: parseNumberFlexible(fullText.match(/Longitude[:\s]+([0-9.]+)/i)?.[1]),
      alt: parseNumberFlexible(fullText.match(/Altitude[:\s]+([0-9.]+)/i)?.[1]),
      timezone: fullText.match(/Time zone[:\s]+(UTC[+-]?\d+)/i)?.[1] || null,
    };

    const systemInfo = {
      moduleCount: parseNumberFlexible(fullText.match(/Nb\. of modules[:\s]+([0-9.]+)/i)?.[1]),
      inverterCount: parseNumberFlexible(fullText.match(/Nb\. of units[:\s]+([0-9.]+)/i)?.[1]),
      systemPowerDC_kWp: parseNumberFlexible(fullText.match(/Pnom total[:\s]+([0-9.]+)\s*kWp/i)?.[1]),
      systemPowerAC_kW: parseNumberFlexible(fullText.match(/Pnom total[:\s]+([0-9.]+)\s*kWac?/i)?.[1]),
      dcacRatio: null,
    };
    if (systemInfo.systemPowerDC_kWp && systemInfo.systemPowerAC_kW) {
      systemInfo.dcacRatio = parseFloat(
        (systemInfo.systemPowerDC_kWp / systemInfo.systemPowerAC_kW).toFixed(3)
      );
    }

    const expected = {
      producedEnergy_MWh: parseNumberFlexible(fullText.match(/Produced Energy[:\s]+([0-9.]+)\s*MWh/i)?.[1]),
      specificProduction_kWh_kWp: parseNumberFlexible(fullText.match(/Specific production[:\s]+([0-9.]+)\s*kWh\/kWp/i)?.[1]),
      pr_percent: parseNumberFlexible(fullText.match(/Performance Ratio[:\s]+([0-9.]+)%/i)?.[1]),
    };

    const pvArray = {
      moduleManufacturer: fullText.match(/Module Manufacturer[:\s]+([\w\s]+)/i)?.[1]?.trim() || null,
      moduleModel: fullText.match(/Module Model[:\s]+([\w\s]+)/i)?.[1]?.trim() || null,
      moduleUnitWp: parseNumberFlexible(fullText.match(/Module Unit Power[:\s]+([0-9.]+)\s*Wp/i)?.[1]),
      inverterManufacturer: fullText.match(/Inverter Manufacturer[:\s]+([\w\s]+)/i)?.[1]?.trim() || null,
      inverterModel: fullText.match(/Inverter Model[:\s]+([\w\s]+)/i)?.[1]?.trim() || null,
      inverterUnit_kW: parseNumberFlexible(fullText.match(/Inverter Unit Power[:\s]+([0-9.]+)\s*kW/i)?.[1]),
    };

    const soilingLoss_percent = parseNumberFlexible(
      fullText.match(/Soiling Loss[:\s]+([0-9.]+)%/i)?.[1]
    );

    const monthly = null;
    const yearSummary = null;

    return {
      success: true,
      reportDate,
      gps,
      systemInfo,
      expected,
      pvArray,
      soilingLoss_percent,
      monthly,
      yearSummary,
    };
  } catch (err) {
    console.error("Error parsing PVSyst PDF:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

export default parsePVSystPDF;
