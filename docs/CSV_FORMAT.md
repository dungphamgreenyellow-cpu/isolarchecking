# FusionSolar CSV Format and Parsing Rules

This service expects FusionSolar CSV exports. The parser reads rows streaming and computes daily energy from cumulative EAC.

## Expected/accepted headers

Time (one of):
- `Start Time`
- `StartTime`
- `Time`

Inverter identifier (one of):
- `ManageObject`
- `Device name`
- `Inverter`

Cumulative energy (EAC) (one of):
- `Total yield(kWh)`
- `Total Yield(kWh)`

Notes:
- You can extend aliases in `backend/compute/fusionSolarParser.js` if your export uses different labels.

## Sample CSV (minimal)

```
Start Time,ManageObject,Total yield(kWh)
2025-01-01 00:05:00,123456789/INV-A,100
2025-01-01 23:55:00,123456789/INV-A,130
2025-01-01 00:05:00,987654321/INV-B,200
2025-01-01 23:55:00,987654321/INV-B,260
2025-01-02 00:05:00,123456789/INV-A,130
2025-01-02 23:55:00,123456789/INV-A,150
2025-01-02 00:05:00,987654321/INV-B,260
2025-01-02 23:55:00,987654321/INV-B,300
```

## Aggregation logic

- Normalize day as `YYYY-MM-DD` from the timestamp
- Normalize inverter key to `INV-<serial>` where `<serial>` is the string before `/` in ManageObject
- For each inverter/day, track `min(EAC)` and `max(EAC)`; production = `max - min` (≥ 0)
- Sum across inverters per day
- Return:
  - `dailyProduction`: map `{ YYYY-MM-DD: kWh }`
  - `total`: sum of all daily values
  - `firstDay`, `lastDay`, `days`

## Numbers and locales

- Values like `"1,234.56"` are normalized by removing commas/spaces before `Number(...)`
- If your export uses a different decimal convention, extend cleaning logic accordingly

## Timezone

- Day buckets use the local date derived from the timestamp string (e.g., `2025-01-01 23:55:00` → `2025-01-01`)
- If you need explicit TZ handling, pass ISO timestamps with offsets or adjust parsing

## XLSX uploads

- XLSX files are rejected with a note: please export CSV and upload that file

## Performance

- The parser is streaming (`csv-parse`) and memory efficient for large CSVs
- Response includes `parse_ms` from the `/analysis/compute` route for basic timing

---

For changes, update header alias arrays and number/time parsing in `backend/compute/fusionSolarParser.js`.