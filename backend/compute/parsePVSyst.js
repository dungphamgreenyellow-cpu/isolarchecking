import pkg from "pdf-parse";
const pdf = pkg;

export async function parsePVSystPDF(file) {
  const buffer = file.data;
  const data = await pdf(buffer);
  const text = data.text.replace(/\s+/g, " ");

  // Extract info
  const gpsMatch = text.match(/(-?\d{1,3}\.\d{2,})[°,]?\s*(\d{1,3}\.\d{2,})/);
  const module = text.match(/\b(JAM|LR|TSM|JKM|CS)[0-9A-Za-z\-\/]+\b/)?.[0] || "";
  const inverter = text.match(/\b(SUN2000|SG|STP|PVS)\-[A-Za-z0-9\-]+/)?.[0] || "";
  const cod = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/)?.[0] || "";

  return {
    gps: gpsMatch ? `${gpsMatch[1]}, ${gpsMatch[2]}` : "",
    module,
    inverter,
    cod,
  };
}
