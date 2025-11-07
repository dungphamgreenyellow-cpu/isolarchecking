# Cấu trúc dự án

## Kiểm kê (chèn output lệnh)

- git rev-parse --show-toplevel
```
/workspaces/isolarchecking
```

- git log --oneline -n 20
```
246b84d (HEAD -> main, origin/main) FE: simplify checkFusionSolarPeriod to return backend data; build for deploy
777a397 Refactor production calc: unique inverter token + daily max-min per INV + sum
7c89807 Unified energy computation: EAC = Total yield(kWh) max-min per inverter per day
e52e8d4 Cleanup: remove legacy CSV path, XLSX-only parser
21a90eb Fix parser: use ONLY  as EAC reference.
eaf347b Auto-detect FusionSolar header row robust
a3be20c Fix FE env: Add VITE_BACKEND_URL for Render backend
dbd0e18 Fix UI: treat status=parsed as success in Log File check
3fe49ce Fix FusionSolar EAC detection: use Total yield(kWh) exact match
807040e Fix CORS for Render + correct port binding
66d3106 Fix backend base URL to use VITE_BACKEND_URL everywhere
de18bce Finalize stable production build: XLSX parser + PVSyst auto-fill + unified PR flow
fef3298 Refine PVSyst parser to extract system summary, characteristics, losses, monthly table accurately
4096bbe PVSyst tolerant parser (semantic soft-match, month signature, null-safe)
d08bd3e fix(parser): correct Start Time + Accumulated EAC + inverter serial normalization + session-based compute flow intact
20eca58 fix(parser): chuyển map → for-loop để đọc dữ liệu từ dòng 5 đúng chuẩn FusionSolar
ad60516 fix(parser): dữ liệu bắt đầu từ dòng 5 (row index 4), không phải dòng 4
294ed43 fix(parser): restore inverter normalization logic (group logs by true inverter model)
7bce16a fix(parser): đọc header dòng 4 & map đúng cột Date + EAC (FusionSolar v9.9-LTS)
3bcf1ee fix(parser): sử dụng EAC_KEYS & DATE_KEYS trong pickField để đọc đúng cột FusionSolar
```

- pwd && node -v && npm -v
```
/workspaces/isolarchecking
v22.20.0
9.8.1
```

- tree -a -I 'node_modules|.git|dist|build|.next|.parcel-cache' -L 3
```
.
├── .vscode
│   └── settings.json
├── README.md
├── REPORT.md
├── backend
│   ├── .nvmrc
│   ├── compute
│   │   ├── fusionSolarParser.js
│   │   ├── irradianceGenerator.js
│   │   ├── parsePVSyst.js
│   │   └── realPRCalculator.js
│   ├── dumpPdfText.js
│   ├── grepPVSyst.js
│   ├── index.js
│   ├── package-lock.json
│   ├── package.json
│   ├── routes
│   │   ├── analysis.js
│   │   └── upload.js
│   ├── scripts
│   │   └── verifyFusionSolar.js
│   ├── test-data
│   │   ├── 20221221 Fuji Seal PVsyst Report 980.455 kWp.pdf
│   │   ├── Fujiseal_Jun25.xlsx
│   │   ├── test_FusionSolar.csv
│   │   ├── test_FusionSolar.xlsx
│   │   └── test_PVSyst.pdf
│   ├── test-realpr-local.sh
│   ├── testParser.js
│   └── utils
│       ├── fusionSolarParser.js
│       └── realPRCalculator.js
├── docs
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── CSV_FORMAT.md
├── frontend
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.js
│   ├── public
│   │   ├── favicon-dark.svg
│   │   └── favicon.svg
│   ├── src
│   │   ├── App.jsx
│   │   ├── Layout
│   │   ├── api.js
│   │   ├── components
│   │   ├── data
│   │   ├── hooks
│   │   ├── index.css
│   │   ├── main.jsx
│   │   ├── pages
│   │   ├── sessionStore.js
│   │   ├── utils
│   │   └── workers
│   ├── tailwind.config.js
│   ├── test-data
│   │   └── test_FusionSolar.xlsx
│   ├── test-run-worker-alt.js
│   ├── test-run-worker.js
│   ├── vite.config.js
│   └── yarn.lock
├── package-lock.json
├── package.json
└── render.yaml

20 directories, 51 files
```

## Tóm tắt cấu trúc
- frontend/ (React + Vite + Tailwind): App shell, pages (`HomePage.jsx`, `Report.jsx`), components (Header, FileCheckModal, ProjectConfirmModal), workers (XLSX worker), utils (API client, FusionSolar proxy, GHI baseline).
- backend/ (Node + Express): `index.js`, routes (`analysis.js`, `upload.js` legacy), compute modules (`fusionSolarParser.js`, `realPRCalculator.js`, `parsePVSyst.js`, `irradianceGenerator.js`), scripts & test data.
- docs/: tài liệu API/kiến trúc/định dạng CSV.


