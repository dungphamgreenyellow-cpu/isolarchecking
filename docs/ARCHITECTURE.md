# iSolarChecking — Project Architecture and Deep-Dive

This document is a complete technical overview of the iSolarChecking project so another AI/engineer can understand and extend it quickly.

## Overview

Monorepo with two apps:

- backend (Node.js · Express)
  - Accepts file uploads (express-fileupload)
  - Parses FusionSolar logs (CSV-only, streaming)
  - Parses PVSyst PDF to extract project metadata
  - Computes Real Performance Ratio (RPR)
  - Exposes simple JSON APIs for the frontend
- frontend (React + Vite)
  - Lightweight UI: upload files, show a confirm modal, render a performance report
  - All heavy parsing (CSV/PDF) and RPR compute happen in the backend

## Tech stack

- Backend: Node.js (ESM), Express, cors, express-fileupload, csv-parse, pdf-parse
- Frontend: React, React Router, Vite, Tailwind (via config), Recharts

## Folder structure (key files)

```
backend/
  index.js                        # Express app, CORS, routes mount
  package.json
  compute/
    fusionSolarParser.js         # CSV streaming parser (fast baseline)
    parsePVSyst.js               # PVSyst PDF parser (text extraction)
    realPRCalculator.js          # Real PR computation
    irradianceGenerator.js       # Generate synthetic 5-min irradiance power profile
  routes/
    analysis.js                  # /analysis/* endpoints
    upload.js                    # basic upload endpoint (Excel disabled)

frontend/
  index.html
  src/
    main.jsx                     # React entry (BrowserRouter)
    App.jsx                      # Routes: /, /report
    pages/
      HomePage.jsx               # Upload and analysis triggers
      Report.jsx                 # Report UI (cards + chart)
    components/
      ProjectConfirmModal.jsx    # Confirm with prefilled form
      FileCheckModal.jsx         # Pre-checks (log + optional PVSyst)
    utils/
      apiClient.js               # Axios client (baseURL from env)
    data/ghiBaseline.js          # Baseline GHI per country/month
```

## Backend

### Server setup (`backend/index.js`)

- Express + middlewares:
  - `express-fileupload` (temporary files under `/tmp`)
  - `cors` with `origin: "*"`, allowed methods `GET, POST, OPTIONS`, headers `Content-Type, Authorization`
  - JSON/urlencoded body parsers
  - Health-check `GET /`
- Routes:
  - `/api` → `routes/upload.js` (basic upload helper); also provides legacy quick endpoints (`/api/parse-pvsyst`, `/api/parse-fusion`, `/api/compute-rpr`)
  - `/analysis` → `routes/analysis.js` (primary production endpoints)

### End-to-end flow (high-level)

1) User selects files in HomePage (CSV required; PDF/GHI optional)
2) Frontend posts `logfile` to `/analysis/compute`
3) Backend streams CSV, computes daily energy → returns `{ dailyProduction, total, firstDay, lastDay, days }`
4) Frontend auto-opens `ProjectConfirmModal` with prefilled fields
5) Report page renders summary (Actual Production, Irradiation baseline, PRs) and chart

### Endpoints

- `GET /` → plain text health message

- `POST /api/parse-pvsyst`
  - form-data: `file` (PDF buffer)
  - returns `{ success, data: { projectName, location, components, capacity, budget, _debug } }`

- `POST /api/parse-fusion` (legacy; calls the same CSV parser)
  - form-data: `file` (CSV buffer)
  - returns `{ success, data }` where `data` is the CSV parser result (see below)

- `POST /api/compute-rpr`
  - JSON body: `{ parsed, dailyGHI, capacity }`
  - returns `{ success, rpr }` where `rpr` has keys `{ RPR, Eac_kWh, Eirr_kWhm2, capacity, totalSlots }`

- `POST /analysis/compute`
  - form-data: `logfile` (CSV buffer)
  - returns `{ success, data, parse_ms }` where `data` is:
    ```json
    {
      "success": true,
      "firstDay": "YYYY-MM-DD",
      "lastDay": "YYYY-MM-DD",
      "days": 2,
      "dailyProduction": { "YYYY-MM-DD": kWh, "YYYY-MM-DD": kWh },
      "total": 150
    }
    ```

