import ExcelJS from "exceljs";

// Streaming XLSX parser — read sheet 1 row by row
// Returns array of plain objects: { header1: value1, header2: value2, ... }

export async function parseXlsxStream(buffer) {
  const wb = new ExcelJS.Workbook();
  const rows = [];

  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  let headers = [];

  ws.eachRow((row, rowIndex) => {
    const values = row.values;
    if (rowIndex === 1) {
      headers = values.map((x) => (x ? String(x).trim() : ""));
      return;
    }
    const obj = {};
    values.forEach((cell, i) => {
      const key = headers[i] || `col_${i}`;
      obj[key] = cell ?? "";
    });
    rows.push(obj);
  });

  return rows;
}
