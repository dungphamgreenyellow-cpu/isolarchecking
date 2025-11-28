# Backend XLSX→CSV + CSV streaming test notes

## Prerequisites

- Node.js installed
- Python 3 installed and available as `python`
- Python package:

```bash
pip install openpyxl
```

## Run backend locally

```bash
cd backend
npm install
node index.js
```

Backend listens on port 8080 by default.

## Test with FusionSolar XLSX

```bash
curl -X POST "http://localhost:8080/analysis/compute" \
  -F "logfile=@backend/test-data/Fujiseal_Jun25.xlsx"
```

## Test with FusionSolar CSV

```bash
curl -X POST "http://localhost:8080/analysis/compute" \
  -F "logfile=@backend/test-data/sample_fusionsolar.csv"
```

Both requests should return JSON with `success`, `data.dailyProduction`, and `parse_ms`.
