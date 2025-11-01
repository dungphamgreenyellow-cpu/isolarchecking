// === src/pages/HomePage.jsx — iSolarChecking Cloud Deploy v8.7.5 ===
// ✅ Giữ nguyên pastel SaaS layout (Free / Pay-per-Report / Member Plan)
// ✅ Cloud backend qua cloudApi.js
// ✅ Restore "Run Cloud Parse (backend)" button for manual backend test
// ✅ Test backend button retained (ping Cloud Compute API)

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadLog, uploadIrr } from "../api";
import { setSessionId } from "../sessionStore";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";
import Tesseract from "tesseract.js";
import ProjectConfirmModal from "../components/ProjectConfirmModal";
import FileCheckModal from "../components/FileCheckModal";
import { analyzeOnCloud } from "../utils/cloudApi";
import { checkFusionSolarPeriod } from "../utils/fusionSolarParser";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// === PDF Reader (multi-page + OCR fallback) ===
async function extractFullPDF(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((t) => t.str).join(" ") + "\n";
  }
  if (!fullText.trim()) {
    const ocr = await Tesseract.recognize(await file.arrayBuffer(), "eng");
    fullText = ocr.data.text;
  }
  return { fullText };
}

// === Rough Info Extractor (PVSyst) ===
function roughExtractBasicInfo(text) {
  const clean = text.replace(/\s+/g, " ");
  const gpsMatch = clean.match(/(-?\d{1,3}\.\d{2,})[°,]?\s*(\d{1,3}\.\d{2,})/);
  const module = clean.match(/\b(JAM|LR|TSM|JKM|CS)[0-9A-Za-z\-\/]+\b/)?.[0] || "";
  const inverter = clean.match(/\b(SUN2000|SG|STP|PVS)\-[A-Za-z0-9\-]+/)?.[0] || "";
  const cod = clean.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/)?.[0] || "";
  return {
    gps: gpsMatch ? `${gpsMatch[1]}, ${gpsMatch[2]}` : "",
    module,
    inverter,
    cod,
  };
}

// === Quick helper ===
function inferCountryFromLocation(str = "") {
  const s = (str || "").toLowerCase();
  if (s.includes("viet")) return "Vietnam";
  if (s.includes("thai")) return "Thailand";
  if (s.includes("phil")) return "Philippines";
  if (s.includes("indo")) return "Indonesia";
  if (s.includes("malay")) return "Malaysia";
  return "Vietnam";
}

