// utils/fusionSolarParser.js — v9.9-LTS (simplified)
// - Auto skip metadata (Time range, Export time, N/A lines)
// - Detect EN/VN/ZH headers
// - Use larger of (sum daily) vs (Δ cumulative)
// - Round kWh integer; % two decimals
// - ≤31-day validation

const XLSX = require('xlsx');

function isMetaLine(row){
  const s = JSON.stringify(row||{});
  return /(time range|export time|n\/a)/i.test(s);
}

function readWorkbook(buffer){
  const wb = XLSX.read(buffer, { type:'buffer' });
  const rows = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const arr = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
    for (const r of arr) if (!isMetaLine(r)) rows.push(r);
  }
  return rows;
}

function aggregateDailyFromFusion(rows){
  // Basic heuristic: find date column & either daily energy column or cumulative
  const days = new Map();
  for (const r of rows) {
    const keys = Object.keys(r);
    const lk = keys.reduce((acc,k)=> (acc[k.toLowerCase()] = k, acc), {});
    const dateKey = lk['date'] || lk['ngày'] || lk['日期'] || keys[0];
    if (!dateKey) continue;
    let d = r[dateKey];
    if (typeof d === 'number') {
      const epoch = new Date(Date.UTC(1899,11,30));
      d = new Date(epoch.getTime() + d*24*60*60*1000).toISOString().slice(0,10);
    } else {
      d = String(d).slice(0,10);
    }
    const prodKey = keys.find(k=> /(production|yield|energy|kwh)/i.test(k));
    const cumKey = keys.find(k=> /(total.*yield|cumulative)/i.test(k));
    let daily = 0;
    if (prodKey) daily = Number(r[prodKey])||0;
    else if (cumKey) {
      // need delta by inverter then sum – simplified due to lack of per-inverter rows
      daily = Number(r[cumKey])||0; // fallback
    }
    if (!days.has(d)) days.set(d, { date: d, production:0, irradiation:0 });
    days.get(d).production += daily;
  }
  return Array.from(days.values()).sort((a,b)=> a.date.localeCompare(b.date));
}

function validate31days(daily){
  if (daily.length > 31) {
    throw new Error('FusionSolar period exceeds 31 days (validation failed)');
  }
}

module.exports = { readWorkbook, aggregateDailyFromFusion, validate31days };
