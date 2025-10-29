const uploadRoutes = require('./routes/upload');
const analysisRoutes = require('./routes/analysis');
// === iSolarChecking Cloud Compute — v2.2-LTS ===
// ✅ Accepts up to 50 MB uploads
// ✅ Fixed CORS for *.app.github.dev + localhost
// ✅ Works with express-fileupload (preferred)
// ✅ Compatible with Codespaces and Render

import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import { checkFusionSolarPeriod } from "./compute/fusionSolarParser.js";
import { computeRealPerformanceRatio } from "./compute/realPRCalculator.js";

const app = express();
const PORT = process.env.PORT || 8080;

// === 1. Allow large uploads (50 MB) ===
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    useTempFiles: false,
  })
);

// === 2. Safe CORS config ===
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin.includes("localhost") || /\.app\.github\.dev$/.test(origin)) {
        callback(null, true);
      } else {
        console.warn("❌ Blocked CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

// === 3. JSON parsers ===
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// === 4. Root check ===
app.get("/", (req, res) => {
  res.send("✅ iSolarChecking backend cloud compute is running fine!");
});

// === 5. Parse FusionSolar ===
app.post("/api/parse-fusion", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const f = req.files.file;
    console.log(`📥 Received FusionSolar file: ${f.name}, size: ${f.size} bytes`);

    const parsed = await checkFusionSolarPeriod(f);
    console.log("✅ Parsed:", parsed.message);

    res.json({
      success: true,
      totalProduction: parsed.totalProduction,
      dailyProduction: parsed.dailyProduction,
      availableMetrics: parsed.availableMetrics,
      message: parsed.message,
    });
  } catch (err) {
    console.error("⚠️ Error parsing FusionSolar:", err);
    res.status(500).json({ success: false, error: err.message || "Parse failed" });
  }
});

// === 6. Compute RPR ===
app.post("/api/compute-rpr", async (req, res) => {
  try {
    const { parsed, dailyGHI, capacity } = req.body;
    if (!parsed || !capacity) return res.status(400).json({ error: "Missing input data" });

    const rpr = computeRealPerformanceRatio(parsed, dailyGHI || [], capacity);
    res.json({ success: true, rpr });
  } catch (err) {
    console.error("⚠️ Error computing RPR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// === 7. Start server ===
app.listen(PORT, "0.0.0.0", () => {
  console.log(`☀️ Cloud Compute API running at http://localhost:${PORT}`);
});

const path = require('path');
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('*', (req,res)=>res.sendFile(path.join(publicDir,'index.html')));

app.use('/api', uploadRoutes);
app.use('/api', analysisRoutes);
