// Simple script to simulate ProjectConfirmModal auto-fill mapping
import fs from 'fs';
import fetch from 'node-fetch';
import { getBackendBaseUrl } from "../src/config";

const BACKEND = getBackendBaseUrl();

function mapToModal(initialData, prevForm = {}) {
  const dc = initialData?.capacityDCkWp ?? initialData?.capacity_dc_kwp ?? initialData?.capacities?.dc_kWp ?? prevForm.capacityDCkWp;
  const ac = initialData?.capacityACkWac ?? initialData?.capacity_ac_kw ?? initialData?.capacities?.ac_kW ?? prevForm.capacityACkWac;
  return {
    siteName: initialData?.siteName || prevForm.siteName || '',
    installed: initialData?.installed || (dc != null ? `${dc} kWp` : prevForm.installed || ''),
    location: initialData?.gps ? `${initialData.gps.lat},${initialData.gps.lon}` : (initialData?.location || prevForm.location || ''),
    cod: initialData?.cod || prevForm.cod || '',
    capacityDCkWp: dc != null ? String(dc) : prevForm.capacityDCkWp || '',
    capacityACkWac: ac != null ? String(ac) : prevForm.capacityACkWac || '',
    pvModuleModel: initialData?.pvModuleModel || initialData?.module_model || initialData?.moduleModel || initialData?.moduleModel || prevForm.pvModuleModel || '',
    inverterModel: initialData?.inverterModel || initialData?.inverter_model || initialData?.inverterModel || prevForm.inverterModel || '',
    soilingPercent: initialData?.soilingPercent != null ? String(initialData.soilingPercent) : (initialData?.soiling_loss_percent != null ? String(initialData.soiling_loss_percent) : prevForm.soilingPercent || ''),
    tempCoeff: prevForm.tempCoeff || '0.34',
    degr: prevForm.degr || '0.5',
  };
}

async function main() {
  // Parse PVSyst test PDF
  const pdfRes = await fetch(`${BACKEND}/analysis/parse-pvsyst-test`);
  const pdfJson = await pdfRes.json();
  if (!pdfJson.success) throw new Error('parse-pvsyst-test failed');
  const pdfData = pdfJson.data || {};

  // Simulate merged projectData (here only PVSyst output)
  const projectData = { ...pdfData };

  const mapped = mapToModal(projectData, {});

  console.log('\n=== Raw PVSyst Data (truncated) ===');
  console.log({ siteName: projectData.siteName, capacities: projectData.capacities, moduleModel: projectData.moduleModel, inverterModel: projectData.inverterModel, gps: projectData.gps });

  console.log('\n=== Mapped Modal Form ===');
  console.log(mapped);

  // Basic assertions
  const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT FAIL: ' + msg); };
  assert(mapped.siteName && mapped.siteName.includes('Fuji'), 'Site name not mapped');
  assert(mapped.capacityDCkWp === String(projectData.capacities.dc_kWp), 'DC capacity mismatch');
  assert(mapped.capacityACkWac === String(projectData.capacities.ac_kW), 'AC capacity mismatch');
  assert(mapped.pvModuleModel && mapped.pvModuleModel.includes('JA Solar'), 'Module model missing');
  assert(mapped.inverterModel && mapped.inverterModel.includes('Huawei'), 'Inverter model missing');
  assert(mapped.installed.startsWith(String(projectData.capacities.dc_kWp)), 'Installed capacity default not set from DC');

  console.log('\n✅ All mapping assertions passed. Modal sẽ hiển thị đầy đủ các trường chính.');
}

main().catch(e => { console.error(e); process.exit(1); });
