// backend/index.js
// CORS strategy:
// - In production (NODE_ENV==='production'): read CORS_ORIGINS (CSV) and allow exact or wildcard host matches
//   Example: CORS_ORIGINS="http://localhost:5173,https://*.github.dev,https://*.onrender.com,https://isolarchecking.onrender.com"
//   Wildcard: only hostname supports wildcard. Pattern "*.github.dev" will match any subdomain on github.dev.
//   If protocol is provided in pattern, we verify protocol equality; otherwise we only match by hostname.
// - In development: origin: true (allow all) for easier iteration.
// - Always set credentials: true and keep app.options("*", cors()).
// Notes:
// - On Render, traffic is served via HTTPS by default; ensure your FE uses HTTPS backend URL to avoid mixed content.
// - Prefer setting VITE_BACKEND_URL to your deployed backend base URL.
import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

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

// === Adaptive CORS (dev: allow all; prod: CSV allowlist with wildcard host support)
const isProd = process.env.NODE_ENV === "production";
const csv = process.env.CORS_ORIGINS || [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://*.github.dev",
  "https://*.onrender.com",
  "https://isolarchecking.onrender.com",
  "https://isolarchecking-backend.onrender.com",
].join(",");
const allowPatterns = csv
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function parseUrlSafe(u) {
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

function hostMatches(host, patternHost) {
  // patternHost may start with *.
  if (!patternHost) return false;
  if (patternHost.startsWith("*.") && host) {
    const suffix = patternHost.slice(1); // remove leading '*'
    return host.endsWith(suffix);
  }
  return host === patternHost;
}

function originAllowed(origin) {
  if (!origin) return true; // non-browser or same-origin
  if (!isProd) return true; // dev: allow all
  const o = parseUrlSafe(origin);
  if (!o) return false;
  const oProto = o.protocol; // e.g., 'https:'
  const oHost = o.hostname; // host without port

  for (const pat of allowPatterns) {
    const p = parseUrlSafe(pat);
    if (p) {
      // pattern has protocol specified
      const sameProto = p.protocol ? p.protocol === oProto : true;
      if (!sameProto) continue;
      if (hostMatches(oHost, p.hostname)) return true;
    } else {
      // pattern is not a full URL; treat as host pattern (could include '*.')
      if (hostMatches(oHost, pat)) return true;
    }
  }
  return false;
}

const corsMiddleware = cors({
  origin: function (origin, callback) {
    if (originAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn("[CORS] Blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
});

app.use(corsMiddleware);
// ✅ Very important — allow preflight with same config
app.options("*", corsMiddleware);
console.log("[CORS] Mode:", isProd ? "production" : "development");
console.log("[CORS] Allowed patterns:", allowPatterns);

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
  console.log(`☀️ Backend running → http://localhost:${PORT}`);
});
