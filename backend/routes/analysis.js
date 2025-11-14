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

    const result = await streamParseAndCompute(req.file.buffer);
    return res.json(result);

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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Optional mirror endpoint: POST /analysis/parse-pvsyst
router.post("/parse-pvsyst", async (req, res) => {
  try {
    const file = req.files?.pvsyst || req.files?.file;
    if (!file?.data) return res.status(400).json({ success: false, error: "No PDF uploaded" });
    const tmpPath = `/tmp/pvsyst_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
    await file.mv(tmpPath);
    const t0 = performance.now();
    const info = await parsePVSystPDF(tmpPath);
    const dt = performance.now() - t0;
    
    try { await fs.promises.unlink(tmpPath); } catch {}
    return res.json({ success: true, ms: dt, data: info });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === Dev-only helpers: parse local test files without uploading
// GET /analysis/compute-test → parse backend/test-data/test_FusionSolar.xlsx
router.get("/compute-test", async (_req, res) => {
  try {
    const p1 = path.join(process.cwd(), "backend/test-data/test_FusionSolar.xlsx");
    if (!fs.existsSync(p1)) return res.status(404).json({ success: false, error: "Missing backend/test-data/test_FusionSolar.xlsx" });
    const buf = await fs.promises.readFile(p1);
    const result = await streamParseAndCompute(buf);
    return res.json({ success: true, data: result, source: "test-data" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /analysis/parse-pvsyst-test → parse backend/test-data/test_PVSyst.pdf
router.get("/parse-pvsyst-test", async (_req, res) => {
  try {
    const p2 = path.join(process.cwd(), "backend/test-data/test_PVSyst.pdf");
    if (!fs.existsSync(p2)) return res.status(404).json({ success: false, error: "Missing backend/test-data/test_PVSyst.pdf" });
    const t0 = performance.now();
    const info = await parsePVSystPDF(p2);
    const ms = performance.now() - t0;
    return res.json({ success: true, ms, data: info, source: "test-data" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
