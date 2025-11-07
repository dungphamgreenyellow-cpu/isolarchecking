import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

let pdf;
try {
  const mod = await import("pdf-parse");  // ✅ Dynamic import hỗ trợ CJS
  pdf = mod.default || mod;
} catch (err) {
  console.error("[parsePVSyst] Failed to load pdf-parse:", err);
}

// v5.3.2 with pdfjs-dist fallback (FujiSeal confirmed)
export async function parsePVSystPDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);

    // --- Step 1: Try standard pdf-parse ---
    let data = await pdf(buffer);
    let text = (data?.text || "").replace(/\s+/g, " ").trim();

    // --- Step 2: pdfjs-dist fallback if too short ---
    if (!text || text.length < 100) {
      console.log("[parsePVSyst] pdf-parse text too short -> using pdfjs-dist fallback");
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pages = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const s = content.items.map(i => i.str).join(" ");
        pages.push(s);
      }
      text = pages.join(" ").replace(/\s+/g, " ").trim();
    }

    console.log("[parsePVSyst] First 500 chars:", text.slice(0, 500));

    // --- Step 3: Keyword-based extraction ---
    const find = (regex) => (text.match(regex) || [])[1]?.trim() || null;

    const siteName =
      find(/Site Name[:\s]*([A-Za-z0-9\s\-_]+)/i) ||
      find(/Project[:\s]*([A-Za-z0-9\s\-_]+)/i);

    const gpsMatch =
      text.match(/Lat[:\s]*([0-9]{1,2}\.[0-9]+)/i) ||
      text.match(/([0-9]{1,2}\.[0-9]{2,})\s*[°]?[,\s;]\s*(1[0-1][0-9]\.[0-9]{2,})/i) ||
      text.match(/([0-9]{1,2}\.[0-9]+)[\s,]+(10[0-9]\.[0-9]+)/i);

    const gps = gpsMatch ? { latitude: gpsMatch[1], longitude: gpsMatch[2] } : null;

    const cod =
      find(/Report Date[:\s]*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i) ||
      find(/Generated on[:\s]*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i) ||
      find(/Commissioning[:\s]*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i);

    const pvModule =
      find(/PV module[:\s]*([A-Za-z0-9\-\/]+)/i) ||
      find(/Module type[:\s]*([A-Za-z0-9\-\/]+)/i) ||
      find(/Module name[:\s]*([A-Za-z0-9\-\/]+)/i);

    const inverter =
      find(/Inverter[:\s]*([A-Za-z0-9\-\/]+)/i) ||
      find(/Inverter type[:\s]*([A-Za-z0-9\-\/]+)/i) ||
      find(/Inverter model[:\s]*([A-Za-z0-9\-\/]+)/i);

    const dcCapacity =
      find(/Installed DC power[:\s]*([\d,\.]+)/i) ||
      find(/Array power[:\s]*([\d,\.]+)/i) ||
      find(/PV power[:\s]*([\d,\.]+)/i);

    const acCapacity =
      find(/AC Power[:\s]*([\d,\.]+)/i) ||
      find(/Nominal AC power[:\s]*([\d,\.]+)/i);

    const totalModules =
      find(/Nb of modules[:\s]*([\d,]+)/i) ||
      find(/Total modules[:\s]*([\d,]+)/i);

    const totalInverters =
      find(/Nb of inverters[:\s]*([\d,]+)/i) ||
      find(/Total inverters[:\s]*([\d,]+)/i);

    console.log("[parsePVSyst] siteName:", siteName);
    console.log("[parsePVSyst] GPS:", gps);
    console.log("[parsePVSyst] COD:", cod);
    console.log("[parsePVSyst] PV Module:", pvModule);
    console.log("[parsePVSyst] Inverter:", inverter);
    console.log("[parsePVSyst] DC:", dcCapacity, "| AC:", acCapacity);

    return {
      siteName,
      gps,
      cod,
      pvModule,
      inverter,
      dcCapacity,
      acCapacity,
      totalModules,
      totalInverters,
    };
  } catch (err) {
    console.error("[parsePVSyst] Error:", err);
    return { error: err.message };
  }
}
