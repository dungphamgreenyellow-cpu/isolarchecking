// backend/scripts/runLocalTest.js
// Run local test using backend/test-data files and print what Confirm Modal would see
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const parsePVSystPdf = require("../compute/parsePVSyst");
import { streamParseAndCompute } from "../compute/fusionSolarParser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const root = path.join(__dirname, "..", "test-data");
  const logPath = path.join(root, "test_FusionSolar.xlsx");
  const pdfPath = path.join(root, "test_PVSyst.pdf");

  if (!fs.existsSync(logPath)) {
    console.error("❌ Missing:", logPath);
    process.exit(1);
  }
  if (!fs.existsSync(pdfPath)) {
    console.error("❌ Missing:", pdfPath);
    process.exit(1);
  }

  // 1) Parse FusionSolar log (for compute bundle)
  const logBuf = await fs.promises.readFile(logPath);
  const computeData = await streamParseAndCompute(logBuf);

  // 2) Parse PVSyst PDF
  const pvsystInfo = await parsePVSystPdf(pdfPath);

  // 3) Normalize like parsePDFGlobal does (synonyms)
  const d = pvsystInfo || {};
  const lat = d?.gps?.lat ?? d?.latitude ?? null;
  const lon = d?.gps?.lon ?? d?.longitude ?? null;
  const capacityDC = d?.capacities?.dc_kWp ?? d?.capacity_dc_kwp ?? null;
  const capacityAC = d?.capacities?.ac_kW ?? d?.capacity_ac_kw ?? null;
  const moduleModel = d.moduleModel ?? d.module_model ?? null;
  const inverterModel = d.inverterModel ?? d.inverter_model ?? null;
  const normalized = {
    siteName: d.siteName || d.site_name || d.project_name || null,
    gps: lat != null && lon != null ? { lat, lon } : null,
    capacity_dc_kwp: capacityDC,
    capacity_ac_kw: capacityAC,
    capacityDCkWp: capacityDC,
    capacityACkWac: capacityAC,
    module_model: moduleModel,
    inverter_model: inverterModel,
    pvModuleModel: moduleModel,
    inverterModel: inverterModel,
    soiling_loss_percent: d.soiling_loss_percent ?? null,
    soilingPercent: d.soiling_loss_percent ?? null,
  };

  // 4) Simulate ProjectConfirmModal's mapping effect
  const f = {}; // initial empty form
  const dc = normalized?.capacityDCkWp ?? normalized?.capacity_dc_kwp ?? f.capacityDCkWp;
  const ac = normalized?.capacityACkWac ?? normalized?.capacity_ac_kw ?? f.capacityACkWac;
  const modalForm = {
    siteName: normalized?.siteName || f.siteName || "",
    installed: normalized?.installed || (dc != null ? `${dc} kWp` : f.installed || ""),
    location: normalized?.gps ? `${normalized.gps.lat},${normalized.gps.lon}` : (normalized?.location || f.location || ""),
    cod: normalized?.cod || f.cod || "",
    capacityDCkWp: dc != null ? String(dc) : f.capacityDCkWp || "",
    capacityACkWac: ac != null ? String(ac) : f.capacityACkWac || "",
    pvModuleModel: normalized?.pvModuleModel || normalized?.module_model || normalized?.moduleModel || f.pvModuleModel || "",
    inverterModel: normalized?.inverterModel || normalized?.inverter_model || normalized?.inverterModel || f.inverterModel || "",
    soilingPercent: normalized?.soilingPercent != null ? String(normalized.soilingPercent) : (normalized?.soiling_loss_percent != null ? String(normalized.soiling_loss_percent) : f.soilingPercent || ""),
    tempCoeff: f.tempCoeff || "0.34",
    degr: f.degr || "0.5",
  };

  console.log("=== BACKEND TEST RESULT ===");
  console.log("FusionSolar parsed keys:", Object.keys(computeData || {}));
  console.log("PVSyst normalized:", {
    siteName: modalForm.siteName,
    gps: normalized.gps,
    capacityDCkWp: modalForm.capacityDCkWp,
    capacityACkWac: modalForm.capacityACkWac,
    pvModuleModel: modalForm.pvModuleModel,
    inverterModel: modalForm.inverterModel,
    soilingPercent: modalForm.soilingPercent,
  });

  // Quick success criteria
  const ok = !!(modalForm.siteName && (modalForm.capacityDCkWp || modalForm.capacityACkWac));
  console.log("Modal fill success criteria:", ok ? "PASS" : "FAIL");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
