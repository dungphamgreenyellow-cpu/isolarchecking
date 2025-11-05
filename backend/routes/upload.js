import express from "express";
import path from "path";
import fs from "fs";
// XLSX parsing removed; keep route but do not parse Excel

const router = express.Router();

// POST /api/upload — disabled Excel parsing; use CSV via /analysis/compute
router.post("/upload", async (req, res) => {
  try {
    if (!req.files?.file) return res.status(400).json({ error: "No file uploaded" });

    const f = req.files.file;

    const tempDir = path.join(process.cwd(), "backend", "compute", "uploads");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const filePath = path.join(tempDir, f.name);
    await f.mv(filePath);

    res.json({ success: true, note: "Excel parsing disabled. Please upload CSV to /analysis/compute." });
  } catch (err) {
    console.error("❌ /api/upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
