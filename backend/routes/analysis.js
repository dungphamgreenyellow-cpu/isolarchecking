// backend/routes/analysis.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { Readable } from "stream";
import { xmlToCsv } from "../compute/xmlToCsv.js";
import { convertXlsxToCsv } from "../utils/convertXlsxToCsv.js";
import { parseFusionSolarCsv } from "../services/fusionSolarCsvParser.js";
import { computeRealPerformanceRatio } from "../compute/realPRCalculator.js";
import { parsePVSystPDF } from "../compute/parsePVSyst.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// In-memory progress holder (simple, per-process)
let latestProgress = { p: 0 };

// GET /analysis/progress — simple polling endpoint
router.get("/progress", (req, res) => {
	return res.json({ p: latestProgress.p });
});

// POST /analysis/compute (multer memoryStorage ONLY)
router.post("/compute", upload.single("logfile"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.json({ success: false, error: "No logfile uploaded" });
    }

    // reset progress state for this compute cycle
    latestProgress = { p: 0 };

    const t0 = performance.now();
    const originalname = (req.file.originalname || "").toLowerCase();

    const tmpDir = path.join(os.tmpdir(), "isolarchecking");
    await fs.promises.mkdir(tmpDir, { recursive: true });

    const ext = path.extname(originalname) || "";
    const baseName = path.basename(originalname, ext).replace(/[^a-z0-9_-]/gi, "_");
    const inputPath = path.join(tmpDir, `${baseName}_${Date.now()}${ext}`);

    await fs.promises.writeFile(inputPath, req.file.buffer);
    latestProgress.p = 10;

    let csvPath = inputPath;

    if (/\.xlsx$/i.test(originalname)) {
      const outPath = path.join(tmpDir, `${baseName}_${Date.now()}.csv`);
      await convertXlsxToCsv(inputPath, outPath);
      csvPath = outPath;
      latestProgress.p = 40;
    } else if (/\.xml$/i.test(originalname)) {
      const csv = xmlToCsv(req.file.buffer);
      const outPath = path.join(tmpDir, `${baseName}_${Date.now()}.csv`);
      await fs.promises.writeFile(outPath, csv, "utf8");
      csvPath = outPath;
    } else if (!/\.csv$/i.test(originalname)) {
      return res.json({ success: false, error: "Invalid file type" });
    }

    const result = await parseFusionSolarCsv(csvPath, (p) => {
      latestProgress.p = p;
    });
    const ms = performance.now() - t0;

    try {
      await fs.promises.unlink(inputPath);
    } catch {}
    if (csvPath !== inputPath) {
      try {
        await fs.promises.unlink(csvPath);
      } catch {}
    }

    latestProgress.p = 100;
    return res.json({ success: true, progress: 100, data: result, parse_ms: ms });

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


