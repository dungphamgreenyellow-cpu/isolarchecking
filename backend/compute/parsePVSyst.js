import fs from "fs";

// Rewritten PVSyst PDF parser — multi-anchor strategy
// Implements parsePVSystPDF(filePathOrBuffer) and returns structured JSON.

async function extractTextPages(input) {
  let buffer;
  if (Buffer.isBuffer(input)) buffer = input;
  else if (typeof input === "string") buffer = await fs.promises.readFile(input);
  else throw new Error("Unsupported input to extractTextPages");

  // pdf-parse primary
  try {
    const pdfParse = await import("pdf-parse").then((m) => m.default || m).catch(() => null);
    if (typeof pdfParse === "function") {
      const { text } = await pdfParse(buffer);
      const pages = String(text || "").split(/\f/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
      if (pages.length) return pages;
      return [String(text || "").replace(/\s+/g, " ").trim()];
    }
  } catch (e) {
    // fallback
  }

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js").then((m) => m.default || m);
    const getDocument = pdfjs.getDocument || pdfjs.default?.getDocument;
    const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((it) => it.str).join(" ");
      pages.push(text.replace(/\s+/g, " ").trim());
    }
    return pages;
  } catch (err) {
    return [buffer.toString("utf8").replace(/\s+/g, " ").trim()];
  }
}

function sanitizeLines(pageText) {
  const lines = String(pageText || "").split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  const cleaned = lines.filter((l) => !/PVsyst|Simulation date|Page\s+\d+/i.test(l)).map((l) => l.replace(/\s{2,}/g, " ").trim());
  const joined = [];
  for (let i = 0; i < cleaned.length; i++) {
    const cur = cleaned[i];
    const next = cleaned[i + 1] || "";
    if (/[:\-]$/.test(cur) || (/^[A-Za-z\s]+$/.test(cur) && /[0-9]/.test(next))) {
      joined.push((cur + " " + next).trim());
      i++;
    } else {
      joined.push(cur);
    }
  }
  return joined;
}

function parseNumberFlexible(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[^0-9,\.\-]/g, "");
  const hasComma = s.indexOf(",") !== -1;
  const hasDot = s.indexOf(".") !== -1;
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "");
      s = s.replace(/,/, ".");
    } else {
      s = s.replace(/,/, "");
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(/,/, ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function regexExtract(text, regex, group = 1) {
  if (!text) return null;
  const m = text.match(regex);
  if (!m) return null;
  return (m[group] || null)?.toString().trim() || null;
}

function findSectionIndex(allLines, keyword) {
  const kl = keyword.toLowerCase();
  for (let i = 0; i < allLines.length; i++) if (allLines[i].toLowerCase().includes(kl)) return i;
  return -1;
}

function parseSection(lines, startIdx, endIdx) {
  return lines.slice(startIdx, endIdx + 1).join("\n");
}

function parseMonthlyTable(sectionText) {
  const lines = sectionText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) => /GlobHor|DiffHor|T_Amb|GlobInc|GlobEff|EArray|E_Grid|PR/i.test(l));
  if (headerIdx === -1) return { monthly: null, yearSummary: null };
  const header = lines[headerIdx].split(/\s{2,}|\s\|\s|\s+/).map((h) => h.trim());
  const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec","year"];
  const monthly = [];
  let yearSummary = {};
  for (let i = headerIdx + 1; i < Math.min(lines.length, headerIdx + 40); i++) {
    const row = lines[i].split(/\s{2,}|\s\|\s|\s+/).map((c) => c.trim());
    if (!row.length) continue;
    const rowKey = (row[0] || "").toLowerCase();
    const monthIdx = monthNames.findIndex((m) => rowKey.startsWith(m) || rowKey.includes(m));
    if (monthIdx === -1) continue;
    // try to find columns by header name
    const headerLower = header.map((h) => h.toLowerCase());
    const findCol = (names) => {
      for (const nm of names) {
        const idx = headerLower.findIndex((h) => h.includes(nm));
        if (idx !== -1) return row[idx] || null;
      }
      return null;
    };
    const eArrayCell = findCol(["earray","earray_kwh","earray kwh","earray (kwh)","earray (kwh)"] ) || row[1] || null;
    const eGridCell = findCol(["e_grid","egrid","e_grid"]) || row[2] || null;
    const prCell = findCol(["pr","perf","perf ratio"]) || row[header.length - 1] || null;
    const parsed = {
      month: monthNames[monthIdx],
      EArray_kWh: parseNumberFlexible(eArrayCell),
      EGrid_kWh: parseNumberFlexible(eGridCell),
      PR_percent: parseNumberFlexible(prCell),
    };
    if (monthNames[monthIdx] === "year") yearSummary = parsed; else monthly.push(parsed);
  }
  return { monthly: monthly.length ? monthly : null, yearSummary: Object.keys(yearSummary).length ? yearSummary : null };
}

