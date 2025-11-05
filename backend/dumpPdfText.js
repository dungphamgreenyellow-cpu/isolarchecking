import pdfjs from "pdfjs-dist/legacy/build/pdf.js";
import { readFileSync } from "fs";

async function main() {
  const p = process.argv[2];
  if (!p) {
    console.error("usage: node backend/dumpPdfText.js <pdfpath>");
    process.exit(1);
  }
  const buf = readFileSync(p);
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const pdf = await pdfjs.getDocument({ data }).promise;
  const tokens = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    tokens.push(...content.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], page: i })));
  }
  // group by Y similar to parser
  const tol = 1.5;
  const lines = [];
  const sorted = tokens.slice().sort((a,b)=> a.y - b.y || a.x - b.x);
  for (const t of sorted) {
    let line = lines.find(ln => Math.abs(ln.y - t.y) <= tol);
    if (!line) { line = { y: t.y, tokens: [] }; lines.push(line); }
    line.tokens.push(t);
  }
  lines.forEach(ln => ln.tokens.sort((a,b)=> a.x - b.x));
  const textLines = lines.map(ln => ln.tokens.map(t => t.str).join("").replace(/\s+/g, " ").trim());
  textLines.forEach((l,i)=>{
    if (l) console.log(String(i).padStart(4,'0')+": "+l);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
