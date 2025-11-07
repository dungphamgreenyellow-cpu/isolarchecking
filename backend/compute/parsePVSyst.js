import fs from "fs";
import pdf from "pdf-parse";

// v5.3.2 (Keyword + Vector Table Recognition)
export async function parsePVSystPDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdf(buffer);
    console.log("[parsePVSyst] First 500 chars:", data.text.slice(0, 500));

    // Merge all text into single string
    const text = (Array.isArray(data.texts)
      ? data.texts.map((p) => p.text).join(" ")
      : data.text
    )?.replace(/\s+/g, " ") || "";

    const result = {
      siteName: null,
      gps: null,
      cod: null,
      pvModule: null,
      inverter: null,
      dcCapacity: null,
      acCapacity: null,
      totalModules: null,
      totalInverters: null,
    };

    // Keyword helper
    const find = (regex) => {
      const m = text.match(regex);
      return m?.[1]?.trim() || null;
    };

    result.siteName =
      find(/Site Name[:\s]*([A-Za-z0-9\s\-_]+)/i) ||
      find(/Project[:\s]*([A-Za-z0-9\s\-_]+)/i);

    // GPS detection
    const gps =
      text.match(/Lat[:\s]*([0-9]{1,2}\.[0-9]+)/i) ||
      text.match(/([0-9]{1,2}\.[0-9]{2,})\s*[°]?[,\s;]\s*(1[0-1][0-9]\.[0-9]{2,})/i) ||
      text.match(/([0-9]{1,2}\.[0-9]{2,})[\s,]+(1[0-1][0-9]\.[0-9]{2,})/i);
    if (gps) result.gps = { latitude: gps[1], longitude: gps[2] };

    // COD / Report date
    result.cod =
      find(/Report Date[:\s]*([0-9]{2}[-\/][0-9]{2}[-\/][0-9]{4})/i) ||
      find(/Generated on[:\s]*([0-9]{2}[-\/][0-9]{2}[-\/][0-9]{4})/i) ||
      find(/Commissioning[:\s]*([0-9]{2}[-\/][0-9]{2}[-\/][0-9]{4})/i);

    // PV Module & Inverter
    result.pvModule =
      find(/PV module[:\s]*([A-Za-z0-9\-\/]+)/i) ||
      find(/Module type[:\s]*([A-Za-z0-9\-\/]+)/i) ||
      find(/Module name[:\s]*([A-Za-z0-9\-\/]+)/i);

    result.inverter =
      find(/Inverter[:\s]*([A-Za-z0-9\-\/]+)/i) ||
      find(/Inverter type[:\s]*([A-Za-z0-9\-\/]+)/i) ||
      find(/Inverter model[:\s]*([A-Za-z0-9\-\/]+)/i);

    // Capacity fields
    result.dcCapacity =
      find(/Installed DC power[:\s]*([\d,\.]+)/i) ||
      find(/Array power[:\s]*([\d,\.]+)/i) ||
      find(/PV power[:\s]*([\d,\.]+)/i);

    result.acCapacity =
      find(/AC Power[:\s]*([\d,\.]+)/i) ||
      find(/Nominal AC power[:\s]*([\d,\.]+)/i);

    result.totalModules =
      find(/Nb of modules[:\s]*([\d,]+)/i) ||
      find(/Total modules[:\s]*([\d,]+)/i);

    result.totalInverters =
      find(/Nb of inverters[:\s]*([\d,]+)/i) ||
      find(/Total inverters[:\s]*([\d,]+)/i);

    // Debug logs
    console.log("[parsePVSyst] siteName:", result.siteName);
    console.log("[parsePVSyst] GPS:", result.gps);
    console.log("[parsePVSyst] COD:", result.cod);
    console.log("[parsePVSyst] PV Module:", result.pvModule);
    console.log("[parsePVSyst] Inverter:", result.inverter);
    console.log("[parsePVSyst] DC:", result.dcCapacity, "| AC:", result.acCapacity);

    return result;
  } catch (err) {
    console.error("[parsePVSyst] Error:", err);
    return { error: err.message };
  }
}
