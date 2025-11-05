// === src/utils/apiClient.js — Cloud Compute v2.1 Stable ===
// ✅ Axios instance cho frontend iSolarChecking
// ✅ Tự lấy baseURL từ .env (VITE_BACKEND_URL)
// ✅ Thêm timeout & withCredentials để tránh lỗi CORS khi deploy

import axios from "axios";

const baseURL = import.meta.env.VITE_BACKEND_URL;

const api = axios.create({
  baseURL,
  timeout: 30000, // 30s
  withCredentials: false,
});

export default api;
