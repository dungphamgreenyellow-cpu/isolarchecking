import express from "express";
import path from "path";
import fs from "fs";
import xlsx from "xlsx";

const router = express.Router();

// POST /api/upload — demo parse Excel nhanh (nếu FE đang dùng endpoint này)
router.post("/upload", async (req, res) => {
  try {
    if (!req.files?.file) return res.status(400).json({ error: "No file uploaded" });

    const f = req.files.file;

    const tempDir = path.join(process.cwd(), "backend", "compute", "uploads");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const filePath = path.join(tempDir, f.name);
    await f.mv(filePath);

    const wb = xlsx.readFile(filePath);
    const sheet = wb.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheet]);

    res.json({ success: true, rows: data.length, preview: data.slice(0, 5) });
  } catch (err) {
    console.error("❌ /api/upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
