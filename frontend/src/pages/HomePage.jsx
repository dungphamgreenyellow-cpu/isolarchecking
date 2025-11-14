// === src/pages/HomePage.jsx — iSolarChecking Cloud Deploy v8.7.7 ===
// ✅ Frontend lightweight — ALL PVSyst parsing done on backend now
// ✅ Cloud backend via direct API calls
// ✅ Keep pastel SaaS UI & layout
// ✅ No OCR / no pdfjs on frontend

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
// removed legacy api helpers; all calls use fetch/axios directly
import ProjectConfirmModal from "../components/ProjectConfirmModal";
import FileCheckModal from "../components/FileCheckModal";

// Backend base URL
const backend = import.meta.env.VITE_BACKEND_URL;

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

// (Test buttons removed)

export default function HomePage() {
  const navigate = useNavigate();
  const [logFile, setLogFile] = useState(null);
  const [pvsystFile, setPvsystFile] = useState(null);
  const [irrFile, setIrrFile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [projectData, setProjectData] = useState({});
  const [computeData, setComputeData] = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [fileCheckOpen, setFileCheckOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);
  const [parsedRecords, setParsedRecords] = useState(null);

  // Removed XLSX worker parsing — rely on backend compute only

  // STEP 4 — AUTO OPEN CONFIRM MODAL WHEN PARSE SUCCESS
  const handleStartAnalyze = async () => {
    setChecking(true);
    const fd = new FormData();
    fd.append("logfile", logFile);

    try {
  const res = await fetch(`${backend}/analysis/compute`, { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success || json.data?.note) {
        setChecking(false);
        return setError(json.data?.note || "Parsing failed.");
      }

      setProjectData(json.data);
      setModalOpen(true); // ✅ AUTO NEXT (no click)
      setError(null);
    } catch (e) {
      setError("Network error.");
    } finally {
      setChecking(false);
    }
  };

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
      const merged = { ...parsedData, ...projectData };

      setComputeData(parsedData);
      setProjectData(merged);
      setModalOpen(true);
    } catch (err) {
      setProjectData(parsedData || {});
      setComputeData(parsedData || null);
      setModalOpen(true);
    } finally {
      setChecking(false);
    }
  };

  async function handleConfirm(confirmForm) {
    setModalOpen(false);
    setConfirmData(confirmForm);
    const mergedProjectData = projectData; // already merged from parsedData step
    navigate("/report", {
      state: {
        projectData: mergedProjectData,
        confirmData: confirmForm,
        computeData: computeData,
      },
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-blue-50 to-white text-gray-800">
      <main className="w-full flex flex-col items-center justify-center mb-10 px-4">
        <div className="bg-white/90 backdrop-blur-md p-8 md:p-10 rounded-3xl shadow-lg max-w-2xl w-full text-center">
          <h1 className="text-2xl md:text-[30px] font-bold text-blue-800 mb-3">
            Your Solar Performance Insight Engine
          </h1>
          <p className="text-gray-600 mb-8 text-[15px]">
            Automatically analyze your FusionSolar or iSolarCloud log files to evaluate system performance, identify losses, and generate clear visual reports.
          </p>

          {/* === Pricing Cards === */}
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

          {/* === Upload Inputs === */}
          <h3 className="text-[18px] font-semibold text-gray-700 mb-5">Upload Your Data</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left">
            <div className="md:col-span-2 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-blue-500 text-xl">🗂️</span>
                <p className="font-semibold text-blue-700 text-[15px]">
                  Actual Log File <span className="text-red-500">*</span>
                </p>
              </div>
              <input
                type="file"
                onChange={(e) => setLogFile(e.target.files[0])}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition"
              />
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-amber-500 text-xl">📄</span>
                <p className="font-semibold text-amber-700 text-[15px]">PVSyst Simulation (optional)</p>
              </div>
              <input
                type="file"
                onChange={(e) => setPvsystFile(e.target.files[0])}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 transition"
              />
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-yellow-500 text-xl">☀️</span>
                <p className="font-semibold text-yellow-700 text-[15px]">Irradiation Data (optional)</p>
              </div>
              <input
                type="file"
                onChange={(e) => setIrrFile(e.target.files[0])}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 transition"
              />
            </div>
          </div>

          {/* === Start Analysis Button (centered) === */}
          <div className="flex justify-center mt-6">
            <button
              onClick={handleStart}
              className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition"
              disabled={checking}
            >
              {checking ? "Checking..." : "Start Analysis"}
            </button>
          </div>

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
        setProjectInfo={(info) => setProjectData((d) => ({ ...d, ...info }))}
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

// (removed unused legacy helper)
