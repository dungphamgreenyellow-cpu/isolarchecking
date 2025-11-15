// backend/routes/analysis.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { streamParseAndCompute } from "../compute/fusionSolarParser.js";
import { computeRealPerformanceRatio } from "../compute/realPRCalculator.js";
import { parsePVSystPDF } from "../compute/parsePVSyst.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /analysis/compute (multer memoryStorage ONLY)
router.post("/compute", upload.single("logfile"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.json({ success: false, error: "No logfile uploaded" });
    }

    const t0 = performance.now();
    const result = await streamParseAndCompute(req.file.buffer);
    const ms = performance.now() - t0;
    // Wrap in a stable shape so FE can rely on data field
    return res.json({ success: true, data: result, parse_ms: ms });

  } catch (err) {
    console.error("Compute Error:", err);
    return res.json({ success: false, error: err.message });
  }
});

// POST /analysis/realpr
// body: { records, capacity, irradiance }
router.post("/realpr", async (req, res) => {
  try {
    const { records, capacity, irradiance } = req.body || {};
    if (!records || !Array.isArray(records)) {
      return res.json({ success: false, error: "Missing records array in body" });
    }
    if (!capacity) return res.json({ success: false, error: "Missing capacity" });
    const parsed = { records };
    const dailyGHI = irradiance || [];
    const result = computeRealPerformanceRatio(parsed, dailyGHI, capacity);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
});
// POST /analysis/parse-pvsyst (multer memoryStorage)
router.post("/parse-pvsyst", upload.single("pvsystFile"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: "No PDF uploaded" });
    }
    const tmpPath = `/tmp/pvsyst_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
    await fs.promises.writeFile(tmpPath, req.file.buffer);
    const t0 = performance.now();
    const info = await parsePVSystPDF(tmpPath);
    const dt = performance.now() - t0;
    try { await fs.promises.unlink(tmpPath); } catch {}
    return res.json({ success: true, ms: dt, data: info });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