export async function parsePVSystPDF(filePathOrBuffer) {
  try {
    const pages = await extractTextPages(filePathOrBuffer);
    let allLines = [];
    for (const p of pages) {
      const lines = sanitizeLines(p);
      allLines = allLines.concat(lines);
    }
    const fullText = allLines.join("\n");

    // Anchors & regexes (required patterns)
    const reportDate = regexExtract(fullText, /Simulation date:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2})\s+([0-9]{1,2}:[0-9]{2})/i, 1)
      ? regexExtract(fullText, /Simulation date:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2})\s+([0-9]{1,2}:[0-9]{2})/i, 0)
      : regexExtract(fullText, /(Report date|Generated on)[:\s]*([0-9]{1,4}[.\/\-][0-9]{1,2}[.\/\-][0-9]{2,4})/i, 2) || null;

    const latRaw = regexExtract(fullText, /Latitude\s+([0-9.,\-]+)\s*°/i, 1);
    const lonRaw = regexExtract(fullText, /Longitude\s+([0-9.,\-]+)\s*°/i, 1);
    const altRaw = regexExtract(fullText, /Altitude\s+([0-9.,\-]+)\s*m/i, 1);
    const tzRaw = regexExtract(fullText, /Time zone\s+(UTC[+\-]?\d+)/i, 1);
    const gps = {
      lat: latRaw ? parseNumberFlexible(latRaw) : null,
      lon: lonRaw ? parseNumberFlexible(lonRaw) : null,
      alt: altRaw ? parseNumberFlexible(altRaw) : null,
      timezone: tzRaw || null,
    };

    // System summary
    const moduleCount = parseNumberFlexible(regexExtract(fullText, /Nb\. of modules\s+([0-9.,]+)/i, 1));
    const systemPowerDC_kWp_raw = regexExtract(fullText, /Pnom total\s+([0-9.,]+)\s*(kWp|MWp)/i, 1);
    const systemPowerDC_unit = regexExtract(fullText, /Pnom total\s+([0-9.,]+)\s*(kWp|MWp)/i, 2) || 'kWp';
    const systemPowerDC_kWp = systemPowerDC_kWp_raw ? parseNumberFlexible(systemPowerDC_kWp_raw) * (/MWp/i.test(systemPowerDC_unit) ? 1000 : 1) : null;
    const inverterCount = parseNumberFlexible(regexExtract(fullText, /Nb\. of units\s+([0-9.,]+)/i, 1));
    const systemPowerAC_kW_raw = regexExtract(fullText, /Pnom total\s+([0-9.,]+)\s*(kWac|kW|MWac)/i, 1);
    const systemPowerAC_unit = regexExtract(fullText, /Pnom total\s+([0-9.,]+)\s*(kWac|kW|MWac)/i, 2) || 'kW';
    const systemPowerAC_kW = systemPowerAC_kW_raw ? parseNumberFlexible(systemPowerAC_kW_raw) * (/MWac/i.test(systemPowerAC_unit) ? 1000 : 1) : null;

    // Results summary
    const producedEnergy_MWh = parseNumberFlexible(regexExtract(fullText, /Produced Energy\s+([0-9.,]+)\s*MWh\/year/i, 1));
    const specificProduction_kWh_kWp = parseNumberFlexible(regexExtract(fullText, /Specific production\s+([0-9.,]+)\s*kWh\/kWp\/year/i, 1));
    const pr_percent = parseNumberFlexible(regexExtract(fullText, /Perf\.?\s*Ratio\s*PR\s+([0-9.,]+)\s*%/i, 1));

    // PV array characteristics
    const moduleManufacturer = regexExtract(fullText, /Manufacturer\s+([^\n]+)/i, 1);
    const moduleModel = regexExtract(fullText, /Model\s+([^\n]+)/i, 1);
    const moduleUnitWp = parseNumberFlexible(regexExtract(fullText, /Unit Nom\. Power\s+([0-9.,]+)\s*Wp/i, 1));
    const inverterManufacturer = regexExtract(fullText, /Inverter[\s\S]*?Manufacturer\s+([^\n]+)/i, 1) || null;
    const inverterModel = regexExtract(fullText, /Inverter[\s\S]*?Model\s+([^\n]+)/i, 1) || regexExtract(fullText, /Model\s+([^\n]+)/i, 1) || null;
    const inverterUnit_kW = parseNumberFlexible(regexExtract(fullText, /Unit Nom\. Power\s+([0-9.,]+)\s*kWac?/i, 1));

    // Array losses -> soiling
    const soilingLoss_percent = parseNumberFlexible(regexExtract(fullText, /Array\s+Soiling\s+Losses[\s\S]*?Loss Fraction\s+([0-9.,]+)\s*%/i, 1)) || parseNumberFlexible(regexExtract(fullText, /Soiling\s*loss[:\s]*([0-9.,]+)/i,1));

    // Monthly table parsing: search for Balances and main results or Results summary
    const balancesIdx = findSectionIndex(allLines, 'Balances and main results');
    let monthly = null;
    let yearSummary = null;
    if (balancesIdx !== -1) {
      const windowText = parseSection(allLines, balancesIdx, Math.min(balancesIdx + 80, allLines.length -1));
      const parsed = parseMonthlyTable(windowText);
      monthly = parsed.monthly;
      yearSummary = parsed.yearSummary;
    } else {
      const resultsIdx = findSectionIndex(allLines, 'Results summary');
      if (resultsIdx !== -1) {
        const windowText = parseSection(allLines, resultsIdx, Math.min(resultsIdx + 80, allLines.length -1));
        const parsed = parseMonthlyTable(windowText);
        monthly = parsed.monthly;
        yearSummary = parsed.yearSummary;
      }
    }

    const dcacRatio = (systemPowerDC_kWp && systemPowerAC_kW) ? Number((systemPowerDC_kWp / systemPowerAC_kW).toFixed(3)) : null;

    // Cross-check
    if (producedEnergy_MWh != null && yearSummary?.EGrid_kWh != null) {
      const eGridMWh = yearSummary.EGrid_kWh / 1000;
      if (Math.abs(producedEnergy_MWh - eGridMWh) > 1) {
        console.warn("PVSyst parse warning: Produced Energy (MWh) differs from E_Grid Year by >1 MWh", { producedEnergy_MWh, eGridMWh });
      }
    }

    const result = {
      reportDate: reportDate || null,
      gps,
      systemInfo: {
        moduleCount: moduleCount || null,
        inverterCount: inverterCount || null,
        systemPowerDC_kWp: systemPowerDC_kWp || null,
        systemPowerAC_kW: systemPowerAC_kW || null,
        dcacRatio: dcacRatio || null,
      },
      expected: {
        producedEnergy_MWh: producedEnergy_MWh || null,
        specificProduction_kWh_kWp: specificProduction_kWh_kWp || null,
        pr_percent: pr_percent || null,
      },
      pvArray: {
        moduleManufacturer: moduleManufacturer || null,
        moduleModel: moduleModel || null,
        moduleUnitWp: moduleUnitWp || null,
        inverterManufacturer: inverterManufacturer || null,
        inverterModel: inverterModel || null,
        inverterUnit_kW: inverterUnit_kW || null,
      },
      soilingLoss_percent: soilingLoss_percent || null,
      monthly: monthly || null,
      yearSummary: yearSummary || null,
    };

    return { success: true, ...result };
  } catch (err) {
    console.error("PVSyst parse error:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

export default parsePVSystPDF;
