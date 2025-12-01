import fs from "fs";
import { streamParseAndCompute } from "../compute/fusionSolarParser.js";

export async function parseFusionSolarCsv(filePath, onProgress) {
	if (onProgress) onProgress(40);
	const buffer = await fs.promises.readFile(filePath);
	const result = await streamParseAndCompute(buffer);
	if (onProgress) onProgress(100);
	return result;
}
