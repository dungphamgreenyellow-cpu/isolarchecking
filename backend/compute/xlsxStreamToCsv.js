import * as XLSX from "xlsx";

export function xlsxStreamToCsv(buffer) {
	const workbook = XLSX.read(buffer, {
		type: "buffer",
		cellDates: false,
		cellNF: false,
		cellText: false
	});

	const sheet = workbook.Sheets[workbook.SheetNames[0]];
	const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ",", RS: "\n" });
	return csv;
}
