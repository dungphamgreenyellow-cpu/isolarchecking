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
				// Ignore openpyxl warnings in stderr
				if (stderr && stderr.trim()) {
					const cleaned = stderr
						.split("\n")
						.filter(line => !line.includes("UserWarning"))
						.join("\n")
						.trim();

					if (cleaned.length > 0) {
						return reject(new Error(cleaned));
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
