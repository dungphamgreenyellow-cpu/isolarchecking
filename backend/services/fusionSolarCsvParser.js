import fs from "fs";
import { parse } from "csv-parse";

function normalizeDate(value) {
	if (!value) return null;
	const dt = new Date(value);
	if (Number.isNaN(dt.getTime())) return null;
	const y = dt.getFullYear();
	const m = String(dt.getMonth() + 1).padStart(2, "0");
	const d = String(dt.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}
import fs from "fs";
import { streamParseAndCompute } from "../compute/fusionSolarParser.js";

export async function parseFusionSolarCsv(filePath, onProgress) {
	if (onProgress) onProgress(40);
	const buffer = await fs.promises.readFile(filePath);
	const result = await streamParseAndCompute(buffer);
	if (onProgress) onProgress(100);
	return result;
}
	return new Promise((resolve, reject) => {
