// src/api.js — central API client
const BASE = import.meta.env.VITE_API_BASE_URL;
console.log("[cloudApi] Backend URL:", BASE);
export async function uploadLog(file){
  const fd = new FormData(); fd.append('logFile', file);
  const r = await fetch(`${BASE}/api/upload-log`, { method:'POST', body: fd });
  return r.json();
}
export async function uploadIrr(id, file){
  const fd = new FormData(); fd.append('irrFile', file); fd.append('id', id);
  const r = await fetch(`${BASE}/api/upload-irr`, { method:'POST', body: fd });
  return r.json();
}
export async function computeRPR(payload){
  const r = await fetch(`${BASE}/api/compute-rpr`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  return r.json();
}
export async function getDaily(id){
  const r = await fetch(`${BASE}/api/daily?id=${encodeURIComponent(id)}`);
  return r.json();
}
export async function getEnergyFlow(id, ta=0, ga=0, clipping=0){
  const params = new URLSearchParams({ id, ta, ga, clipping }).toString();
  const r = await fetch(`${BASE}/api/energy-flow?${params}`);
  return r.json();
}
export async function getSummary(id){
  const r = await fetch(`${BASE}/api/analysis-summary?id=${encodeURIComponent(id)}`);
  return r.json();
}
export async function parseFusion(file){
  const fd = new FormData();
  fd.append('file', file);

  const r = await fetch(`${BASE}/api/parse-fusion`, {
    method: 'POST',
    body: fd
  });

  // Nếu backend trả về HTML → báo lỗi rõ ràng
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("❌ Cloud parse error, raw response:", text);
    throw new Error("Cloud Parse failed: Backend did not return JSON");
  }
}
