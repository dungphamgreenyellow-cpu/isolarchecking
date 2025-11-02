// backend/routes/analysis.js
import express from "express";
import { checkFusionSolarPeriod } from "../compute/fusionSolarParser.js";

const router = express.Router();

// POST /api/analysis
router.post("/", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.files.file; // uploaded file
    const buffer = file.data;    // file buffer

  const parsedData = await checkFusionSolarPeriod({ name: file.name, data: buffer });

    return res.json({
      success: true,
      data: parsedData,
    });

  } catch (err) {
    console.error("❌ Analysis Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
