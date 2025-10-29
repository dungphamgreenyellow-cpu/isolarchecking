import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";

// Config worker cho pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function ReportHeader({ pdfFile, excelFile }) {
  const [data, setData] = useState({
    siteName: "—",
    location: "—",
    installed: "—",
    module: "—",
    inverter: "—",
    cod: "—",
    periodText: "—",
    generatedAt: formatDate(new Date()),
  });

  /** ========== PARSE PDF (PVSYST) ========== **/
  useEffect(() => {
    const parsePDF = async () => {
      if (!pdfFile) return;
      try {
        const buffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += " " + content.items.map((it) => it.str).join(" ");
        }

        text = normalizeText(text);
        console.log("🔍 PDF text preview:", text.slice(0, 400));

        // --- Project Name ---
        const project =
          text.match(/Project\s*[:\-]\s*([A-Za-z0-9 .,_\-()\/]+)/i)?.[1] ||
          text.match(/Name\s*[:\-]\s*([A-Za-z0-9 .,_\-()\/]+)/i)?.[1] ||
          text.match(/Variant\s*[:\-]\s*([A-Za-z0-9 .,_\-()\/]+?)(?:\s+\d[\d.,]*\s*kWp|$)/i)?.[1] ||
          pdfFile.name.replace(/\.pdf$/i, "");

        // --- Installed Capacity ---
        const installed =
          text.match(/([\d.,]+)\s*kWp\b/i)?.[1]?.replace(",", ".") + " kWp" || "—";

        // --- Module model ---
        const module =
          text.match(/\b(JA|LONGI|JINKO|TRINA|RISEN|CANADIAN|HANWHA)[^×]{0,100}×\s*\d+/i)?.[0] ||
          text.match(/PV\s*Module\s*:?\s*([^(]*?×\s*\d+)/i)?.[1] ||
          "—";

        // --- Inverter model ---
        const inverter =
          text.match(/\b(HUAWEI|SUNGROW|FIMER|GOODWE|SMA|ABB)[^×]{0,100}×\s*\d+/i)?.[0] ||
          text.match(/Inverter\s*:?\s*([^(]*?×\s*\d+)/i)?.[1] ||
          "—";

        // --- COD or Simulation Date ---
        let cod =
          text.match(/\bCOD\b[:\-]?\s*([\d]{1,2}\s*\w+\s*[\d]{2,4})/i)?.[1] ||
          text.match(/\bCommission(?:ed)?\s*Date\b[:\-]?\s*(\d{1,2}\s*\w+\s*\d{2,4})/i)?.[1] ||
          text.match(/Simulation\s*date\s*[:\-]?\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/i)?.[1] ||
          "—";
        cod = normalizeDate(cod);

        // --- Location / Geographical Site ---
        const geo =
          text.match(/Geographical\s*Site\s*([A-Za-z0-9 .,_\-()\/]+)\s+([A-Za-z .,_\-()\/]+)/i) ||
          text.match(/Site\s*[:\-]\s*([A-Za-z0-9 .,_\-()\/]+)\s*-\s*([A-Za-z .,_\-()\/]+)/i);
        const location = geo
          ? `${geo[1].trim()} – ${geo[2].trim()}`
          : text.match(/Vietnam|Thailand|Indonesia|Philippines|Malaysia/i)?.[0] || "—";

        setData((prev) => ({
          ...prev,
          siteName: clean(project),
          installed: installed !== "undefined kWp" ? installed : "—",
          module: clean(module),
          inverter: clean(inverter),
          cod,
          location,
        }));
      } catch (e) {
        console.error("❌ PDF parse error:", e);
      }
    };
    parsePDF();
  }, [pdfFile]);

  /** ========== PARSE EXCEL (Inverter log → period) ========== **/
  useEffect(() => {
    const parseExcel = async () => {
      if (!excelFile) return;
      try {
        const buf = await excelFile.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const dates = [];

        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
          json.flat().forEach((v) => {
            const d = tryParseDate(v);
            if (d) dates.push(d);
          });
        });

        // fallback: extract from file name like "20250101_20250930"
        if (!dates.length && excelFile.name.match(/\d{8}/g)) {
          const matches = excelFile.name.match(/\d{8}/g);
          matches.forEach((m) => dates.push(tryParseYYYYMMDD(m)));
        }

        if (dates.length) {
          const min = new Date(Math.min(...dates));
          const max = new Date(Math.max(...dates));
          setData((prev) => ({ ...prev, periodText: formatPeriod(min, max) }));
        }
      } catch (err) {
        console.error("❌ Excel parse error:", err);
      }
    };
    parseExcel();
  }, [excelFile]);

  /** ========== HELPER FUNCTIONS ========== **/
  function normalizeText(t) {
    return t.replace(/\s+/g, " ").replace(/–/g, "-").replace(/°/g, "° ").trim();
  }
  function clean(s) {
    return String(s || "").replace(/\s{2,}/g, " ").replace(/\s*×\s*/g, " × ").trim();
  }
  function normalizeDate(txt) {
    if (!txt || txt === "—") return "—";
    txt = txt.replace(/\./g, "/").replace(/\-/g, "/").trim();
    const dmy = txt.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (dmy) {
      const [_, d, m, y] = dmy;
      const yyyy = y.length === 2 ? "20" + y : y;
      const date = new Date(`${yyyy}-${m}-${d}`);
      return formatDate(date);
    }
    return txt;
  }
  function tryParseDate(v) {
    if (v instanceof Date) return v;
    if (typeof v === "number" && v > 20000 && v < 90000) {
      const d = XLSX.SSF.parse_date_code(v);
      return new Date(d.y, d.m - 1, d.d);
    }
    const parsed = tryParseYYYYMMDD(String(v));
    return parsed;
  }
  function tryParseYYYYMMDD(s) {
    const m = s.match(/(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function formatDate(d) {
    return `${d.getDate().toString().padStart(2, "0")} ${[
      "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
    ][d.getMonth()]} ${d.getFullYear()}`;
  }
  function formatPeriod(start, end) {
    const sm = formatDate(start).split(" ")[1];
    const sy = start.getFullYear();
    const em = formatDate(end).split(" ")[1];
    const ey = end.getFullYear();
    return sy === ey ? `${sm} – ${em} ${ey}` : `${sm} ${sy} – ${em} ${ey}`;
  }

  /** ========== UI RENDER ========== **/
  return (
    <div className="flex flex-col items-center bg-white text-slate-800 relative min-h-[1123px]">
      <div className="w-[794px] bg-amber-50 border-b border-amber-200 px-10 py-8 shadow-sm">
        {/* Header Title */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[26px] font-bold text-slate-900 leading-tight">
              Site Performance Report
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Period: {data.periodText} • Generated: {data.generatedAt}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[16px] font-semibold text-amber-700 max-w-[360px] truncate" title={data.siteName}>
              {data.siteName}
            </p>
            <p className="text-sm text-slate-600">{data.location}</p>
          </div>
        </div>

        <div className="border-t border-amber-200 mb-6" />

        {/* Technical info */}
        <div className="grid grid-cols-4 gap-x-8 gap-y-3 text-[14px]">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Installed Capacity</p>
            <p className="font-semibold text-slate-900 mt-1">{data.installed}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">PV Module</p>
            <p className="font-semibold text-slate-900 mt-1 leading-snug">{data.module}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Inverter</p>
            <p className="font-semibold text-slate-900 mt-1 leading-snug">{data.inverter}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">COD</p>
            <p className="font-semibold text-slate-900 mt-1">{data.cod}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 right-[calc(50%-397px+1.5rem)] text-[12px] text-slate-400 italic">
        iSolarChecking • Automated PV Performance Analytics
      </div>
    </div>
  );
}
