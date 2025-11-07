// src/components/FileCheckModal.jsx — v7.9 Stable (Match Fusion Parser v9.9-LTS)
// ✅ Hiển thị range ngày chuẩn local (ko lệch 31/8)
// ✅ Ẩn Energy, chỉ show “OK — X days (start → end)”
// ✅ Giữ pastel SaaS style, clean UI
// ✅ Đồng bộ logic với parser v9.9-LTS

import React, { useEffect, useState } from "react";
import { parsePDFGlobal } from "../utils/parsePDFGlobal";

// Using direct fetch to backend for /analysis/compute to inspect success flag explicitly.
// (Intentionally bypassing previous checkFusionSolarPeriod helper to implement new success logic.)

export default function FileCheckModal({ open, logFile, pvsystFile, onClose, onNext, setProjectInfo }) {
  const [checking, setChecking] = useState(false);
  const [logResult, setLogResult] = useState(null); // raw parse payload (data.data)
  const [logStatus, setLogStatus] = useState({ ok: false, msg: "" }); // simplified status object
  const [pvsystResult, setPvsystResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setChecking(true);
      let logRes = null, pvRes = null;
      try {
        if (logFile) {
          const backendURL = import.meta.env.VITE_BACKEND_URL || ""; // MUST be defined in .env for Render
          const formData = new FormData();
          formData.append("logfile", logFile);
          const res = await fetch(`${backendURL}/analysis/compute`, {
            method: "POST",
            body: formData,
          });
          let data = null;
          try {
            data = await res.json();
          } catch (jsonErr) {
            console.error("[FileCheckModal] JSON parse error", jsonErr);
            setLogStatus({ ok: false, msg: "Invalid JSON response" });
          }
          if (data?.success) {
            // success: backend returns { success: true, data: {...}, parse_ms }
            setLogStatus({ ok: true, msg: "FusionSolar log parsed successfully" });
            logRes = { ...data.data, success: true, parse_ms: data.parse_ms };
          } else {
            setLogStatus({ ok: false, msg: data?.message || "Error reading log file" });
            logRes = { success: false, message: data?.message || "Error reading log file" };
          }
        }
      } catch (err) {
        console.error("[FileCheckModal] Upload error:", err);
        setLogStatus({ ok: false, msg: "Server not reachable" });
        logRes = { success: false, message: "Server not reachable" };
      }

      if (pvsystFile) {
        const ok = /\.pdf$/i.test(pvsystFile.name || "");
        if (ok) {
          const pdfInfo = await parsePDFGlobal(pvsystFile);
          if (pdfInfo) {
            console.log("[FileCheckModal] Parsed PDF info:", pdfInfo);
            setProjectInfo && setProjectInfo(pdfInfo);
            pvRes = { valid: true, message: "PVSyst PDF parsed" };
          } else {
            pvRes = { valid: false, message: "Failed to parse PDF" };
          }
        } else {
          pvRes = { valid: false, message: "Invalid PDF" };
        }
      }

      setLogResult(logRes);
      setPvsystResult(pvRes);
      setChecking(false);
    })();
  }, [open, logFile, pvsystFile]);

  if (!open) return null;

  // New canProceed logic based on logStatus.ok
  const ok = logStatus.ok;
  const canProceed = logStatus.ok;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 text-gray-800">
        <h2 className="text-xl font-semibold mb-4 text-blue-700">
          Checking Uploaded File(s)
        </h2>

        <div className="space-y-3 mb-4">
          {/* Log File */}
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
            <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
              <span className="truncate">📊 Log File: {logFile?.name || "—"}</span>
              <span>{checking ? "…" : ok ? "✅" : "❌"}</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`${
                  checking
                    ? "bg-blue-500 animate-pulse"
                    : ok
                    ? "bg-green-500"
                    : "bg-red-500"
                } h-full`}
                style={{ width: checking ? "70%" : "100%" }}
              />
            </div>

            {/* hiển thị range ngày chuẩn local, không Energy */}
            <p className="text-xs text-gray-500 mt-1">
              {checking
                ? "Parsing log..."
                : ok
                ? "Log parsed successfully"
                : logStatus.msg || "Waiting..."}
            </p>
          </div>

          {/* PVSyst PDF */}
          {pvsystFile && (
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
              <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                <span className="truncate">📄 PVSyst File: {pvsystFile?.name}</span>
                <span>{checking ? "…" : pvsystResult?.valid ? "✅" : "❌"}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`${
                    checking
                      ? "bg-amber-500 animate-pulse"
                      : pvsystResult?.valid
                      ? "bg-green-500"
                      : "bg-red-500"
                  } h-full`}
                  style={{ width: checking ? "70%" : "100%" }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {checking
                  ? "Checking PDF..."
                  : pvsystResult?.message || "Waiting..."}
              </p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={checking}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onNext({ ...logResult, pvsystOK: !!pvsystResult?.valid })}
            disabled={!canProceed || checking}
            className={`px-5 py-2 rounded-lg font-medium text-white shadow-md transition-all ${
              canProceed && !checking
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {checking ? "Checking..." : "Next → Confirm Info"}
          </button>
        </div>
      </div>
    </div>
  );
}
