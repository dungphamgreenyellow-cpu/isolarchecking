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

## 🌐 Render Deployment & CORS Configuration

This project now supports adaptive CORS with wildcard host matching and a simple frontend retry for transient network/CORS issues.

### Environment variables

- CORS_ORIGINS (backend)
   - CSV list of allowed origins. Supports wildcard on hostname.
   - Examples: `https://*.github.dev,https://*.onrender.com,https://isolarchecking.onrender.com`
   - Wildcard applies to the hostname only (e.g., `*.github.dev` matches any subdomain of `github.dev`). If protocol is included, it must match the request (http vs https).

- VITE_BACKEND_URL (frontend)
   - The base URL of your backend service. Example: `https://isolarchecking-backend.onrender.com`
   - The frontend uses this to call `/analysis/compute` and other endpoints.

- NODE_ENV
   - In production, the backend restricts CORS using `CORS_ORIGINS`.
   - In development (NODE_ENV !== 'production'), CORS is open (origin: true) for easy iteration.

### Recommended Render configuration

Set these on Render Dashboard → your Backend service → Environment → Add Environment Variable:

```
NODE_ENV=production
CORS_ORIGINS="https://*.onrender.com,https://*.github.dev,https://isolarchecking.onrender.com"
```

Set this on your Frontend service (or .env for local dev):

```
VITE_BACKEND_URL="https://isolarchecking-backend.onrender.com"
```

### Behavior

- Development (NODE_ENV !== 'production'):
   - Backend CORS allows all origins (origin: true).
- Production:
   - Backend checks the request origin against `CORS_ORIGINS`.
   - A match occurs if the origin matches exactly or the hostname ends with a wildcard pattern (e.g., `*.onrender.com`).
   - If protocol is specified in the pattern, it must match the request protocol.
   - Backend responds with `Access-Control-Allow-Origin: <origin>` and `Access-Control-Allow-Credentials: true`.
   - Preflight is handled via `OPTIONS *` with the same rules.

### Verify CORS quickly

Use curl to inspect headers (replace with your backend URL):

```
curl -I https://isolarchecking-backend.onrender.com/analysis/compute
```

You should see an `Access-Control-Allow-Origin` header when called from a browser with an allowed origin.

### HTTPS and mixed content

Ensure both frontend and backend are served over HTTPS in production to avoid mixed-content blocks by the browser.

### Frontend resilience

- `FileCheckModal.jsx` warns if `VITE_BACKEND_URL` is missing and retries the upload request up to 3 times (500ms, 1000ms, 2000ms) before reporting:
   `Server not reachable. Please check backend URL or CORS.`