# Frontend (React)

Các file chính và vai trò:

- `src/pages/HomePage.jsx`
  - Trang chính: upload log (FusionSolar XLSX), chọn PVSyst PDF (tuỳ chọn).
  - Dùng Web Worker (`fsXlsxWorker`) để parse sơ bộ XLSX trên FE chỉ để lấy records khi cần tính RPR nâng cao; đường chính vẫn gọi backend.
  - Gọi API:
    - POST `/analysis/compute` (FormData logfile) để backend parse và trả daily production + meta.
    - POST `/api/parse-pvsyst` (FormData file) để auto-fill thông tin dự án từ PVSyst.
    - POST `/analysis/realpr` (JSON records + capacity) khi đã có full records từ worker.
  - Mở `ProjectConfirmModal` tự động khi parse OK; điều hướng sang `/report` với state chứa dữ liệu parse và RPR.

- `src/pages/Report.jsx`
  - Hiển thị báo cáo: thông tin dự án (GPS, Capacity, PV/INV), các card KPI (Actual Production, Total Irradiation, Real PR, PR tham chiếu), và biểu đồ Daily RPR trend (nếu có series).
  - Tự tính “baseline GHI theo tháng” từ `data/ghiBaseline` (mặc định Vietnam, chia trung bình theo ngày) khi không có file irradiance.
  - Gọi POST `/analysis/realpr` để tính Real PR từ backend nếu state có `parse.records` và có capacity.

- `src/components/FileCheckModal.jsx`
  - Kiểm tra nhanh file tải lên. Gọi `checkFusionSolarPeriod(file)` (FE util) để POST `/analysis/compute` và hiển thị `status: 'parsed'` là thành công; cho phép Next khi `valid` hoặc `status === 'parsed'`.
  - Với PVSyst: chỉ kiểm tra phần mở rộng `.pdf` (không parse PDF trên FE nữa).

- `src/components/ProjectConfirmModal.jsx`
  - Form xác nhận/ghi đè thông tin dự án (Site, Capacity DC/AC, Module/Inv model, soiling, γ, degr…). Auto-fill từ PVSyst khi có.

- `src/utils/fusionSolarParser.js`
  - FE proxy gọi backend: POST `/analysis/compute`, trả về `res.data` (đã chuẩn với FileCheckModal).

- `src/Layout/AppLayout.jsx`, `src/components/Header.jsx`
  - Layout và header cố định (Home/Report), style pastel.

Luồng xử lý FE (rút gọn):
1) Người dùng upload XLSX và (tuỳ chọn) PDF PVSyst.
2) FileCheckModal gọi `/analysis/compute` để xác nhận parse OK (status=parsed).
3) (Tuỳ chọn) Gọi `/api/parse-pvsyst` để điền thông tin hệ thống.
4) Người dùng Confirm → FE có thể:
   - Gọi lại `/analysis/compute` (compute flow chính) và (nếu có records từ worker) gọi `/analysis/realpr` với capacity đã suy luận (DC → AC → user input).
5) Navigate `/report` để hiển thị report; nếu không có daily RPR series từ backend thì dùng giá trị RPR tổng và baseline GHI tham chiếu.


# Backend (Node/Express)

- `backend/index.js`
  - Express server, CORS (Render FE + localhost:5173), file upload (`express-fileupload` với `/tmp`), JSON body parser.
  - Health: GET `/` → "iSolarChecking backend cloud compute is running!".
  - API:
    - POST `/api/parse-pvsyst`: nhận PDF Buffer, gọi `parsePVSyst` → trả về các trường (lat/lon, modules_total, capacity_dc_kwp, inverter_count, capacity_ac_kw, dc_ac_ratio, model codes, soiling, monthly table …).
    - POST `/api/parse-fusion`: mirror đơn giản → `streamParseAndCompute(file.data)`.
    - POST `/api/compute-rpr`: wrapper `computeRealPerformanceRatio(parsed, dailyGHI, capacity)`.
  - Mount routes: `/api` (upload), `/analysis` (compute + realpr + parse-pvsyst mirror), global error handler.
  - Port: `process.env.PORT || 3001`.

- `backend/routes/analysis.js`
  - POST `/analysis/compute` (multipart `logfile`): gọi `streamParseAndCompute(buf)`; trả `{ success: true, data: result, parse_ms }`.
  - POST `/analysis/realpr` (JSON `{ records, capacity, irradiance? }`): gọi `computeRealPerformanceRatio` và trả `{ success: true, data }`.
  - POST `/analysis/parse-pvsyst`: giống `/api/parse-pvsyst` (nhận `pvsyst` hoặc `file`).
  - Một số endpoint debug để upload test files vào `backend/test-data`.

