import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

async function run() {
  const filePath = path.resolve("./test-data/test_FusionSolar.xlsx");
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  if (!rows || rows.length < 4) {
    console.error("XLSX has fewer than 4 rows; cannot find header at row 4.");
    process.exit(1);
  }
  const header = rows[3].map(h => (typeof h === "string" ? h.trim() : h));
  const dataRows = rows.slice(4);
  const records = [];
  const colCount = header.length;
  for (const r of dataRows) {
    if (!r || r.length === 0) continue;
    const obj = {};
    for (let i = 0; i < colCount; i++) {
      const key = header[i] ?? `__col_${i}`;
      obj[key] = (r[i] === undefined) ? null : r[i];
    }
    records.push(obj);
  }
  console.log("✅ Alt parse (Node) result:");
  console.log("records length:", records.length);
  console.log("columns:", header.slice(0, 8), "...");
}
run();
