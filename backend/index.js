import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import { fileURLToPath } from "url";
import path from "path";

import uploadRoutes from "./routes/upload.js";
import analysisRoutes from "./routes/analysis.js";

import { checkFusionSolarPeriod } from "./compute/fusionSolarParser.js";
import { computeRealPerformanceRatio } from "./compute/realPRCalculator.js";

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === 1. Allow 50MB upload size ===
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    useTempFiles: false,
  })
);

// === 2. CORS Safe ===
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

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// === Root Check ===
app.get("/", (req, res) => {
  res.send("✅ iSolarChecking backend cloud compute is running!");
});

// === FusionSolar Parser ===
app.post("/api/parse-fusion", async (req, res) => {
  try {
    if (!req.files || !req.files.file) return res.status(400).json({ error: "No file uploaded" });

    const f = req.files.file;
    const parsed = await checkFusionSolarPeriod(f);

    res.json({
      success: true,
      ...parsed,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === Compute RPR ===
app.post("/api/compute-rpr", async (req, res) => {
  try {
    const { parsed, dailyGHI, capacity } = req.body;
    if (!parsed || !capacity) return res.status(400).json({ error: "Missing input data" });

    const rpr = computeRealPerformanceRatio(parsed, dailyGHI || [], capacity);
    res.json({ success: true, rpr });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === API Routes ===
app.use("/api", uploadRoutes);
app.use("/api", analysisRoutes);

// === Start Server ===
app.listen(PORT, "0.0.0.0", () => {
  console.log(`☀️ Backend running → http://localhost:${PORT}`);
});