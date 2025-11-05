import { readFileSync } from "fs";
import * as url from "url";
import path from "path";

const parserPath = path.resolve("backend/compute/fusionSolarParser.js");
const moduleUrl = url.pathToFileURL(parserPath).href;

const { checkFusionSolarPeriod } = await import(moduleUrl);
const file = { data: readFileSync("backend/test-data/test_FusionSolar.xlsx") };

const t = Date.now();
try {
	await checkFusionSolarPeriod(file);
} catch (e) {
	// swallow errors to only report timing
}
console.log("⏱", Date.now() - t, "ms");
