// src/components/FileCheckModal.jsx — v7.9 AutoNext + SiteNameFix
// Fixes:
// • Auto-next to Confirm Info when parse OK
// • Remove undefined projectInfo
// • Always set siteName from FusionSolar log
// • Keep pastel SaaS style (stable)

import React, { useEffect, useState } from "react";
import { parsePDFGlobal } from "../utils/parsePDFGlobal";
import { getBackendBaseUrl } from "../config";
import debug from "debug";

const log = debug("FileCheckModal");

export default function FileCheckModal({
  open,
  logFile,
  pvsystFile,
  irrFile,
  onClose,
  onNext,
  setProjectInfo,
}) {
  const [checking, setChecking] = useState(false);
  const [logResult, setLogResult] = useState(null);
  const [logStatus, setLogStatus] = useState({ ok: false, msg: "" });
  const [pvsystResult, setPvsystResult] = useState(null);
  const [irrResult, setIrrResult] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) return;

    (async () => {
      setChecking(true);
      setProgress(0);

      let logRes = null;
      let pdfInfo = null;

      const backendURL = getBackendBaseUrl();

      const logPromise = (async () => {
        if (!logFile) return null;
        try {
          const formData = new FormData();
          formData.append("logfile", logFile);

          const computePromise = fetch(`${backendURL}/analysis/compute`, {
            method: "POST",
            body: formData,
          });

          let stopPolling = false;
          const poll = async () => {
            while (!stopPolling) {
              try {
                const pr = await fetch(`${backendURL}/analysis/progress`);
                const pj = await pr.json();
                if (typeof pj.p === "number") {
                  setProgress(pj.p);
                  if (pj.p >= 100) break;
                }
              } catch {}
              await new Promise((r) => setTimeout(r, 400));
            }
          };
          poll();

          const res = await computePromise;
          stopPolling = true;

          let data = null;
          try {
            data = await res.json();
          } catch {
            setLogStatus({ ok: false, msg: "Invalid JSON response" });
          }

          if (data?.success) {
            setProgress(100);
            setLogStatus({ ok: true, msg: "Log parsed successfully" });

            const payload =
              data.data && typeof data.data === "object" ? data.data : data;

            const v10Log = {
              siteName: payload.siteName || "",
              dailyProduction: payload.dailyProduction || {},
              dailyProductionTotal: payload.dailyProductionTotal || 0,
              firstDay: payload.firstDay || null,
              lastDay: payload.lastDay || null,
              records: payload.records || [],
              parsedRecordsCount: payload.parsedRecordsCount || 0,
            };

            if (setProjectInfo) {
              setProjectInfo((prev) => ({
                ...(prev || {}),
                siteName: v10Log.siteName || prev?.siteName || "",
                log: v10Log,
              }));
            }

            logRes = v10Log;
          } else {
            setLogStatus({
              ok: false,
              msg: data?.message || "Error reading log file",
            });
            logRes = null;
          }
        } catch {
          setLogStatus({
            ok: false,
            msg: "Server not reachable. Please check backend URL or CORS.",
          });
          logRes = null;
        }
        return logRes;
      })();

      const pvsystPromise = (async () => {
        if (!pvsystFile) return null;
        if (!/\.pdf$/i.test(pvsystFile.name || "")) return null;
        const info = await parsePDFGlobal(pvsystFile);
        if (info && info.success && setProjectInfo) {
          setProjectInfo((prev) => ({
            ...(prev || {}),
				pvsyst: info?.data || info || null,
          }));
        }
        return info;
      })();

      const [logResultV10, pvsystInfo] = await Promise.all([logPromise, pvsystPromise]);

      setLogResult(logResultV10);
      setPvsystResult(pvsystInfo);

      if (irrFile) {
        setIrrResult({ valid: true, message: "Irradiance file noted" });
      } else {
        setIrrResult(null);
      }

      const okLog = !!logResultV10;
      const okPvsyst = pvsystFile ? !!(pvsystInfo && pvsystInfo.success) : true;

      if (okLog && okPvsyst) {
        const projectMeta = {
          siteName: logResultV10.siteName || "",
          log: logResultV10,
		  pvsyst: pvsystInfo ? pvsystInfo.data || pvsystInfo || null : null,
          irr: { dailyGHI: null },
        };
        onNext(projectMeta);
      }

      setChecking(false);
    })();
  }, [open, logFile, pvsystFile]);

  if (!open) return null;

  const ok = logStatus.ok;
  const canProceed = ok;

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
              <span className="truncate">
                📊 Log File: {logFile?.name || "—"}
              </span>
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
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, progress || (checking ? 10 : 0))
                  )}%`,
                }}
              />
            </div>

            <p className="text-xs text-gray-500 mt-1">
              {checking
                ? `Reading log file… ${Math.round(progress)}%`
                : ok
                ? "Log parsed successfully"
                : logStatus.msg}
            </p>
          </div>

          {/* PVSyst */}
          {pvsystFile && (
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
              <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                <span className="truncate">
                  📄 PVSyst File: {pvsystFile?.name}
                </span>
                <span>
		          {checking ? "…" : pvsystResult?.success ? "✅" : "❌"}
                </span>
              </div>

              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`${
                    checking
                      ? "bg-amber-500 animate-pulse"
                      : pvsystResult?.success
                      ? "bg-green-500"
                      : "bg-red-500"
                  } h-full`}
                  style={{ width: checking ? "70%" : "100%" }}
                />
              </div>

              <p className="text-xs text-gray-500 mt-1">
                {checking
                  ? "Reading PVSyst file…"
                  : pvsystResult?.message || "Waiting..."}
              </p>
            </div>
          )}

          {/* Irradiance */}
          {irrFile && (
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
              <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                <span className="truncate">
                  ☀️ Irradiation File: {irrFile?.name}
                </span>
                <span>{checking ? "…" : irrResult?.valid ? "✅" : "❌"}</span>
              </div>

              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`${
                    checking
                      ? "bg-yellow-500 animate-pulse"
                      : irrResult?.valid
                      ? "bg-green-500"
                      : "bg-red-500"
                  } h-full`}
                  style={{ width: checking ? "60%" : "100%" }}
                />
              </div>

              <p className="text-xs text-gray-500 mt-1">
                {checking
                  ? "Reading irradiance file…"
                  : irrResult?.message || "Waiting..."}
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
            onClick={() => {
              if (!logResult) return;
              const projectMeta = {
                siteName: logResult.siteName || "",
                log: logResult,
                pvsyst: pvsystResult ? pvsystResult.normalized || null : null,
                irr: { dailyGHI: null },
              };
              onNext(projectMeta);
            }}
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
