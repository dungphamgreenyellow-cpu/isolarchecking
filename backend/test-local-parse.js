import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

async function test() {
  const csv = fs.createReadStream("./test-data/test_FusionSolar.csv");
  const xlsx = fs.createReadStream("./test-data/test_FusionSolar.xlsx");

  console.log("=== TEST CSV ===");
  let fd1 = new FormData();
  fd1.append("logfile", csv);
  let r1 = await fetch("http://localhost:8080/analysis/compute", {
    method: "POST",
    body: fd1
  });
  console.log(await r1.json());

  console.log("=== TEST XLSX ===");
  let fd2 = new FormData();
  fd2.append("logfile", xlsx);
  let r2 = await fetch("http://localhost:8080/analysis/compute", {
    method: "POST",
    body: fd2
  });
  console.log(await r2.json());
}

test();
