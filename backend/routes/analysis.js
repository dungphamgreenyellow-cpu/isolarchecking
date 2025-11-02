// backend/routes/analysis.js
import express from "express";
import { checkFusionSolarPeriod } from "../compute/fusionSolarParser.js";
import { computeRealPerformanceRatio } from "../compute/realPRCalculator.js";

const router = express.Router();

// POST /analysis/compute
router.post("/compute", async (req, res) => {
  try {
    // expect express-fileupload field named 'logfile'
    if (!req.files || !req.files.logfile) {
      return res.status(400).json({ success: false, error: "No file uploaded (field 'logfile' expected)" });
    }

    const file = req.files.logfile; // uploaded file
    const buffer = file.data;    // file buffer

    const result = await checkFusionSolarPeriod({ name: file.name, data: buffer });

    return res.json({ success: true, ...result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: e?.message });
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
