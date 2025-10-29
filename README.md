# iSolarChecking — Render AutoPass v4.1 FINAL

This package is productionized for Render ZIP Upload:
- Backend (Express) serves built frontend (Vite) from `backend/public`.
- All calculations run on backend via `/api/*`.

## Deploy (ZIP Upload on Render)
1) Create new Web Service → Runtime: Node
2) Upload this ZIP
3) Render will:
   - `npm ci` in backend
   - build frontend and copy to `backend/public`
   - `npm start` backend

You do not need to set a PORT; Render provides it. The server uses `process.env.PORT || 8080`.

## Local
cd backend && npm ci && npm run build:frontend && npm start
open http://localhost:8080
