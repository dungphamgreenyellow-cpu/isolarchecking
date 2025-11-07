// backend/index.js
import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

import uploadRoutes from "./routes/upload.js";
import analysisRoutes from "./routes/analysis.js";

import { streamParseAndCompute } from "./compute/fusionSolarParser.js";
import { computeRealPerformanceRatio } from "./compute/realPRCalculator.js";
import { parsePVSystPDF } from "./compute/parsePVSyst.js";

const app = express();
// ✅ Khuyến nghị: auto PORT từ Render/host, có fallback để chạy local
const PORT = process.env.PORT || 3001;

// === __dirname fix cho ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Upload lớn (dùng /tmp cho Render)
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: {}, // unlimited
  })
);

// === CORS for Render + local dev (explicit allowlist)
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://isolarchecking.onrender.com",
  "https://isolarchecking-backend.onrender.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("[CORS] Blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ✅ Rất quan trọng — cho phép preflight OPTIONS
app.options("*", cors());
console.log("[CORS] Active origins:", allowedOrigins);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// === Healthcheck
app.get("/", (_req, res) => {
  res.send("✅ iSolarChecking backend cloud compute is running!");
});

// === Parse PVSyst PDF (đọc file dạng Buffer)
app.post("/api/parse-pvsyst", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }
    const f = req.files.file;
    const tmpPath = `/tmp/pvsyst_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
    await f.mv(tmpPath);
    const t0 = performance.now();
    const info = await parsePVSystPDF(tmpPath);
    const dt = performance.now() - t0;
    try { await fs.promises.unlink(tmpPath); } catch {}
    console.log("[/api/parse-pvsyst] file=", f.name, "ms=", dt.toFixed(1));
    return res.json({ success: true, ms: dt, data: info });
  } catch (err) {
    console.error("❌ parse-pvsyst error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === FusionSolar quick period check
app.post("/api/parse-fusion", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
  const f = req.files.file;
  const parsed = await streamParseAndCompute(f.data);
  return res.json({ success: true, data: parsed });
  } catch (err) {
    console.error("parse-fusion error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === Compute RPR
app.post("/api/compute-rpr", async (req, res) => {
  try {
    const { parsed, dailyGHI, capacity } = req.body;
    if (!parsed || !capacity) {
      return res.status(400).json({ error: "Missing input data" });
    }
    const rpr = computeRealPerformanceRatio(parsed, dailyGHI || [], capacity);
    return res.json({ success: true, rpr });
  } catch (err) {
    console.error("compute-rpr error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === Mount routes (QUAN TRỌNG): bật middleware để req.files hoạt động
app.use("/api", uploadRoutes);
app.use("/analysis", analysisRoutes);
// Global error handler: đảm bảo backend luôn trả JSON khi có lỗi không bắt
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", err);
  res.status(500).json({
    success: false,
    error: err?.message || "Internal Server Error",
  });
});
// ESM: backend uses "type": "module" in package.json — imports are ES modules

// === Start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`☀️ Backend running → http://localhost:${PORT}`);
});