- `POST /analysis/realpr`
  - JSON body: `{ records, capacity, irradiance }`
  - returns `{ success, data }` where `data` mirrors compute result from `realPRCalculator`

- Debug helpers
  - `POST /analysis/upload-test-log` → saves CSV to `backend/test-data/test_FusionSolar.csv`
  - `POST /analysis/upload-test-pdf` → saves PDF to `backend/test-data/test_PVSyst.pdf`

### CSV parser (fast baseline) — `compute/fusionSolarParser.js`

Purpose: compute daily energy production by inverter/day from FusionSolar CSV export, using cumulative EAC field.

Algorithm:

1. Reject `.xlsx` files early by checking ZIP magic ("PK\u0003\u0004").
2. Use `csv-parse` with `{ columns: true, bom: true, trim: true }`.
3. Read rows streaming; for each row, pick columns:
   - Time: `Start Time` OR `StartTime` OR `Time`
   - Inverter: `ManageObject` OR `Device name` OR `Inverter`
   - EAC: `Total yield(kWh)` (or `Total Yield(kWh)`)
4. Normalize to day key `YYYY-MM-DD`, normalize inverter key as `INV-<serial>` (split on `/`).
5. Track per inverter/day min and max EAC; production = `max - min` (if positive).
6. Aggregate per day across inverters, compute `total`, `firstDay`, `lastDay`, `days`.

Output shape:

```json
{
  "success": true,
  "firstDay": "YYYY-MM-DD",
  "lastDay": "YYYY-MM-DD",
  "days": 2,
  "dailyProduction": { "YYYY-MM-DD": 90, "YYYY-MM-DD": 60 },
  "total": 150
}
```

Edge cases & notes:

- If the CSV doesn’t include expected headers, parser will skip rows and may return zeros. Extend the header alias list as needed for new exports.
- For `.xlsx` uploads, endpoint returns a note prompting users to export CSV.
- Timezone is inferred by JavaScript Date parsing; the day key uses local date from the timestamp string.

Glossary:
- EAC: Energy injected to AC (cumulative) as reported by inverter/plant
- Daily Production: Σ over inverters of (max(EAC) - min(EAC)) per day
- ManageObject: Asset identifier field in FusionSolar export

### Real PR calculator — `compute/realPRCalculator.js`

Computes Real Performance Ratio from parsed log `records` and capacity. Formula:

Inline math: $\mathrm{RPR}(\%) = \dfrac{E_{AC}\;[\mathrm{kWh}]}{E_{irr}\;[\mathrm{kWh/m^2}]\times P_{\mathrm{DC}}\;[\mathrm{kWp}]}\times 100$

Where:

- `EAC_kWh` approximated from grid-connected records by summing power-like fields per 5-min slot and dividing by 12.
- `Eirr_kWhm2` is either sum of provided daily GHI values or estimated from available irradiance-like fields (also normalized by 12 and converted W→kWh).

Return shape:

```json
{
  "RPR": 82.45,
  "Eac_kWh": 1234.56,
  "Eirr_kWhm2": 78.9,
  "capacity": 1000,
  "totalSlots": 288
}
```

### PVSyst parser — `compute/parsePVSyst.js`

- Uses `pdf-parse` to get text, then extracts:
  - `projectName`
  - `location` (lat/long)
  - `components` (module/inverter patterns)
  - `capacity` (DC kWp, AC kWac)
  - `budget` (annual energy, PR, and per-month table)
- Throws if the monthly table has fewer than 12 months detected.

### Irradiance generator — `compute/irradianceGenerator.js`

- Generates a per-slot power profile (sinusoidal between dayStartHour and dayStartHour + daylightHours) scaled so that `sum(power)/12 == daily GHI (kWh/m²)`.
- Useful for synthesizing 5-min irradiance series from daily GHI.

## Frontend

### App entry

- `src/main.jsx` mounts `App` in `<BrowserRouter>`
- `src/App.jsx` defines routes within `AppLayout`:
  - `/` → `HomePage`
  - `/report` → `Report`

### HomePage

- File inputs for:
  - Required: FusionSolar log CSV
  - Optional: PVSyst PDF and irradiation file
- Two flows:
  - Pre-check with `FileCheckModal` (basic validations, optional PDF check via text) and then cloud analysis
  - Direct “Run Cloud Parse (backend)” button (debug/testing)
