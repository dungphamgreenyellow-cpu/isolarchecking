# iSolarChecking – Implementation Report (current state)

## Overview

This report documents the current backend and frontend implementation, focusing on FusionSolar XLSX parsing, daily production computation, PVSyst extraction, Real PR calculation, and the app’s request flow. It also highlights alignment with the expected baseline specs and flags any deviations with suggested fixes.


## Baseline alignment

- FusionSolar parsing is XLSX-only
  - Status: MATCH
  - Notes: CSV path removed. Parser accepts only files with XLSX signature (ZIP magic PK\u0003\u0004).

- EAC column detection: only “Total yield(kWh)”
  - Status: MATCH
  - Notes: Any aliases ignored. If column is missing, parser fails fast with a clear message.

- Header row detection: auto-detect within first 6 rows
  - Status: MATCH
  - Method: Heuristic uses letter-ratio and non-empty cell count; falls back to first non-empty row when heuristic fails.

- Inverter normalization: derive unique token from ManageObject
  - Status: MATCH
  - Output: Normalized name format `INV-<token>` to aggregate per inverter per day.

- Daily energy computation: sum over all inverters (max − min per day)
  - Status: MATCH
  - Output fields: `dailyProduction` (object keyed by YYYY-MM-DD), `dailyProductionTotal`, `firstDay`, `lastDay`, `parsedRecordsCount`.

- Frontend base URL via VITE_BACKEND_URL; requests go to backend
  - Status: MATCH

- FileCheckModal: “parsed” status treated as success and enables Next
  - Status: MATCH

- Real PR (RPR) engine
  - Status: MATCH (per current spec)
  - Details: Filters “Grid Connected”, converts 5-min logs (÷12) to kWh, converts irradiance W/m² → kWh/m² (÷12 ÷1000 when estimating from logs). PR = Eac_kWh / (Eirr_kWhm2 × capacity) × 100.

- Backend PORT
  - Status: DEVIATION (if baseline expects 8080)
  - Current: `process.env.PORT || 3001`. Proposal: keep auto-port for Render; if a strict 8080 is required, set env on deploy rather than hard-coding.


## Key components and contracts

### FusionSolar XLSX parser (`backend/compute/fusionSolarParser.js`)

- Input: Buffer of an XLSX export from FusionSolar (sheet 0 is used).
- Output JSON:
  - `success: boolean`
  - `dailyProduction: { [YYYY-MM-DD]: number }` — kWh
  - `dailyProductionTotal: number` — kWh
  - `firstDay: string|null` — YYYY-MM-DD
  - `lastDay: string|null` — YYYY-MM-DD
  - `parsedRecordsCount: number`
  - `allHeaders: string[]`
- Logic highlights:
  - Header autodetect in first 6 rows; fallback to first non-empty row.
  - EAC strictly from `Total yield(kWh)`; if absent → error.
  - Inverter normalization by unique token derived from `ManageObject` or equivalent headers.
  - Per-inverter daily energy = max − min; daily sum = Σ across inverters.

Edge cases handled:
- Multiple similar inverter names → tokenization extracts a differentiating token.
- Mixed date formats (Excel serial, plain string) → normalized to YYYY-MM-DD.
- Non-numeric EAC values and empty rows skipped.

### Real PR calculator (`backend/compute/realPRCalculator.js`)

- Inputs:
  - `parsed: { records: Array<object> }` — raw log records (5-min granularity)
  - `dailyGHI: Array<{ date?: string, value?: number, ghi?: number }>` — optional
  - `capacity: number` — kWp (DC preferred), derived in FE order: DC → AC → user input
  - `debug?: boolean`
- Outputs:
  - `{ RPR, Eac_kWh, Eirr_kWhm2, capacity, totalSlots }`
- Details:
  - Filters only grid-connected rows.
  - Sums power-like fields (ActivePower/OutputPower/Pac/etc.) and normalizes to kWh by ÷12.
  - Irradiance: uses provided dailyGHI sum if given; otherwise infers from irradiance-like fields in records and converts W/m² → kWh/m² by ÷12 ÷1000.

Edge cases handled:
- Missing irradiance fields → requires `dailyGHI`; otherwise RPR may be small/zero.
- No grid-connected slots → error is returned in payload.

### Backend routes

- `POST /analysis/compute` — multipart with `logfile`; returns FusionSolar parse result.
- `POST /analysis/realpr` — JSON `{ records, capacity, irradiance? }`; returns RPR result.
- `POST /api/parse-pvsyst` — multipart with `file`; returns PVSyst extracted info.

Server config:
- CORS: allows Render FE and localhost:5173.
- Uploads: express-fileupload with /tmp temp dir (Render-friendly).
- Port: `process.env.PORT || 3001`.

### Frontend request flow

- Env: `import.meta.env.VITE_BACKEND_URL`.
- HomePage
  - Test backend button GETs `/`.
  - Uploads call `/analysis/compute` and `/api/parse-pvsyst`.
  - After successful parse, `ProjectConfirmModal` auto-opens (Next gating includes status="parsed").
- `FileCheckModal` shows parse progress; success if status === "parsed".


## Validation results

Using the sample `backend/test-data/Fujiseal_Jun25.xlsx`, verified via `backend/scripts/verifyFusionSolar.js`:

- success: true
- firstDay: 2025-06-01
- lastDay: 2025-06-30
- parsedRecordsCount: 39,745
- dailyProductionTotal: 85,857.42 kWh
- days: 30
- First days sample:
  - 2025-06-01: 1,177.18 kWh
  - 2025-06-02: 2,663.92 kWh
  - 2025-06-03: 2,608.52 kWh
- Parse time (on dev container): ~31.4s

Note: Timing depends on hardware and container. Figures are from this workspace run with Node v22.20.0.


## Build and run

- Backend
  - Start dev: `npm run start:dev` in `backend/`
  - Start: `npm start` in `backend/`
  - Health: GET `/` → "iSolarChecking backend cloud compute is running!"
- Frontend
  - Build: `npm run build` in `frontend/` (done by `backend` script `build:frontend`).
  - Serve: configured to call backend via VITE_BACKEND_URL.


## Risks and follow-ups

- Port standardization
  - If 8080 is required by platform, prefer setting the environment variable on deploy rather than hard-coding.

- Parser resilience
  - Current header heuristic works for typical FusionSolar exports; keep an eye on rare layouts (merged header rows, localized headers). Add small localized header maps if needed.

- RPR sanity
  - Ensure capacity selection order (DC → AC → user) matches business expectation.
  - Consider explicit field names mapping for irradiance if multiple candidates exist.

- Tests
  - Add unit tests for: header detection, EAC-only enforcement, inverter token extraction, and daily aggregation.


## Appendix: Key files

- `backend/compute/fusionSolarParser.js` — XLSX-only FusionSolar parser with header autodetect, EAC-only, inverter token normalization, and daily kWh aggregation.
- `backend/compute/realPRCalculator.js` — Real PR computation with 5-min normalization and irradiance conversion.
- `backend/routes/analysis.js` — `/analysis/compute`, `/analysis/realpr`, `/analysis/parse-pvsyst` endpoints.
- `frontend/src/pages/HomePage.jsx` — Uses `VITE_BACKEND_URL`; orchestrates uploads and modal flow.
- `backend/scripts/verifyFusionSolar.js` — Script used to verify totals for the sample dataset.
