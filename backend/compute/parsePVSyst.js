import fs from "fs";

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
    // Dynamic import to avoid requiring 'canvas' at startup
    let pdfjsLib = null;
    try {
      const mod = await import("pdfjs-dist/legacy/build/pdf.js").catch(() => null);
      pdfjsLib = mod?.default || mod;
    } catch {
      pdfjsLib = null;
    }
    const _getDocument = pdfjsLib?.getDocument || pdfjsLib?.default?.getDocument;
    if (typeof _getDocument !== "function") {
      throw new Error("pdfjsLib.getDocument not available");
    }
    const doc = await _getDocument({ data: new Uint8Array(buffer) }).promise;
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
  // parser selected and text length available (log removed in release)

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

    // Prefer explicit Latitude/Longitude tokens when present
    if (/(Lat|Latitude)/i.test(text) && /(Lon|Longitude)/i.test(text)) {
      // Prefer decimal numbers and plausible ranges
      const rawTokens = text.match(/[+\-]?\d{1,3}(?:[.,]\d+)?/g) || [];
      const tokens = rawTokens
        .map((s) => ({ raw: s, val: parseNumberFlexible(s), hasDec: /[.,]/.test(s) }))
        .filter((t) => Number.isFinite(t.val));
      // Pick first lat (<=90) then next lon (<=180), prefer decimals
      let latIdx = tokens.findIndex((t) => t.hasDec && Math.abs(t.val) <= 90);
      if (latIdx === -1) latIdx = tokens.findIndex((t) => Math.abs(t.val) <= 90);
      if (latIdx !== -1) {
        const lonIdx = tokens.findIndex((t, i) => i > latIdx && Math.abs(t.val) <= 180);
        if (lonIdx !== -1) {
          let lat = tokens[latIdx].val;
          let lon = tokens[lonIdx].val;
          const hemiLat = (text.match(/\b([NS])\b/) || [])[1]?.toUpperCase();
          const hemiLon = (text.match(/\b([EW])\b/) || [])[1]?.toUpperCase();
          if (hemiLat === "S" && lat != null) lat = -Math.abs(lat);
          if (hemiLat === "N" && lat != null) lat = Math.abs(lat);
          if (hemiLon === "W" && lon != null) lon = -Math.abs(lon);
          if (hemiLon === "E" && lon != null) lon = Math.abs(lon);
          return { lat, lon };
        }
      }
    }

    // 1) Try decimal with optional hemisphere near values
    // e.g., 10.123 N , 106.456 E  OR  Lat 10.123 , Lon 106.456
  const hasKeywords = /(Lat|Latitude).*(Lon|Longitude)/i.test(text);
    const decPair = text.match(/([+\-]?\d{1,2}(?:[.,]\d+)?)\s*([NS])?[^\dA-Za-z+\-.]+([+\-]?\d{2,3}(?:[.,]\d+)?)\s*([EW])?/i);
    if (decPair) {
      let lat = parseNumberFlexible(decPair[1]);
      let lon = parseNumberFlexible(decPair[3]);
      const hemiLat = decPair[2]?.toUpperCase();
      const hemiLon = decPair[4]?.toUpperCase();
      const hasHemi = !!(hemiLat || hemiLon);
      if (!hasHemi && !hasKeywords) {
        // Avoid false positive from dates like 21/12/22
        return { lat: null, lon: null };
      }
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

  // Site name: prefer "Project: <name>" (stop before Variant:)
  const siteName =
    (pdfText.match(/Project:\s*([^\n]+?)(?:\s+Variant:|$)/i) || [])[1]?.trim() ||
    find(/((?:Project|Site)\s*name)[:\-\s]*([^\n]+)/i);

  // Capacities with units
  // DC (kWp/MWp)
  let dcRaw =
    find(/((?:Array|Installed|PV)\s*(?:power|capacity))[:\-\s]*([\d.,\s]+\s*(?:kWp|MWp))/i);
  let acRaw =
    find(/((?:AC|Inverter)\s*(?:power|capacity))[:\-\s]*([\d.,\s]+\s*(?:kWac|kW|MWac|kVA|MVA))/i);

  // Models (prefer 'Manufacturer Model <name> (' patterns)
  let pvModel =
    (pdfText.match(/PV\s+module\s+Manufacturer\s+Model\s+([^()\n]+?)\s*\(/i) || [])[1]?.trim() ||
    find(/((?:Module|PV module|Module type))[:\-\s]*([^\n]+)/i);
  let inverterModel =
    (pdfText.match(/Inverter\s+Manufacturer\s+Model\s+([^()\n]+?)\s*\(/i) || [])[1]?.trim() ||
    find(/((?:Inverter|Inverter type))[:\-\s]*([^\n]+)/i);

  // Tilt/Azimuth/Soiling
  let tiltRaw = find(/(Tilt)[:\-\s]*([\d.,]+)/i);
  let azimuthRaw = find(/(Azimuth)[:\-\s]*([\d.,\-]+)/i);
  // Prefer explicit pair "Tilt/Azimuth 8/0 °" or "Tilts/azimuths ... 8 / 0 °"
  const tiltAz1 = pdfText.match(/Tilt\s*\/\s*Azimuth\s*([\-\d.,]+)\s*\/\s*([\-\d.,]+)\s*°/i);
  const tiltAz2 = pdfText.match(/Tilts?\s*\/\s*azimuths?[^\n]*?([\-\d.,]+)\s*\/\s*([\-\d.,]+)\s*°/i);
  const taz = tiltAz1 || tiltAz2;
  if (taz) {
    tiltRaw = taz[1];
    azimuthRaw = taz[2];
  }
  const soilingRaw = find(/(Soiling\s*loss)[:\-\s]*([\d.,]+)/i);

  // GPS: prefer a short window around the first Latitude occurrence (since pdfText may be single-line)
  const latIdx = pdfText.search(/Lat(?:itude)?\s+Longitude/i);
  const gpsLine = latIdx >= 0 ? pdfText.slice(latIdx, latIdx + 120) : "";
  const gpsObj = gpsLine ? parseLatLon(gpsLine) : { lat: null, lon: null };
  const gps = gpsObj.lat != null && gpsObj.lon != null
    ? `${gpsObj.lat.toFixed(4)}°, ${gpsObj.lon.toFixed(4)}°`
    : null;

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

  // Additional targeted capacity extraction
  if (!dcRaw) {
    let m = pdfText.match(/System\s+power[:\-\s]*([\d.,]+)\s*(kWp|MWp)/i)
      || pdfText.match(/Total\s+PV\s+power[^\n]*?([\d.,]+)\s*(kWp|MWp)/i);
    if (m) dcRaw = `${m[1]} ${m[2] || "kWp"}`;
  }
  if (!acRaw) {
    // Target 'Total inverter power' first
    let m = pdfText.match(/Total\s+inverter\s+power\s*[:\-]?\s*([\d.,]+)\s*(kWac|kW|MWac)/i);
    // Pattern like: "... 800 1.226 units kWac" → take the first number before 'units kWac'
    if (!m) {
      const twoNum = pdfText.match(/\b([\d.,]+)\s+([\d.,]+)\s+units\s+kWac\b/i);
      if (twoNum) m = [null, twoNum[1], 'kWac'];
    }
    // Fallback: line with Inverters .. Pnom total capturing the larger total (second number in the block)
    if (!m) {
      const invLine = pdfText.match(/Inverters\s+Nb\.\s+of\s+units\s+Pnom\s+total\s+Pnom\s+ratio[^\n]+/i);
      if (invLine) {
        const nums = (invLine[0].match(/\b[\d.,]+\b/g) || []).map(parseNumberFlexible);
        // Heuristic: largest number in this block (likely total inverter power)
        const candidate = nums.filter((v) => Number.isFinite(v)).sort((a,b)=>b-a)[0];
        if (candidate) m = [null, String(candidate), (invLine[0].match(/kWac|kW|MWac/i)||['kW'])[0]];
      }
    }
    if (!m) m = pdfText.match(/Total\s+power\s*[:\-]?[^\n]*?\b([\d.,]+)\s*(kWac|kW|MWac)\b/i);
    if (m) acRaw = `${m[1]} ${m[2] || "kW"}`;
  }

  const dc_kWp = toKWp(dcRaw);
  const ac_kW = toKWac(acRaw);

  // === Extra DC capacity extraction (robust Pnom total pattern) ===
  // Pattern examples inside PDF text:
  //   "PV Array Nb. of modules Pnom total 1799 980 units kWp"
  //   "Inverters Nb. of units Pnom total Pnom ratio 8 800 1.226 units kWac"
  // We want the number immediately before "units kWp" for DC.
  let pnomDc = null;
  const pnomDcMatch = pdfText.match(/Pnom total[^\n]*?(\d+[\d.,]+)\s+units\s+kWp/i);
  if (pnomDcMatch) {
    const tokens = pnomDcMatch[0].match(/(\d+[\d.,]+)/g) || [];
    // Heuristic: last numeric token before 'units kWp'
    if (tokens.length) {
      const candidate = parseNumberFlexible(tokens[tokens.length - 1]);
      if (candidate != null) pnomDc = candidate;
    }
  }
  // Fallback: look for standalone "Pnom total" with kWp unit.
  if (pnomDc == null) {
    const alt = pdfText.match(/Pnom total\s*([\d.,]+)\s*(kWp|MWp)/i);
    if (alt) pnomDc = toKWp(`${alt[1]} ${alt[2]}`);
  }
  // Select best DC capacity
  const capacity_dc_kwp = pnomDc != null ? pnomDc : dc_kWp || null;

  // === Extract simulation/report date → cod_date ===
  // Accept patterns:
  //   Simulation date: 21/12/22 09:51
  //   Report date: 2022/12/21
  //   Generated on 21.12.2022
  // Normalize to MM/DD/YYYY for frontend date picker compatibility.
  let cod_date = null;
  const dateBlock = pdfText.match(/(Simulation date|Report date|Generated on)[:\s]+([^\n]{5,30})/i);
  if (dateBlock) {
    // Extract first date-like token
    const rawSegment = dateBlock[2];
    const dateTokenMatch = rawSegment.match(/(\d{1,4}[./-]\d{1,2}[./-]\d{2,4})/);
    if (dateTokenMatch) {
      const rawDate = dateTokenMatch[1];
      // Replace separators with '-'
      const parts = rawDate.replace(/[.\/]/g, '-').split('-');
      // Determine format heuristically
      // Cases: dd-mm-yy, dd-mm-yyyy, yyyy-mm-dd
      let day, month, year;
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // yyyy-mm-dd
          year = parseInt(parts[0]);
          month = parseInt(parts[1]);
          day = parseInt(parts[2]);
        } else if (parts[2].length === 4) {
          // dd-mm-yyyy
          day = parseInt(parts[0]);
          month = parseInt(parts[1]);
          year = parseInt(parts[2]);
        } else {
          // dd-mm-yy or yy-mm-dd -> assume dd-mm-yy common PVSyst style
          day = parseInt(parts[0]);
          month = parseInt(parts[1]);
          let y = parseInt(parts[2]);
          year = y < 30 ? 2000 + y : 1900 + y; // pivot year 30
        }
        if (
          Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year) &&
          day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900
        ) {
          const mm = String(month).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          cod_date = `${mm}/${dd}/${year}`;
        }
      }
    }
  }
  const tilt_deg = parseNumberFlexible(tiltRaw);
  const azimuth_deg = parseNumberFlexible(azimuthRaw);
  const soiling_loss_percent = parseNumberFlexible(soilingRaw);
  const dc_ac_ratio = dc_kWp && ac_kW ? Number((dc_kWp / ac_kW).toFixed(3)) : null;

  // Field logs for quick validation
  

  return {
    success: true,
    siteName,
    gps,
    capacities: { dc_kWp, ac_kW },
    capacity_dc_kwp,
    cod_date,
    pvModel,
    inverterModel,
    tilt_deg,
    azimuth_deg,
    soiling_loss_percent,
    dc_ac_ratio,
    rawText: pdfText.slice(0, 1000),
  };
}
