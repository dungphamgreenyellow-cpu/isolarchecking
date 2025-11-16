import { xmlToCsv } from "../compute/xmlToCsv.js";
import { streamParseAndCompute } from "../compute/fusionSolarParser.js";

async function main() {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<rows>
  <row>
    <StartTime>2024-01-01 06:00</StartTime>
    <ManageObject>INV-A/MP1</ManageObject>
    <TotalYield>100.0</TotalYield>
  </row>
  <row>
    <StartTime>2024-01-01 18:00</StartTime>
    <ManageObject>INV-A/MP1</ManageObject>
    <TotalYield>150.0</TotalYield>
  </row>
</rows>`;

  const buffer = Buffer.from(sampleXml, "utf8");
  const csv = xmlToCsv(buffer);
  console.log("=== CSV OUTPUT ===\n" + csv + "\n");

  const csvBuffer = Buffer.from(csv + "\n2024-01-01 06:00,INV-A,100.0\n2024-01-01 18:00,INV-A,150.0\n", "utf8");
  const result = await streamParseAndCompute(csvBuffer);
  console.log("=== DAILY PRODUCTION ===");
  console.log(result.dailyProduction);
  console.log("Total:", result.dailyProductionTotal);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
