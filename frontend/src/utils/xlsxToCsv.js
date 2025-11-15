// Convert an XLSX/XLS File to a CSV Blob (first sheet)
// Uses SheetJS (xlsx). Ensure dependency is installed in frontend package.json.

import * as XLSX from "xlsx";

export async function xlsxFileToCsvBlob(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) throw new Error("Workbook has no sheets");
  const ws = wb.Sheets[firstSheet];
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ",", RS: "\n" });
  return new Blob([csv], { type: "text/csv" });
}
