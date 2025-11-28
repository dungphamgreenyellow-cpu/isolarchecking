// Deprecated: local FE parser removed. Provide a helper to build default values for Confirm Modal.
export async function checkFusionSolarPeriod() {
  throw new Error("Removed: use utils/fusionSolarParser.checkFusionSolarPeriod (backend CSV)");
}

export function getDefaultValues({ logData = {}, pvsyst = {} } = {}) {
  const defaultValues = {
    siteName: logData?.siteName || "",
    installed: pvsyst?.systemInfo?.systemPowerDC_kWp || "",
    cod: pvsyst?.reportDate || pvsyst?.cod_date || "",
    gamma: 0.34,
    degradation: 0.5,
  };
  return defaultValues;
}
