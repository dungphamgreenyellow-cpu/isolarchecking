import express from "express";
const router = express.Router();

// GET /api/health — ping
router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "analysis", ts: Date.now() });
});

// (Nếu có endpoint phân tích khác, giữ nguyên route path FE đang gọi rồi bổ sung ở đây)

export default router;
