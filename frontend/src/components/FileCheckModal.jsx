// src/components/FileCheckModal.jsx — v7.9 Stable (Match Fusion Parser v9.9-LTS)
// ✅ Hiển thị range ngày chuẩn local (ko lệch 31/8)
// ✅ Ẩn Energy, chỉ show “OK — X days (start → end)”
// ✅ Giữ pastel SaaS style, clean UI
// ✅ Đồng bộ logic với parser v9.9-LTS

import React, { useEffect, useState } from "react";
import { checkFusionSolarPeriod } from "../utils/fusionSolarParser";

export default function FileCheckModal({ open, logFile, pvsystFile, onClose, onNext }) {
  const [checking, setChecking] = useState(false);
  const [logResult, setLogResult] = useState(null);
  const [pvsystResult, setPvsystResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setChecking(true);
      let logRes = null, pvRes = null;
      try {
        if (logFile) logRes = await checkFusionSolarPeriod(logFile);
      } catch {
        logRes = { valid: false, message: "Error reading log file" };
      }

      if (pvsystFile) {
        // Không parse PDF ở FE nữa — chỉ kiểm tra basic theo phần mở rộng
        const ok = /\.pdf$/i.test(pvsystFile.name || "");
        pvRes = { valid: ok, message: ok ? "PVSyst PDF detected" : "Invalid PDF" };
      }

      setLogResult(logRes);
      setPvsystResult(pvRes);
      setChecking(false);
    })();
  }, [open, logFile, pvsystFile]);

  if (!open) return null;

  const canProceed = logResult?.valid;

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
              <span>{checking ? "…" : logResult?.valid ? "✅" : "❌"}</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`${
                  checking
                    ? "bg-blue-500 animate-pulse"
                    : logResult?.valid
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
                : logResult?.startDate && logResult?.endDate
                ? `OK — ${logResult.days} days (${logResult.startDate} → ${logResult.endDate})`
                : logResult?.message || "Waiting..."}
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
            onClick={() =>
              onNext({ ...logResult, pvsystOK: !!pvsystResult?.valid })
            }
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
