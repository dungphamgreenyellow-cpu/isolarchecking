import { xmlToCsv } from "../compute/xmlToCsv.js";
import { streamParseAndCompute } from "../compute/fusionSolarParser.js";

async function main() {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <rows>
    <row>
      <StartTime>2025-01-01T00:00:00Z</StartTime>
      <ManageObject>INV-1</ManageObject>
      <TotalYield>100</TotalYield>
    </row>
    <row>
      <StartTime>2025-01-01T23:55:00Z</StartTime>
      <ManageObject>INV-1</ManageObject>
      <TotalYield>150</TotalYield>
    </row>
  </rows>
</root>`;

  const buffer = Buffer.from(sampleXml, "utf8");
  const csv = xmlToCsv(buffer);
  console.log("=== CSV OUTPUT ===\n", csv);

  const csvBuffer = Buffer.from(csv, "utf8");
  const result = await streamParseAndCompute(csvBuffer);
  console.log("\n=== PARSE RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
