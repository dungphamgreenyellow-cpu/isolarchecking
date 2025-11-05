import pdfjs from "pdfjs-dist/legacy/build/pdf.js";
import { readFileSync } from "fs";

const p = process.argv[2];
const buf = readFileSync(p);
const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
const pdf = await pdfjs.getDocument({ data }).promise;
const tokens = [];
for (let i=1;i<=pdf.numPages;i++){
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  tokens.push(...content.items.map(it=>({str:it.str,x:it.transform[4],y:it.transform[5]})));
}
const tol=1.5; const lines=[]; const sorted=tokens.slice().sort((a,b)=>a.y-b.y||a.x-b.x); for (const t of sorted){ let line=lines.find(ln=>Math.abs(ln.y-t.y)<=tol); if(!line){ line={y:t.y,tokens:[]}; lines.push(line);} line.tokens.push(t);} lines.forEach(ln=>ln.tokens.sort((a,b)=>a.x-b.x));
const textLines = lines.map(ln=>ln.tokens.map(t=>t.str).join("").replace(/\s+/g," ").trim());
const blob = textLines.join("\n");
const reModules1 = /Nb\.?\s*of\s*modules\s*([0-9][0-9.,]*)\s*units?/ig;
const reModules2 = /Number\s+of\s+PV\s+modules\s*([0-9][0-9.,]*)\s*units?/ig;
const rePnomTotalDC = /Pnom\s+total\s*([0-9][0-9.,]*)\s*kWp\b/ig;
const rePnomTotalAC = /Pnom\s+total\s*([0-9][0-9.,]*)\s*kWac\b/ig;
const rePnomRatio = /Pnom\s+ratio\s*([0-9]+(?:[.,]\d+)?)/ig;

function n(x){ x=String(x); if (x.includes(',') && !x.includes('.')) x=x.replace(',','.'); return parseFloat(x); }

console.log('Modules1:',[...blob.matchAll(reModules1)].map(m=>m[1]));
console.log('Modules2:',[...blob.matchAll(reModules2)].map(m=>m[1]));
console.log('PnomDC:',[...blob.matchAll(rePnomTotalDC)].map(m=>m[1]));
console.log('PnomAC:',[...blob.matchAll(rePnomTotalAC)].map(m=>m[1]));
console.log('Ratios:',[...blob.matchAll(rePnomRatio)].map(m=>m[1]));