- `backend/routes/upload.js` (legacy)
  - Lưu file vào `backend/compute/uploads/` và trả note "Excel parsing disabled. Please upload CSV to /analysis/compute." (ghi chú cũ; hiện luồng chính dùng XLSX-only parser qua `/analysis/compute`).

- `backend/compute/fusionSolarParser.js`
  - XLSX-only: kiểm tra chữ ký ZIP `PK\u0003\u0004`, đọc sheet 0.
  - Auto-detect header (trong 6 dòng đầu) theo tỉ lệ chữ cái và số ô không rỗng; fallback: dòng không rỗng đầu tiên.
  - Bắt buộc cột EAC đúng chuẩn "Total yield(kWh)" (case-insensitive trim-match). Thiếu → throw error.
  - Chuẩn hoá inverter: trích token khác biệt trong `ManageObject` (hoặc các biến thể header) → đặt tên `INV-<token>`.
  - Gom theo ngày (YYYY-MM-DD): với mỗi inverter trong ngày tính năng lượng = max(EAC) - min(EAC); dailyProduction[day] = Σ(energy của các inverter).
  - Xuất: `{ success, dailyProduction, dailyProductionTotal, firstDay, lastDay, parsedRecordsCount, allHeaders }`.
  - Ví dụ (đã kiểm chứng bằng script `backend/scripts/verifyFusionSolar.js`):
    - firstDay: 2025-06-01, lastDay: 2025-06-30
    - parsedRecordsCount: 39,745
    - dailyProductionTotal: 85,857.42 kWh

- `backend/compute/realPRCalculator.js`
  - Input: `{ records }` (5-min), `dailyGHI?` (tổng kWh/m² theo ngày), `capacity` (kWp), `debug?`.
  - Lọc chỉ các records có trạng thái "Grid Connected"/"Connected"/"On".
  - Eac: cộng các trường power (ActivePower/OutputPower/Pac/FeedInPower/TotalPower…), sau đó chia 12 để ra kWh.
  - Eirr: nếu có `dailyGHI[]` thì lấy tổng; nếu không, suy luận từ trường irradiance/ghi/gti/solar trong records rồi ÷12 ÷1000 để đổi về kWh/m².
  - PR = Eac_kWh / (Eirr_kWhm2 × capacity) × 100. Trả về `{ RPR, Eac_kWh, Eirr_kWhm2, capacity, totalSlots }`.

- `backend/compute/parsePVSyst.js`
  - Parser PDF “tolerant”: dùng `pdfjs-dist` để lấy tokens (x,y) → ghép line → heuristic tìm các trường của System Summary, Array/Inverter Characteristics, Array Losses (Soiling), và bảng tháng (12 hàng) ở Balances & Main Results.
  - Chuẩn hoá số (dấu phẩy/chấm), tìm theo regex, ưu tiên anchors gần "System summary"/"PV Array"/"Inverters".
  - Trả về JSON nhiều trường (lat, lon, modules_total, capacity_dc_kwp, capacity_ac_kw, inverter_count, dc_ac_ratio, module_model, inverter_model, soiling_loss_percent, monthly[12]…).

- `backend/compute/irradianceGenerator.js`
  - Tạo profile công suất bức xạ theo nửa-sin trong ngày (06:00–18:00, cấu hình được), sao cho Σ(power)/12 == GHI(day). Dùng khi cần nội suy slot-level power từ daily GHI.


# Luồng dữ liệu & API

Các endpoint chính:
- POST `/analysis/compute` (multipart)
  - FE gửi: FormData có `logfile` (XLSX FusionSolar).
  - BE xử lý: `streamParseAndCompute(Buffer)` → parse header, bắt cột "Total yield(kWh)", chuẩn hoá inverter, gom daily.
  - Trả: `{ success: true, data: { success, dailyProduction, dailyProductionTotal, firstDay, lastDay, parsedRecordsCount, allHeaders }, parse_ms }`.

- POST `/analysis/realpr` (JSON)
  - FE gửi: `{ records: Array<object>, capacity: number, irradiance?: Array }`.
  - BE xử lý: filter grid-connected, `Eac_kWh = Σ(power)/12`, `Eirr_kWhm2` từ dailyGHI hoặc từ records (÷12 ÷1000), tính PR.
  - Trả: `{ success: true, data: { RPR, Eac_kWh, Eirr_kWhm2, capacity, totalSlots } }`.

- POST `/api/parse-pvsyst` (multipart)
  - FE gửi: FormData có `file` (PDF PVSyst).
  - BE xử lý: đọc PDF, trích thông tin (capacity DC/AC, models, monthly…).
  - Trả: `{ success: true, data: { ... } }`.

(Legacy/Mirror)
- POST `/api/parse-fusion`: gọi cùng parser như `/analysis/compute`.
- POST `/api/compute-rpr`: wrapper `computeRealPerformanceRatio`.


