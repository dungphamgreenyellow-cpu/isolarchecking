// Frontend helper to parse PVSyst PDF via backend and normalize fields
// New schema aligned with LOOP_PVSYST_FIX parser output

import { getBackendBaseUrl } from "../config";
import debug from "debug";
const log = debug("parsePDFGlobal");

export async function parsePDFGlobal(file) {
	log("Preparing to send file to backend for parsing");
	const backendURL = getBackendBaseUrl();

	const fd = new FormData();
	fd.append("pvsystFile", file);

	try {
		const res = await fetch(`${backendURL}/analysis/parse-pvsyst`, {
			method: "POST",
			body: fd,
		});
		log("Received response from backend");

		const json = await res.json().catch(() => null);
		log("Parsed JSON response:", json);

		if (!json?.success) {
			log("Parsing failed or backend returned an error:", json);
			return null;
		}

		const d = json.data || {};
		log("Raw parsed PVSyst data:", d);

		const normalized = {
			reportDate: d.reportDate || null,
			gps: d.gps || null,
			systemInfo: d.systemInfo || {},
			pvArray: d.pvArray || {},
			expected: d.expected || {},
			arrayLosses: d.arrayLosses || {},
			monthly: d.monthly || null,
			_raw: d,
		};

		log("Final normalized output:", normalized);

		return {
			success: true,
			...d,
			normalized,
		};
	} catch (e) {
		log("Error during parsing or backend communication:", e);
		return null;
	}
}
