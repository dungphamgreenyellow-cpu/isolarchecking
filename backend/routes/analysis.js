// backend/routes/analysis.js
import express from "express";
import { checkFusionSolarPeriod } from "../compute/fusionSolarParser.js";

const router = express.Router();

// POST /analysis/compute
router.post("/compute", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.files.file; // uploaded file
    const buffer = file.data;    // file buffer

  const result = await checkFusionSolarPeriod({ name: file.name, data: buffer });

    return res.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error("[analysis-error]", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
