import parsePVSystPDF from "../compute/parsePVSyst.js";
import fs from "fs";

const path = process.argv[2];
if (!path) {
  console.log("Usage: node backend/scripts/testPVSyst.js <pdf-path>");
  process.exit(1);
}

const buf = fs.readFileSync(path);
parsePVSystPDF(buf).then((out) => {
  console.log("PVSYST OUTPUT:", JSON.stringify(out, null, 2));
});