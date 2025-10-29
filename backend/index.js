// === iSolarChecking Cloud Compute — v9.4-LTS ===
// ✅ 50MB uploads
// ✅ Render + Codespaces friendly
// ✅ Fully ESM

import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import path from "path";
import { fileURLToPath } from "url";

// Compute logic (giữ nguyên baseline của bạn)
import { checkFusionSolarPeriod } from "./compute/fusionSolarParser.js";
import { computeRealPerformanceRatio } from "./compute/realPRCalculator.js";

// Extra routes (ESM)
import uploadRoutes from "./routes/upload.js";
import analysisRoutes from "./routes/analysis.js";

const app = express();
const PORT = process.env.PORT || 8080;

// __dirname cho ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === 1) Upload middleware (50MB)
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    useTempFiles: false,
  })
);

// === 2) CORS an toàn cho localhost & *.app.github.dev
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origin.includes("localhost") || /\.app\.github\.dev$/.test(origin)) {
        cb(null, true);
      } else {
        console.warn("❌ Blocked CORS:", origin);
        cb(new Error("Not allowed by CORS"));
      }
    },
  })
);

// === 3) JSON parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// === 4) Health
app.get("/", (_req, res) => {
  res.send("✅ iSolarChecking backend cloud compute is running fine!");
});

// === 5) Parse FusionSolar — giữ đúng logic bạn đang chạy
app.post("/api/parse-fusion", async (req, res) => {
  try {
    if (!req.files?.file) return res.status(400).json({ error: "No file uploaded" });

    const f = req.files.file;
    console.log(`📥 Received FusionSolar: ${f.name} (${f.size} bytes)`);
    const parsed = await checkFusionSolarPeriod(f);

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

// === 6) Compute RPR — giữ input như bạn mô tả
app.post("/api/compute-rpr", (req, res) => {
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

// === 7) Extra routes (nếu FE đang gọi /api/upload hoặc /api/analysis)
app.use("/api", uploadRoutes);
app.use("/api", analysisRoutes);

// === 8) Serve frontend build (nếu đã build vào backend/public)
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

// === 9) Start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`☀️ Cloud Compute API running at http://localhost:${PORT}`);
});
