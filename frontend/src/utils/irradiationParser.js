import * as XLSX from "xlsx";

/**
 * Parse Excel/CSV irradiation file.
 * Expected headers: Date | Irradiation (kWh/m²)
 */
export async function parseIrradiationFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const daily = json
    .filter((row) => row.Date && row.Irradiation)
    .map((row) => ({
      date: new Date(row.Date),
      irradiation: parseFloat(row.Irradiation),
    }));

  const totalIrradiation = daily.reduce((sum, d) => sum + d.irradiation, 0);
  return { daily, totalIrradiation };
}
