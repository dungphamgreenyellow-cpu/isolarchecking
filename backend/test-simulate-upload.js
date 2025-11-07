import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

(async () => {
  try {
    const form = new FormData();
    // Adjusted to existing sample file in repo
    const filePath = "./backend/test-data/Fujiseal_Jun25.xlsx";
    if (!fs.existsSync(filePath)) {
      console.error("Sample file not found:", filePath);
      process.exit(1);
    }
    form.append("logfile", fs.createReadStream(filePath));
    const res = await fetch("http://localhost:8080/analysis/compute", { method: "POST", body: form });
    const data = await res.json();
    console.log("[Test Upload Response]", data);
  } catch (err) {
    console.error("[Test Upload Error]", err);
    process.exit(1);
  }
})();
