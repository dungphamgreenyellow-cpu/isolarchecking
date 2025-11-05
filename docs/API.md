# API Specification

All endpoints return JSON. Times are in local date unless specified.

Base URLs (local):
- Backend: http://localhost:3001

## Health

GET /

Response (text):
```
✅ iSolarChecking backend cloud compute is running!
```

## Parse FusionSolar CSV (primary)

POST /analysis/compute

Form-data:
- logfile: CSV file (FusionSolar export)

Response:
```json
{
  "success": true,
  "data": {
    "success": true,
    "firstDay": "2025-01-01",
    "lastDay": "2025-01-02",
    "days": 2,
    "dailyProduction": { "2025-01-01": 90, "2025-01-02": 60 },
    "total": 150
  },
  "parse_ms": 3.7
}
```

Notes:
- If an XLSX is uploaded, `data.note` will suggest using CSV instead.

cURL:
```
curl -sS -X POST -F 'logfile=@backend/test-data/test_FusionSolar.csv' http://localhost:3001/analysis/compute | jq '.'
```

## Real Performance Ratio (RPR)

POST /analysis/realpr

Body (application/json):
```json
{
  "records": [ {"time":"...","Status":"Grid Connected","Active Power(kW)": 500}, ... ],
  "capacity": 1000,
  "irradiance": [ {"date":"2025-01-01","value": 4.6}, ... ]
}
```

Response:
```json
{
  "success": true,
  "data": { "RPR": 82.45, "Eac_kWh": 1234.56, "Eirr_kWhm2": 78.9, "capacity": 1000, "totalSlots": 288 }
}
```

## Parse PVSyst PDF

POST /api/parse-pvsyst

Form-data:
- file: PDF file exported from PVSyst

Response (excerpt):
```json
{
  "success": true,
  "data": {
    "projectName": "...",
    "location": { "latitude": 10.76, "longitude": 106.66 },
    "components": { "moduleModel": "...", "inverterModel": "..." },
    "capacity": { "dc_kWp": 6500, "ac_kW": 6000 },
    "budget": { "annualEnergy_MWh": 10234, "PR_percent": 81.3, "monthlyExpected": [ ... ] }
  }
}
```

## Legacy CSV parse (quick check)

POST /api/parse-fusion

Form-data:
- file: CSV file

Response:
```json
{ "success": true, "data": { /* same shape as /analysis/compute.data */ } }
```

## Debug uploads

POST /analysis/upload-test-log → saves CSV to `backend/test-data/test_FusionSolar.csv`

POST /analysis/upload-test-pdf → saves PDF to `backend/test-data/test_PVSyst.pdf`

---

Errors:
- Standard shape: `{ success: false, error: "..." }` or `{ success: true, data: { success:false, note:"..." } }` when a CSV guidance note applies.
