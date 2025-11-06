// Frontend utility now delegates parsing to backend CSV-only endpoint
// Output shape stays compatible with FileCheckModal expectations
import api from "./apiClient";

export async function checkFusionSolarPeriod(file) {
  const formData = new FormData();
  formData.append("logfile", file);
  const res = await api.post("/analysis/compute", formData);
  return res.data;
}
