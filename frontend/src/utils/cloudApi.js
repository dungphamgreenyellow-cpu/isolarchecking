console.log("🌐 [cloudApi] Backend URL:", import.meta.env.VITE_API_BASE_URL);

export async function analyzeOnCloud({ logFile, irrFile, pvsystFile, extras = {} }) {
  if (!logFile) throw new Error("Missing required logFile");

  const fd = new FormData();
  fd.append("file", logFile);
  if (irrFile) fd.append("irrFile", irrFile);
  if (pvsystFile) fd.append("pvsystFile", pvsystFile);
  Object.entries(extras).forEach(([k, v]) => fd.append(k, String(v)));

  const url = `${import.meta.env.VITE_API_BASE_URL}/api/parse-fusion`;

  const response = await fetch(url, {
    method: "POST",
    body: fd,
    // no explicit headers so browser sets multipart boundary
  });

  if (!response.ok) {
    throw new Error(`Backend returned non-OK status ${response.status}`);
  }

  const text = await response.text();
  if (!text) throw new Error("Empty response from backend");
  const t = text.trim();
  if (t.startsWith("<") || t.toUpperCase().includes("HTML")) {
    console.error("Invalid HTML response from backend:", t.slice(0, 400));
    throw new Error("Backend trả HTML thay vì JSON. Kiểm tra log backend.");
  }

  let data;
  try {
    data = JSON.parse(t);
  } catch (err) {
    console.error("Failed to parse JSON from backend:", t.slice(0, 400));
    throw new Error("Backend trả dữ liệu không hợp lệ (không phải JSON)");
  }

  console.log("✅ [cloudApi] Cloud compute OK:", data);
  return data;
}
