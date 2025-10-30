import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 120000,
});

console.log("🌐 [cloudApi] Backend URL:", import.meta.env.VITE_API_BASE_URL);

export async function analyzeOnCloud({ logFile, irrFile, pvsystFile, extras = {} }) {
  if (!logFile) throw new Error("Missing required logFile");

  const fd = new FormData();
  fd.append("file", logFile);
  if (irrFile) fd.append("irrFile", irrFile);
  if (pvsystFile) fd.append("pvsystFile", pvsystFile);
  Object.entries(extras).forEach(([k, v]) => fd.append(k, String(v)));

  const res = await api.post("/api/parse-fusion", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  console.log("✅ [cloudApi] Cloud compute OK:", res.data);
  return res.data;
}
