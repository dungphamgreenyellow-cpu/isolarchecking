# TODO — PVSYST PARSER REPORT

Mục tiêu: chuẩn bị báo cáo (audit) cho parser `backend/compute/parsePVSyst.js` trước khi làm refactor hoặc cập nhật lớn.

File liên quan
- `backend/compute/parsePVSyst.js` — file parser chính (text extraction, anchors, bảng monthly)
- Caller: `backend/routes/analysis.js` (endpoint `/analysis/parse-pvsyst`)
- Test runner: `backend/scripts/runLocalTest.js`
- FE mapping: `frontend/src/pages/ReportHeader.jsx`, `frontend/src/components/ProjectConfirmModal.jsx`

Checklist (thực hiện bởi reviewer):
1. Text extraction
   - [ ] Kiểm tra phương thức extract text: `pdf-parse` (primary) và fallback `pdfjs-dist`.
   - [ ] Ghi lại các corner-case: multi-page joins, headers/footers bị dính, broken lines.
   - [ ] Test với 3 mẫu PDF thực tế (mẫu FujiSeal + 2 PDF khác) và lưu log extraction.

2. Section anchors & regex
   - [ ] Liệt kê các anchor regex hiện có trong file (report date, GPS Lat/Lon, Nb. of modules, Pnom total, Produced Energy, Specific production, PR, Unit Nom. Power, Array Soiling Losses, Balances table header).
   - [ ] Đánh giá độ ổn định của từng regex (false positive / false negative). Ghi đề xuất chỉnh sửa.

3. Monthly table parsing
   - [ ] Xác minh cơ chế mapping header → cột (dynamic header detection).
   - [ ] Test với các PDF có layout khác nhau (cột cách bởi 2-space, '|' pipe, tab).
   - [ ] Kiểm tra phần lấy giá trị "year" (tổng/năm) và mapping sang `yearSummary.EGrid_kWh`.

4. Numeric normalization
   - [ ] Kiểm tra `parseNumberFlexible` với các biến thể: "1,234.56", "1.234,56", "1234", "1 234", có dấu âm, đơn vị MW/kW/Wp.

5. GPS parsing
   - [ ] Kiểm tra tất cả pattern: decimal with hemisphere, DMS (° ' "), Lat/Lon tokens, Latitude/Longitude labels.

6. Output shape
   - [ ] Liệt kê tất cả trường parser trả về (reportDate, gps, systemInfo, expected, pvArray, soilingLoss_percent, monthly[], yearSummary).
   - [ ] So sánh với schema frontend mong đợi (ReportHeader, ProjectConfirmModal mapping).

7. Cross-check & warnings
   - [ ] Kiểm tra chéo Produced Energy (MWh) vs year E_Grid (kWh) and logic cảnh báo >1 MWh.

8. Tests & reproducibility
   - [ ] Thêm/ghi lại test PDF files vào `backend/test-data/` (3 mẫu).
   - [ ] Thêm script đơn giản `node backend/scripts/runLocalTest.js` (đã có) và ghi hướng dẫn chạy.

9. Đề xuất thay đổi
   - [ ] Nếu phát hiện regex rườm rà / fragile, đề xuất anchor sửa theo multi-anchor strategy (multi-level anchors, fuzzy match, fallback heuristics).
   - [ ] Gợi ý logging debug (level: info/warn) và output sample `rawText` tối đa 2KB để hỗ trợ debugging.

10. Ghi nhận rủi ro & migration plan
   - [ ] Nếu rewrite parser, liệt kê dependent files cần cập nhật (FE mapping, routes, tests) và kế hoạch roll-out (canary, feature flag).

Mẫu lệnh để chạy audit local
```powershell
# từ repo root
node backend/scripts/runLocalTest.js
# (yêu cầu có file tests trong backend/test-data/)
```

Ghi chú
- Mục TODO đã được thêm cả vào todo list nội bộ của Copilot; file này để lưu trữ chi tiết, có thể mở PR độc lập khi bắt đầu refactor.

Người phụ trách: @you (thêm tên người phụ trách vào file khi bắt đầu)

Ngày tạo: 2025-11-28
