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

        const siteNameRaw = extractValue(/Project\s*:\s*(.+)/i, fullText);
        const siteName = siteNameRaw ? siteNameRaw.trim() : null;

        // Geographical site section → GPS
        const geoSection = extractSection(
          fullText,
          "Geographical site",
          "System summary"
        );

        const latRaw = extractValue(/Latitude\s+([\d.]+)/i, geoSection);
        const lonRaw = extractValue(/Longitude\s+([\d.]+)/i, geoSection);
        const gps = {
          lat: toNumber(latRaw),
          lon: toNumber(lonRaw),
        };

        // System summary section → DC/AC sizes
        const systemSection = extractSection(
          fullText,
          "System summary",
          "Array Characteristics"
        );

        const dcSizeKWp = toNumber(
          extractValue(/Total array power\s+([\d.]+)\s*kWp/i, systemSection)
        );
        const acSizeKW = toNumber(
          extractValue(/Total\s+AC\s+power\s+([\d.]+)\s*kW/i, systemSection)
        );

        // Array characteristics → module/inverter model + counts
        const pvSection = extractSection(
          fullText,
          "Array Characteristics",
          "Array losses"
        );

        const moduleModelRaw = extractValue(
          /Model\s*:\s*([A-Za-z0-9\-\/]+)/i,
          pvSection
        );
        const moduleModel = moduleModelRaw ? moduleModelRaw.trim() : null;

        const moduleCount = toNumber(
          extractValue(/Nb of modules\s*:\s*([0-9]+)/i, pvSection)
        );

        const inverterModelRaw = extractValue(
          /Inverter\s*Model\s*:\s*([A-Za-z0-9\-\/]+)/i,
          pvSection
        );
        const inverterModel = inverterModelRaw ? inverterModelRaw.trim() : null;

        const inverterCount = toNumber(
          extractValue(/Number of inverters\s*:\s*([0-9]+)/i, pvSection)
        );

        // Array losses section (anchor only, not parsed yet)
        const _arrayLossesSection = extractSection(
          fullText,
          "Array losses",
          "Results summary"
        );

        // Results summary → produced energy, specific yield, PR
        const resultsSection = extractSection(
          fullText,
          "Results summary",
          "Balances and main results"
        );

        const producedEnergyMWh = toNumber(
          extractValue(/Produced Energy.*?([\d.]+)\s*MWh/i, resultsSection)
        );
        const specificYield = toNumber(
          extractValue(
            /Specific production.*?([\d.]+)\s*kWh\/kWp/i,
            resultsSection
          )
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
          gps,
          dcSizeKWp,
          acSizeKW,
          moduleModel,
          moduleCount,
          inverterModel,
          inverterCount,
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
