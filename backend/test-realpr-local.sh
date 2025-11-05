#!/usr/bin/env bash
set -euo pipefail
URL="${VITE_BACKEND_URL:-http://localhost:8080}"
echo '{
  "records": [
    { "timestamp":"2025-09-01 06:00:00", "inverter":"INV-ABC", "total_yield_kwh":1000, "Status":"Grid Connected", "activepower":50 },
    { "timestamp":"2025-09-01 06:05:00", "inverter":"INV-ABC", "total_yield_kwh":1000.1, "Status":"Grid Connected", "activepower":60 }
  ]
}' | curl -s -X POST "$URL/analysis/realpr" -H "Content-Type: application/json" -d @- | jq '.'