# Logic tính toán

Chuỗi logic tổng thể: Upload → Parser (EAC) → RPR Engine → Report

- Parser FusionSolar (XLSX-only)
  - Header autodetect trong 6 dòng đầu; nếu không, lấy dòng non-empty đầu tiên.
  - Cột EAC: chỉ lấy chính xác "Total yield(kWh)"; bỏ mọi alias.
  - Ngày: chuẩn hoá về `YYYY-MM-DD` (hỗ trợ serial date của Excel).
  - Inverter: rút token phân biệt trong `ManageObject` → `INV-<token>`.
  - Daily energy: theo inverter và ngày, `energy = max(EAC) - min(EAC)` (>= 0). Tổng ngày = Σ energy các inverter.

- RPR Engine
  - Lọc record có trạng thái nối lưới.
  - Eac (kWh) = Σ(power) / 12 (vì log 5 phút → 12 slots/giờ).
  - Eirr (kWh/m²) =
    - Nếu có `dailyGHI`: tổng `value/ghi` toàn kỳ;
    - Nếu suy luận từ log: Σ(irrad) / 12 / 1000 (W→kW và 5’→giờ).
  - PR (%) = `Eac_kWh / (Eirr_kWhm2 × capacity)` × 100.

Minh hoạ (trích code):
```js
// backend/compute/fusionSolarParser.js (điểm then chốt)
const totalYieldColIndex = headers.findIndex(
  (h) => typeof h === "string" && h.trim().toLowerCase() === "total yield(kwh)"
);
if (totalYieldColIndex === -1) {
  throw new Error("Không tìm thấy cột Total yield(kWh)");
}
```

```js
// backend/compute/realPRCalculator.js (chuẩn hoá slot 5')
const Eac_kWh = eac / 12; // 5-min logs → 12 intervals/hour
const pr = (Eac_kWh / (Eirr_kWhm2 * capacity)) * 100;
```


# Lỗi & Thiếu sót

Tổng hợp nhanh (tự động quét console.error/catch/TODO/FIXME và đọc mã):

- Parser/Compute
  - `fusionSolarParser.js`: bắt buộc đúng cột "Total yield(kWh)" → có thể fail nếu bản địa hoá header. Có log lỗi khi XLSX parse fail.
  - Hiệu năng: với file mẫu ~39k bản ghi, thời gian parse ~31s trong dev container (có thể tối ưu nếu cần streaming sâu hơn hoặc native add-ons; hiện dùng xlsx utils).

- RPR
  - Dựa vào key power/irradiance tên tổng quát (regex). Nếu log không có các key này, Eirr sẽ = 0 nếu không cung cấp dailyGHI.
  - Chưa trả "daily RPR series" từ backend — FE để trống series (hiện chỉ có RPR tổng).

- Frontend UI
  - `FileCheckModal` hiển thị "Parsed" khi status=parsed; thông điệp lỗi dạng chung chung (ví dụ: "Error reading log file").
  - FE util comment còn ghi "CSV-only endpoint" nhưng thực tế parser là XLSX-only; route legacy upload.js cũng ghi chú "Excel parsing disabled" (không ảnh hưởng luồng chính).

- Deploy/Config
  - Port: `process.env.PORT || 3001` (nếu hạ tầng yêu cầu 8080 cần set env, không nên hard-code).
  - CORS: whitelist Render FE và localhost:5173 — cần cập nhật nếu domain FE thay đổi.

- Thiếu kiểm thử & chất lượng
  - Chưa có test tự động (unit/integration) cho parser/RPR.
  - Chưa có linter/CI thiết lập rõ ràng.


# Tổng kết so với mục tiêu

- Hiện có thể:
  - Parse FusionSolar XLSX chắc chắn (XLSX-only, EAC chuẩn, inverter chuẩn hoá theo token, daily energy chính xác theo max−min).
  - Tính Real PR tổng từ records 5 phút hoặc từ baseline GHI theo tháng.
  - Tự động điền thông tin dự án từ PDF PVSyst (tolerant parser).
  - FE đã chuẩn hoá base URL qua `VITE_BACKEND_URL` và UX pastel sạch.

- Còn thiếu để đạt "full iSolarChecking":
  - Daily RPR series từ backend (hiện FE chưa vẽ được trend thực vì thiếu series).
  - Kiểm thử tự động, linter và CI/CD.
  - Tuỳ chọn SEO/SSR (hiện là SPA Vite), tối ưu hiệu năng parse cho file rất lớn.
  - Đồng bộ thông điệp và xoá ghi chú legacy (CSV vs XLSX) cho nhất quán.
  - Tính năng nâng cao: lưu lịch sử dự án, auth thực thụ, export PDF report, multi-language UI, và tối ưu cloud (autoscaling/timeouts).
