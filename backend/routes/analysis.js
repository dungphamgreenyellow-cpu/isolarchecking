// backend/routes/analysis.js
import express from "express";
import path from "path";
import { streamParseAndCompute } from "../compute/fusionSolarParser.js";
import { computeRealPerformanceRatio } from "../compute/realPRCalculator.js";
import { parsePVSyst } from "../compute/parsePVSyst.js";

const router = express.Router();

// POST /analysis/compute
router.post("/compute", async (req, res) => {
  const t0 = process.hrtime.bigint();
  try {
    const file = req.files?.logfile;
    if (!file?.data) return res.status(400).json({ success: false, error: "No logfile uploaded" });
    const result = await streamParseAndCompute(file.data);
    console.log("[/analysis/compute] Payload nhận:", req.files?.logfile?.name);
    console.log("[/analysis/compute] Result trả:", result);
    const t1 = process.hrtime.bigint();
    return res.json({ success: true, data: result, parse_ms: Number(t1 - t0) / 1e6 });
  } catch (e) {
    console.error("[/analysis/compute] Lỗi:", e);
    return res.status(500).json({ success: false, message: "Backend crash", error: e.message });
  }
});

// POST /analysis/realpr
// body: { records, capacity, irradiance }
router.post("/realpr", async (req, res) => {
  try {
    const { records, capacity, irradiance } = req.body || {};
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, error: "Missing records array in body" });
    }
    if (!capacity) return res.status(400).json({ success: false, error: "Missing capacity" });

  const parsed = { records };
  const dailyGHI = irradiance || [];
  const result = computeRealPerformanceRatio(parsed, dailyGHI, capacity);
  return res.json({ success: true, data: result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: e?.message });
  }
});

export default router;

// Routes for uploading test files to backend/test-data (debug helpers)
router.post("/upload-test-log", async (req, res) => {
  try {
    const file = req.files?.logfile;
    if (!file) return res.status(400).json({ success: false, error: "logfile thiếu" });

    const savePath = path.join(process.cwd(), "backend/test-data/test_FusionSolar.csv");
    await file.mv(savePath);

    return res.json({ success: true, message: "Đã lưu test_FusionSolar.csv" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/upload-test-pdf", async (req, res) => {
  try {
    const file = req.files?.pvsyst;
    if (!file) return res.status(400).json({ success: false, error: "pvsyst thiếu" });

    const savePath = path.join(process.cwd(), "backend/test-data/test_PVSyst.pdf");
    await file.mv(savePath);

    return res.json({ success: true, message: "Đã lưu test_PVSyst.pdf" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Optional mirror endpoint: POST /analysis/parse-pvsyst
router.post("/parse-pvsyst", async (req, res) => {
  try {
    const file = req.files?.pvsyst || req.files?.file;
    if (!file?.data) return res.status(400).json({ success: false, error: "No PDF uploaded" });
    const info = await parsePVSyst(file.data);
    return res.json({ success: true, data: info });
  } catch (err) {
    console.error("parse-pvsyst error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
