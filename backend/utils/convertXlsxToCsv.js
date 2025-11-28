import { execFile } from "child_process";
import path from "path";

export function convertXlsxToCsv(inputPath, outputPath) {
	return new Promise((resolve, reject) => {
		const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "xlsx_to_csv.py");

		const child = execFile(
			"python",
			[scriptPath, inputPath, outputPath],
			{ cwd: path.join(path.dirname(new URL(import.meta.url).pathname), "..") },
			(err, stdout, stderr) => {
				if (err) {
					return reject(new Error(stderr || err.message));
				}
				// Ignore openpyxl warnings
				if (stderr && stderr.trim()) {
					if (!stderr.includes("UserWarning")) {
						return reject(new Error(stderr.trim()));
					}
				}
				if (!stdout.toString().trim().startsWith("OK")) {
					return reject(new Error(`Unexpected converter output: ${stdout.toString()}`));
				}
				return resolve(outputPath);
			}
		);

		child.on("error", (procErr) => {
			reject(procErr);
		});
	});
}
