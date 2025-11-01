import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import { fileURLToPath } from "url";
import path from "path";

import uploadRoutes from "./routes/upload.js";
import analysisRoutes from "./routes/analysis.js";

import { checkFusionSolarPeriod } from "./compute/fusionSolarParser.js";
import { computeRealPerformanceRatio } from "./compute/realPRCalculator.js";
import { parsePVSystPDF } from "./compute/parsePVSyst.js";

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Allow LARGE FILE UPLOADS
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: {}, 
  })
);

// ✅ CORS open
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));

// === Root Check ===
app.get("/", (req, res) => {
  res.send("✅ iSolarChecking backend cloud compute is running!");
});

// === Parse PVSyst PDF ===
app.post("/api/parse-pvsyst", async (req, res) => {
  try {
    if (!req.files || !req.files.file)
      return res.status(400).json({ error: "No PDF uploaded" });

    const info = await parsePVSystPDF(req.files.file);
    res.json({ success: true, data: info });
  } catch (err) {
    console.error("parse-pvsyst error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// === FusionSolar legacy ===
app.post("/api/parse-fusion", async (req, res) => {
  try {
    if (!req.files || !req.files.file)
      return res.status(400).json({ error: "No file uploaded" });

    const f = req.files.file;
    const parsed = await checkFusionSolarPeriod(f);

    return res.json({ success: true, ...parsed });
  } catch (err) {
    console.error("parse-fusion error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === Compute RPR ===
app.post("/api/compute-rpr", async (req, res) => {
  try {
    const { parsed, dailyGHI, capacity } = req.body;
    if (!parsed || !capacity)
      return res.status(400).json({ error: "Missing input data" });

    const rpr = computeRealPerformanceRatio(parsed, dailyGHI || [], capacity);
    return res.json({ success: true, rpr });
  } catch (err) {
    console.error("compute-rpr error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === API Routes ===
app.use("/api", uploadRoutes);
app.use("/api", analysisRoutes);

// === Start Server ===
app.listen(PORT, "0.0.0.0", () => {
  console.log(`☀️ Backend running → http://localhost:${PORT}`);
});