- “Auto-open confirm” flow available: `handleStartAnalyze` posts `logfile` to `/analysis/compute`, handles `note` errors, and opens `ProjectConfirmModal` on success.

State hand-off contracts:
- From `/analysis/compute` to modal: `initialData` mirrors CSV parser result (may add siteName/capacity later)
- From modal to `/report`: `projectData` contains: site info, capacity, inverter/module, actualProduction, dailyProduction, days, optional irradiation, country

### ProjectConfirmModal

- When opened, it auto-fills fields from `initialData` plus defaults:
  - `siteName`, `installed/capacity`, `location`, `cod`, `module`, `inverter`, `tempCoeff="0.34"`, `degr="0.5"`

### Report

- Reads `projectData` from router state and renders:
  - Summary cards (Actual Production, Total Irradiation, Real PR, Reference PR)
  - Daily RPR trend chart (Recharts)
- Auto baseline GHI:
  - `getMonthlyGHI(country, month)/30 * days`
  - Country defaults to Vietnam when unspecified
- Real PR by backend call `/analysis/realpr` with `{ records, capacity, irradiance }`

## Data contracts

### CSV parser result (backend/analysis/compute)

```json
{
  "success": true,
  "firstDay": "YYYY-MM-DD",
  "lastDay": "YYYY-MM-DD",
  "days": 2,
  "dailyProduction": { "YYYY-MM-DD": kWh },
  "total": 150
}
```

### PVSyst parse result (backend/api/parse-pvsyst)

```json
{
  "success": true,
  "data": {
    "projectName": "...",
    "location": { "latitude": 0, "longitude": 0 },
    "components": { "moduleModel": "...", "inverterModel": "..." },
    "capacity": { "dc_kWp": 0, "ac_kW": 0 },
    "budget": {
      "annualEnergy_MWh": 0,
      "PR_percent": 0,
      "monthlyExpected": [ {"month":"Jan","ghi":...}, ... ]
    }
  }
}
```

### Real PR compute result (backend/analysis/realpr)

```json
{
  "success": true,
  "data": { "RPR": 82.45, "Eac_kWh": 1234.56, "Eirr_kWhm2": 78.9, "capacity": 1000, "totalSlots": 288 }
}
```

## Environment variables

Frontend uses multiple base URLs depending on file:

- `VITE_BACKEND_URL` — used by pages to call `/analysis/*`
- `VITE_API_BASE_URL` — used in some helper calls (`Test backend` button)
- `VITE_API_URL` — used by `src/utils/apiClient.js`

Recommendation: consolidate to one variable (e.g., `VITE_BACKEND_URL`) across the codebase to avoid confusion.

Current usage:
- `VITE_BACKEND_URL`: used by `HomePage` and `Report` to call `/analysis/*`
- `VITE_API_BASE_URL`: used by `TestBackendButton`
- `VITE_API_URL`: used by `src/utils/apiClient.js`

## Running locally

1. Backend
   - From `backend/`:
     - `npm install`
     - `node index.js`
     - Server listens on `http://localhost:${process.env.PORT || 3001}`

2. Frontend
   - From `frontend/`:
     - `npm install`
     - `npm run dev` (or `npm run build` for production bundle)

3. Quick CSV test (backend)
   - POST to `/analysis/compute` with a sample CSV (see `backend/test-data/test_FusionSolar.csv` if present):
   - Response includes `parse_ms` timing

Example:
```
curl -sS -X POST -F 'logfile=@backend/test-data/test_FusionSolar.csv' http://localhost:3001/analysis/compute | jq '.'
```

## Edge cases & quality gates

- Build: PASS (frontend Vite build success)
- Lint/Type: not configured; the codebase compiles and runs
- Tests: not present; the CSV parser has been validated on a sample
- CSV header aliases may need extending for new FusionSolar export formats
- `.xlsx` uploads are rejected with a helpful note; users should export CSV

## Next steps (optional improvements)

- Unify frontend base URL env var usage
- Add minimal e2e test (cURL + JSON shape check) in a script
- Extend CSV parser header aliases (ManageObject/Total yield name variants)
- Remove temporary debug logs from parser if added during development

---

This document should enable another AI/engineer to navigate the repository, understand responsibilities and contracts, and safely extend the codebase.
