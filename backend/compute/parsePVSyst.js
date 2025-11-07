import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

// PVSyst PDF Parser v5.3.4 — Render-safe, Node20 ESM compatible
// Primary text extraction: pdf-parse (dynamic import inside function)
// Fallback extraction: pdfjs-dist with simple token join

export async function parsePVSystPDF(filePath) {
  const buffer = await fs.promises.readFile(filePath);

  // === Try pdf-parse first (dynamic import, guarded) ===
  let used = "pdf-parse";
  let pdfText = "";
  try {
    let pdfModule = null;
    try {
      const mod = await import("pdf-parse").catch(() => null);
      pdfModule = mod?.default || mod;
    } catch {
      pdfModule = null;
    }
    if (typeof pdfModule === "function") {
      const data = await pdfModule(buffer);
      pdfText = (data?.text || "").replace(/\s+/g, " ").trim();
    }
  } catch (e) {
    // swallow, will fallback
    pdfText = "";
  }

  // === Fallback to pdfjs-dist if no/short text ===
  if (!pdfText || pdfText.length < 100) {
    used = "pdfjs-dist";
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((it) => it.str).join(" ");
      pages.push(text);
    }
    pdfText = pages.join(" ").replace(/\s+/g, " ").trim();
  }

  // Logging for diagnostics
  console.log(`[parsePVSyst] Used: ${used} | length=${pdfText.length}`);
  console.log("[parsePVSyst] First 500 chars:", pdfText.slice(0, 500));

  // === Helpers ===
  const parseNumberFlexible = (raw) => {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (!s) return null;
    // keep digits, separators, sign
    s = s.replace(/[^0-9,\.\-]/g, "");
    if (!s) return null;
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    if (hasComma && hasDot) {
      // Determine decimal separator as the rightmost of comma/dot
      const lastComma = s.lastIndexOf(",");
      const lastDot = s.lastIndexOf(".");
      if (lastComma > lastDot) {
        // comma as decimal, remove dots
        s = s.replace(/\./g, "");
        s = s.replace(",", ".");
      } else {
        // dot as decimal, remove commas
        s = s.replace(/,/g, "");
      }
    } else if (hasComma && !hasDot) {
      // only comma → treat as decimal
      s = s.replace(",", ".");
    } // only dot or neither → leave as is
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };

  const toDecimal = (deg, min, sec) => {
    const d = parseFloat(deg) || 0;
    const m = parseFloat(min) || 0;
    const s = parseFloat(sec) || 0;
    return d + m / 60 + s / 3600;
  };

  const parseLatLon = (t) => {
    if (!t) return { lat: null, lon: null };
    const text = String(t);

    // 1) Try decimal with optional hemisphere near values
    // e.g., 10.123 N , 106.456 E  OR  -10.123, 106.456
    const decPair = text.match(/([+\-]?\d{1,2}(?:[.,]\d+)?)\s*([NS])?[^\dA-Za-z+\-.]+([+\-]?\d{2,3}(?:[.,]\d+)?)\s*([EW])?/i);
    if (decPair) {
      let lat = parseNumberFlexible(decPair[1]);
      let lon = parseNumberFlexible(decPair[3]);
      const hemiLat = decPair[2]?.toUpperCase();
      const hemiLon = decPair[4]?.toUpperCase();
      if (hemiLat === "S" && lat != null) lat = -Math.abs(lat);
      if (hemiLat === "N" && lat != null) lat = Math.abs(lat);
      if (hemiLon === "W" && lon != null) lon = -Math.abs(lon);
      if (hemiLon === "E" && lon != null) lon = Math.abs(lon);
      return { lat, lon };
    }

    // 2) Try DMS tokens with hemisphere letters, take first two occurrences
    const dmsRe = /(\d{1,3})\s*[°\s]\s*(\d{1,2})?['’′]?\s*(\d{1,2})?["”″]?\s*([NSEW])/gi;
    const tokens = [];
    let m;
    while ((m = dmsRe.exec(text)) && tokens.length < 2) {
      tokens.push(m);
    }
    if (tokens.length >= 2) {
      const a = tokens[0];
      const b = tokens[1];
      let lat = toDecimal(a[1], a[2], a[3]);
      let lon = toDecimal(b[1], b[2], b[3]);
      const hemiA = a[4].toUpperCase();
      const hemiB = b[4].toUpperCase();
      if (hemiA === "S") lat = -Math.abs(lat);
      if (hemiB === "W") lon = -Math.abs(lon);
      // If order detected as lon-lat, try swap (rare). Keep simple: assume first is lat.
      return { lat, lon };
    }

    return { lat: null, lon: null };
  };

  // === Extraction (regex) ===
  const find = (r) => (pdfText.match(r) || [])[2]?.trim() || null;

  const siteName =
    find(/((?:Project|Site)\s*name)[:\-\s]*([^\n]+)/i);

  // Capacities with units
  // DC (kWp/MWp)
  let dcRaw =
    find(/((?:Array|Installed|PV)\s*(?:power|capacity))[:\-\s]*([\d.,\s]+\s*(?:kWp|MWp))/i);
  let acRaw =
    find(/((?:AC|Inverter)\s*(?:power|capacity))[:\-\s]*([\d.,\s]+\s*(?:kWac|kW|MWac|kVA|MVA))/i);

  // Models
  const moduleModel =
    find(/((?:Module|PV module|Module type))[:\-\s]*([^\n]+)/i);
  const inverterModel =
    find(/((?:Inverter|Inverter type))[:\-\s]*([^\n]+)/i);

  // Tilt/Azimuth/Soiling
  const tiltRaw = find(/(Tilt)[:\-\s]*([\d.,]+)/i);
  const azimuthRaw = find(/(Azimuth)[:\-\s]*([\d.,\-]+)/i);
  const soilingRaw = find(/(Soiling\s*loss)[:\-\s]*([\d.,]+)/i);

  // GPS: try to locate a "Lat" line first; otherwise scan whole text
  const gpsLine = (pdfText.match(/Lat[^\n]*/i) || [])[0] || "";
  const gps = gpsLine ? parseLatLon(gpsLine) : parseLatLon(pdfText);

  // Normalize units: MWp -> kWp, MWac -> kW
  const toKWp = (s) => {
    if (!s) return null;
    const val = parseNumberFlexible(s);
    if (val == null) return null;
    if (/MWp/i.test(s)) return val * 1000;
    return val; // already kWp
  };
  const toKWac = (s) => {
    if (!s) return null;
    const val = parseNumberFlexible(s);
    if (val == null) return null;
    if (/MWac|MVA/i.test(s)) return val * 1000; // best-effort when only MVA present
    return val; // kW or kWac
  };

  const dc_kWp = toKWp(dcRaw);
  const ac_kW = toKWac(acRaw);
  const tilt_deg = parseNumberFlexible(tiltRaw);
  const azimuth_deg = parseNumberFlexible(azimuthRaw);
  const soiling_loss_percent = parseNumberFlexible(soilingRaw);
  const dc_ac_ratio = dc_kWp && ac_kW ? Number((dc_kWp / ac_kW).toFixed(3)) : null;

  // Field logs for quick validation
  console.log("[parsePVSyst] siteName:", siteName);
  console.log("[parsePVSyst] GPS:", gps);
  console.log("[parsePVSyst] PV Module:", moduleModel);
  console.log("[parsePVSyst] Inverter:", inverterModel);
  console.log("[parsePVSyst] DC kWp:", dc_kWp, "| AC kW:", ac_kW, "| ratio:", dc_ac_ratio);

  return {
    success: true,
    siteName,
    gps,
    capacities: { dc_kWp, ac_kW },
    moduleModel,
    inverterModel,
    tilt_deg,
    azimuth_deg,
    soiling_loss_percent,
    dc_ac_ratio,
    rawText: pdfText.slice(0, 1000),
  };
}
