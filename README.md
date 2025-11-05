# iSolarChecking

End-to-end tool to analyze FusionSolar/iSolarCloud logs and generate a clean performance report. The frontend is a lightweight React app; the backend does all heavy work: parsing FusionSolar CSV, parsing PVSyst PDF, and computing Real Performance Ratio (RPR).

- Frontend: React + Vite (upload UI, confirm modal, report)
- Backend: Node.js + Express (CSV/PDF parsing, RPR compute, JSON APIs)

Quick links:
- Architecture: `docs/ARCHITECTURE.md`
- API Spec: `docs/API.md`
- CSV Format & Rules: `docs/CSV_FORMAT.md`

## Quick start (local)

Backend:

```
cd backend
npm install
node index.js
# server on http://localhost:3001
```

Frontend (dev):

```
cd frontend
npm install
npm run dev
```

Try the CSV endpoint with the sample:

```
curl -sS -X POST -F 'logfile=@backend/test-data/test_FusionSolar.csv' http://localhost:3001/analysis/compute | jq '.'
```

## Deploy (Render ZIP)
1) Create a new Web Service (Node)
2) Upload this ZIP
3) Render steps:
   - install backend deps
   - build frontend and copy to `backend/public`
   - start backend (uses `process.env.PORT`)

See `docs/ARCHITECTURE.md` for details, contracts and flows.