// === TestBackendButton (ping Cloud API) ===
function TestBackendButton() {
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  const pingCloud = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/`);
      const text = await res.text();
      setReply("✅ " + text);
    } catch (err) {
      setReply("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 text-center">
      <button
        onClick={pingCloud}
        className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
      >
        {loading ? "Testing..." : "Test backend"}
      </button>
      {reply && <p className="text-xs text-gray-600 mt-2">{reply}</p>}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [logFile, setLogFile] = useState(null);
  const [pvsystFile, setPvsystFile] = useState(null);
  const [irrFile, setIrrFile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [projectData, setProjectData] = useState({});
  const [fileCheckOpen, setFileCheckOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleStart = () => {
    if (!logFile) {
      alert("Please upload your Actual Log File before starting analysis.");
      return;
    }
    setFileCheckOpen(true);
  };

  const handleFileCheckNext = async (parsedData) => {
    setFileCheckOpen(false);
    setChecking(true);
    try {
      let autoInfo = {};
      if (pvsystFile) {
        const result = await extractFullPDF(pvsystFile);
        localStorage.setItem("pvsyst_full_text", result.fullText);
        autoInfo = roughExtractBasicInfo(result.fullText);
      }

      let cloudResult = null;
      try {
        cloudResult = await analyzeOnCloud({
          logFile,
          irrFile,
          pvsystFile,
          extras: { gpsCountry: autoInfo?.location || "Vietnam" },
        });
      } catch (e) {
        console.warn("⚠️ Cloud compute failed:", e.message);
      }

      const merged = {
        ...autoInfo,
        ...parsedData,
        actualProduction:
          cloudResult?.summary?.totalEac ?? parsedData?.totalProduction ?? 0,
        dailyProduction:
          cloudResult?.charts?.dailyProd ?? parsedData?.dailyProduction ?? [],
        rpr: cloudResult?.summary?.RPR ?? null,
        cloudMeta: cloudResult?.meta ?? null,
        cloudDebug: cloudResult?.debug ?? null,
      };
      setProjectData(merged);
      setModalOpen(true);
    } catch {
      setProjectData(parsedData || {});
      setModalOpen(true);
    } finally {
      setChecking(false);
    }
  };

  const handleConfirm = (manualInfo) => {
    const gpsCountry =
      manualInfo?.country ||
      manualInfo?.nation ||
      inferCountryFromLocation(manualInfo?.location || projectData?.location);
    const merged = {
      ...projectData,
      ...manualInfo,
      logFileName: logFile?.name,
      gpsCountry: gpsCountry || "Vietnam",
    };
    navigate("/report", {
      state: {
        projectData: merged,
        files: { logFile, irrFile: irrFile || null, pvsystFile: pvsystFile || null },
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-blue-50 to-white text-gray-800">
      <main className="w-full flex flex-col items-center justify-center mb-10 px-4">
        <div className="bg-white/90 backdrop-blur-md p-8 md:p-10 rounded-3xl shadow-lg max-w-2xl w-full text-center">
          <h1 className="text-2xl md:text-[30px] font-bold text-blue-800 mb-3">
            Your Solar Performance Insight Engine
          </h1>
          <p className="text-gray-600 mb-8 text-[15px]">
            Automatically analyze your FusionSolar or iSolarCloud log files to evaluate
            system performance, identify losses, and generate clear visual reports.
          </p>

          {/* === Pricing cards === */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            <div className="bg-green-50 border border-green-200 px-4 py-4 rounded-2xl">
              <p className="font-semibold text-green-700 text-[16px]">Free Trial</p>
              <p className="text-gray-600 text-sm">1 free report for new users</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 px-4 py-4 rounded-2xl">
              <p className="font-semibold text-blue-700 text-[16px]">Pay-per-Report</p>
              <p className="text-gray-600 text-sm">Only 1 USD per analysis</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 px-4 py-4 rounded-2xl">
              <p className="font-semibold text-amber-700 text-[16px]">Member Plan</p>
              <p className="text-gray-600 text-sm">5 USD / month · up to 10 reports</p>
            </div>
          </div>

          {/* === Upload section === */}
          <h3 className="text-[18px] font-semibold text-gray-700 mb-5">Upload Your Data</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left">
            <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm hover:shadow transition">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-blue-500 text-xl">🗂️</span>
                <p className="font-semibold text-blue-700 text-[15px]">
                  Actual Log File <span className="text-red-500">*</span>
                </p>
              </div>
              <input
                type="file"
                onChange={(e) => setLogFile(e.target.files[0])}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition"
              />
              <p className="text-xs text-gray-500 mt-1">
                Required — FusionSolar / iSolarCloud export file
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm hover:shadow transition">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-amber-500 text-xl">📄</span>
                <p className="font-semibold text-amber-700 text-[15px]">
                  PVSyst Simulation (optional)
                </p>
              </div>
              <input
                type="file"
                onChange={(e) => setPvsystFile(e.target.files[0])}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 transition"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional — expected energy model for comparison
              </p>
            </div>

            <div className="rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm hover:shadow transition">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-yellow-500 text-xl">☀️</span>
                <p className="font-semibold text-yellow-700 text-[15px]">
                  Irradiation Data (optional)
                </p>
              </div>
              <input
                type="file"
                onChange={(e) => setIrrFile(e.target.files[0])}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 transition"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional — upload Excel/CSV daily irradiation (kWh/m²). If empty, system uses national baseline.
              </p>
            </div>
          </div>

          {/* === Action buttons (Restored Cloud Parse) === */}
          <div className="flex flex-col md:flex-row justify-center items-center gap-3 mt-4">
            <button
              onClick={handleStart}
              className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium px-8 py-3 rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
              disabled={checking}
            >
              {checking ? "Checking..." : "Start Analysis"}
            </button>

            <button
              onClick={async () => {
                if (!logFile) return alert("Please upload an Actual Log file first!");
                try {
                  const fd = new FormData();
                  fd.append("file", logFile);
                  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/parse-fusion`, {
                  method: "POST",
                  body: fd,
                });
                  const data = await res.json();
                  console.log("☁️ Cloud Parse Result:", data);
                  alert("✅ Cloud Parse OK!\n" + JSON.stringify(data.message || data, null, 2));
                } catch (err) {
                  console.error("❌ Cloud parse error:", err);
                  alert("❌ Cloud Parse failed: " + err.message);
                }
              }}
              className="border border-gray-300 text-gray-700 font-medium px-8 py-3 rounded-xl hover:bg-gray-50 transition-all shadow-sm hover:shadow"
            >
              Run Cloud Parse (backend)
            </button>
          </div>

          <TestBackendButton />

          <p className="mt-3 text-sm text-blue-700 hover:underline cursor-pointer">
            How to export log files
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Your files are used for analysis only — not stored or shared.
          </p>
        </div>

        <footer className="mt-8 text-sm text-gray-400">
          © 2025 iSolarChecking — Your Solar Insight Simplified
        </footer>
      </main>

      <FileCheckModal
        open={fileCheckOpen}
        logFile={logFile}
        pvsystFile={pvsystFile}
        irrFile={irrFile}
        onClose={() => setFileCheckOpen(false)}
        onNext={handleFileCheckNext}
      />
      <ProjectConfirmModal
        open={modalOpen}
        initialData={projectData}
        onConfirm={handleConfirm}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}


/* Auto-wired: backend upload handlers */
async function handleUploadBackend(file){
  const r = await uploadLog(file);
  if (r.ok && r.id) { setSessionId(r.id); }
}
