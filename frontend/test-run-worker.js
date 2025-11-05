import fs from "fs";
import path from "path";
import WorkerUrl from "./src/workers/fsXlsxWorker?worker";

async function run() {
  const filePath = path.resolve("./test-data/test_FusionSolar.xlsx");
  const buf = fs.readFileSync(filePath);
  const worker = new WorkerUrl();
  worker.onmessage = (e) => {
    console.log("✅ Worker parse result:");
    console.log("records length:", e.data.records?.length);
    console.log("columns:", e.data.columns?.slice(0, 8), "...");
    worker.terminate();
  };
  worker.postMessage(buf);
}
run();
