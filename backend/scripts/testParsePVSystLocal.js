import parsePVSystPDF from "../compute/parsePVSyst.js";
import fs from "fs";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node backend/scripts/testParsePVSystLocal.js \"C:\\path\\to\\your.pdf\"");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

(async () => {
  try {
    const result = await parsePVSystPDF(filePath);
    console.log("Parsed Result:", JSON.stringify(result, null, 2));

    console.log("\nKey Fields:");
    console.log("Report Date:", result.reportDate);
    console.log("System Power DC (kWp):", result.systemInfo?.systemPowerDC_kWp);
    console.log("System Power AC (kW):", result.systemInfo?.systemPowerAC_kW);
    console.log("Produced Energy (MWh):", result.expected?.producedEnergy_MWh);
    console.log("Specific Production (kWh/kWp):", result.expected?.specificProduction_kWh_kWp);
    console.log("PR (%):", result.expected?.pr_percent);
    console.log("Module Model:", result.pvArray?.moduleModel);
    console.log("Inverter Model:", result.pvArray?.inverterModel);
    console.log("Soiling Loss (%):", result.soilingLoss_percent);
  } catch (err) {
    console.error("Error during parsing:", err);
  }
})();