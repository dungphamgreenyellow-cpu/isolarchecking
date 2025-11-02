// backend/routes/analysis.js
import express from "express";
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
    return res.json({ success: true, ...result });

  } catch (err) {
    console.error("[compute-error]", err);
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
    return res.json({ success: true, rpr: result, details: result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: e?.message });
  }
});

export default router;
