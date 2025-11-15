// backend/index.js — Local-first setup, simplified CORS for localhost
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

import analysisRoutes from "./routes/analysis.js"; // route module mounts compute logic internally

const app = express();
// Local default port
const PORT = process.env.PORT || 8080;

// === __dirname fix cho ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Uploads: handled solely by multer (memoryStorage) in route modules

const allowedOrigins = [
  "https://isolarchecking.onrender.com",
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, health checks)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn("Blocked CORS origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Preflight support
app.options("*", cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// === Healthcheck
app.get("/", (_req, res) => {
  res.send("✅ iSolarChecking backend cloud compute is running!");
});

// === Health for analysis
app.get("/analysis/health", (_req, res) => {
  res.json({ ok: true });
});

// === Mount routes
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
  console.log("Backend starting on PORT:", PORT);
  console.log(`☀️ Backend running → http://localhost:${PORT}`);
});
