import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { streamParseAndCompute } from '../compute/fusionSolarParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    const filePath = path.join(__dirname, '..', 'test-data', 'Fujiseal_Jun25.xlsx');
    const buf = await readFile(filePath);
    const t0 = Date.now();
    const result = await streamParseAndCompute(buf);
    const dt = Date.now() - t0;
    console.log('success:', result.success);
    if (!result.success) {
      console.log('note:', result.note);
      process.exit(1);
    }
    console.log('firstDay:', result.firstDay);
    console.log('lastDay:', result.lastDay);
    console.log('parsedRecordsCount:', result.parsedRecordsCount);
    console.log('dailyProductionTotal:', result.dailyProductionTotal.toFixed(2));
    const days = Object.keys(result.dailyProduction || {}).sort();
    console.log('days:', days.length);
    // Print a small sample
    for (const d of days.slice(0, 3)) {
      console.log(`${d}: ${result.dailyProduction[d].toFixed(2)} kWh`);
    }
    console.log(`Parse time: ${dt} ms`);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
