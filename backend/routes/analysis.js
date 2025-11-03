// backend/routes/analysis.js
import express from "express";
import path from "path";
import { checkFusionSolarPeriod } from "../compute/fusionSolarParser.js";
import { computeRealPerformanceRatio } from "../compute/realPRCalculator.js";

const router = express.Router();

// POST /analysis/compute
router.post("/compute", async (req, res) => {
  try {
    const file = req.files?.logfile;
    if (!file) {
      return res.status(400).json({ success: false, error: "Không tìm thấy file log (logfile)" });
    }

    const result = await checkFusionSolarPeriod(file);
    return res.json({ success: true, data: result });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err?.message || "Lỗi phân tích FusionSolar" });
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

    const savePath = path.join(process.cwd(), "backend/test-data/test_FusionSolar.xlsx");
    await file.mv(savePath);

    return res.json({ success: true, message: "Đã lưu test_FusionSolar.xlsx" });
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
