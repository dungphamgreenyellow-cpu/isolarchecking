// utils/realPRCalculator.js — v9.4 Debug Edition
// Canonical baseline for RPR computation using 5‑minute data (P5)
// Features:
// - Compute Real PR based on 5‑minute interpolated irradiance (P5)
// - Filter inverter records by “Grid Connected” status across all inverters
// - Use uploaded irradiance file if available (priority: GHI > GTI > others)
// - Normalize from 5‑minute to hourly average by dividing slots by 12 (÷12)
// - Convert irradiance from W/m² to kWh/m² when necessary
// - Detailed debug logs for Eac, Eirr, capacity, slot counts

const DEBUG = true;

function asNumber(x, def=0){
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function isWm2Header(h){
  return /W\/?m\^?2|Wm2|W\/m2/i.test(h||"");
}

function isIrrHeader(h){
  return /(irr|ghi|gti)/i.test(h||"");
}

function normalizeIrrSlot(val, header){
  const n = asNumber(val, 0);
  // If header suggests W/m², convert 5-min W/m² → kWh/m² for that slot:
  // W/m² * (5/60) h = kWh/m² * 1000? No conversion 1000 here because W to kW divide 1000:
  // kWh/m² = (W/m² / 1000) * (minutes/60). With minutes=5 → * (5/60).
  if (isWm2Header(header)) {
    return (n / 1000) * (5/60);
  }
  // If already kWh/m² for the slot or daily accumulation provided, assume it's already in kWh/m²
  return n;
}

// Merge uploaded irradiance (priority GHI > GTI > others)
function pickIrrColumns(headers){
  const lower = headers.map(h=> (h||"").toString().toLowerCase());
  let ghi = lower.findIndex(h=> h.includes('ghi'));
  let gti = lower.findIndex(h=> h.includes('gti'));
  let irr = lower.findIndex(h=> /(irradiance|irr)/.test(h));
  if (ghi !== -1) return { idx: ghi, hdr: headers[ghi] };
  if (gti !== -1) return { idx: gti, hdr: headers[gti] };
  if (irr !== -1) return { idx: irr, hdr: headers[irr] };
  return { idx: -1, hdr: null };
}

// Compute Real PR from 5‑minute slots
// input:
//  - slots: array of records, each record may have fields like:
//    { ts: 'YYYY-MM-DD HH:mm', Eac_kWh, InverterStatus, capacity_kWp, ... }
//  - irrSlots: optional array aligned or keyed by ts/date providing irradiance values
// returns: { RPR, totals, debug }
function computeRealPRP5({ slots=[], irrSlots=[], headersIrr=[], useUploadedIrr=true }){
  let Eac = 0;
  let Eirr = 0;
  let capacity_kWp = 0;
  let goodSlots = 0;

  // Choose irradiance column if provided
  let irrPick = { idx: -1, hdr: null };
  if (useUploadedIrr && headersIrr && headersIrr.length){
    irrPick = pickIrrColumns(headersIrr);
  }

  // Index irradiance by timestamp if provided as array of { ts, value }
  const irrByTs = new Map();
  for (const r of irrSlots||[]) {
    const ts = (r.ts || r.time || r.date || r.datetime || '').toString();
    // try choose from preferred columns or generic 'value'
    let v = 0;
    if (irrPick.idx >= 0 && Array.isArray(r._row)) {
      v = normalizeIrrSlot(r._row[irrPick.idx], irrPick.hdr);
    } else {
      const keys = Object.keys(r);
      // try common keys
      const k = keys.find(k=> /(ghi|gti|irr)/i.test(k));
      v = normalizeIrrSlot(r[k], k);
    }
    irrByTs.set(ts, asNumber(v, 0));
  }

  for (const rec of slots) {
    const status = (rec.InverterStatus || rec.status || '').toString().toLowerCase();
    const gridConnected = !status || /grid\s*connected|normal|running/i.test(status);
    if (!gridConnected) continue;

    const eac = asNumber(rec.Eac_kWh ?? rec.eac ?? rec.energy ?? rec.production, 0);
    const ts = (rec.ts || rec.time || rec.datetime || '').toString();
    const cap = asNumber(rec.capacity_kWp ?? rec.capacity ?? rec.kWp, 0);
    // Prefer per-slot irradiance
    let irr = 0;
    if (irrByTs.has(ts)) irr = irrByTs.get(ts);
    else if (rec.irr != null) irr = normalizeIrrSlot(rec.irr, 'irr');
    else if (rec.GHI != null) irr = normalizeIrrSlot(rec.GHI, 'GHI');
    else if (rec.GTI != null) irr = normalizeIrrSlot(rec.GTI, 'GTI');

    Eac += eac;
    Eirr += asNumber(irr, 0);
    capacity_kWp = Math.max(capacity_kWp, cap);
    goodSlots++;
  }

  // Normalize slot count from 5‑minute to hourly average by ÷12
  const hourlySlots = goodSlots / 12;

  const RPR = Eirr > 0 ? (Eac / Eirr) : 0;

  const debug = {
    slots: slots.length,
    goodSlots,
    hourlySlots,
    Eac_kWh: Eac,
    Eirr_kWhm2: Eirr,
    capacity_kWp,
    useUploadedIrr,
    irrPick,
  };

  if (DEBUG) console.log('[RPR v9.4] debug:', debug);

  return { RPR, Eac_kWh: Eac, Eirr_kWhm2: Eirr, capacity_kWp, hourlySlots, debug };
}

module.exports = { computeRealPRP5 };
