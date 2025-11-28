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

function normalizeInverter(raw) {
	if (!raw) return null;
	const base = String(raw).split("/")[0].trim();
	const cleaned = base.replace(/inv-?/i, "").trim().toUpperCase();
	return cleaned ? `INV-${cleaned}` : null;
}

export function parseFusionSolarCsv(filePath) {
	return new Promise((resolve, reject) => {
		const invDayMap = {};
		let parsedRecordsCount = 0;
		let siteName = null;
		let headers = null;
		let headerRowIndex = 0;

		const parser = parse({
			bom: false,
			relax_column_count: true,
			trim: true,
		});

		parser.on("readable", () => {
			let record;
			while ((record = parser.read()) !== null) {
				if (!headers) {
					headers = record.map((v) => (v ? String(v).trim() : ""));
					headerRowIndex += 1;
					continue;
				}

				const row = {};
				record.forEach((v, idx) => {
					const key = headers[idx] || `col_${idx}`;
					row[key] = v;
				});

				const keys = Object.keys(row);
				let startKey = null;
				let yieldKey = null;
				let invKey = null;
				let siteKey = null;

				if (headers && headers.length) {
					headers.forEach((k) => {
						const l = k.toLowerCase();
						if (!startKey && l.includes("start") && l.includes("time")) startKey = k;
						if (!yieldKey && l.includes("total") && l.includes("yield")) yieldKey = k;
						if (!invKey && (l.includes("manageobject") || l.includes("inverter") || l.includes("device name"))) invKey = k;
						if (!siteKey && (l.includes("site name") || l.includes("plant name"))) siteKey = k;
					});
				}

				if (!startKey || !yieldKey || !invKey) {
					continue;
				}

				const rawT = row[startKey];
				const rawE = row[yieldKey];
				const rawInv = row[invKey];
				if (!rawT || !rawE || !rawInv) continue;

				if (!siteName && siteKey && row[siteKey]) siteName = String(row[siteKey]).trim();

				const day = normalizeDate(rawT);
				if (!day) continue;

				const inv = normalizeInverter(rawInv);
				if (!inv) continue;

				const num = Number(String(rawE).replace(/[\,\s]/g, ""));
				if (!Number.isFinite(num)) continue;

				if (!invDayMap[day]) invDayMap[day] = {};
				if (!invDayMap[day][inv]) {
					invDayMap[day][inv] = { min: num, max: num };
				} else {
					invDayMap[day][inv].min = Math.min(invDayMap[day][inv].min, num);
					invDayMap[day][inv].max = Math.max(invDayMap[day][inv].max, num);
				}
				parsedRecordsCount += 1;
			}
		});

		parser.on("error", (err) => {
			reject(err);
		});

		parser.on("end", () => {
			const daily = {};
			for (const d of Object.keys(invDayMap)) {
				let sum = 0;
				for (const inv of Object.keys(invDayMap[d])) {
					const { min, max } = invDayMap[d][inv];
					const gain = Math.max(0, max - min);
					sum += gain;
				}
				daily[d] = sum;
			}
			const days = Object.keys(daily).sort();
			resolve({
				success: true,
				source: "csv",
				siteName,
				dailyProduction: daily,
				dailyProductionTotal: days.reduce((a, d) => a + daily[d], 0),
				firstDay: days[0] || null,
				lastDay: days[days.length - 1] || null,
				parsedRecordsCount,
			});
		});

		fs.createReadStream(filePath).pipe(parser);
	});
}
