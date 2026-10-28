# Changelog

## 1.1.0

### Thêm
- Tool `zmp_policy_audit` và lệnh `zmp-mcp audit <dir> [--json]`: kiểm duyệt theo chính sách Zalo Mini App, báo `file:line`, thoát mã 1 khi có vi phạm.
  - Tên: viết hoa toàn bộ, từ cấm "Zalo" / "Mini App" / "App" (kể cả dính trong thương hiệu, ở mức cảnh báo), emoji, thiếu chủ thể, tên lệch giữa `app-config.json`, `app.json`, `index.html`.
  - Code: `<a href>` / `window.open` / `location.href` ra ngoài, xin quyền trong `useEffect` lúc mount (đọc cả khối nhiều dòng), đăng nhập Google/Facebook/Apple, quảng cáo, rút tiền, chữ demo / dữ liệu mẫu (hiểu chữ có dấu), `eval`, HTTP, nút mua thiếu Checkout SDK. Bỏ qua comment.
  - Không còn kết luận "100% sẵn sàng": luôn kèm danh sách mục phải kiểm tay (logo, mô tả, dữ liệu thật...).
- `dist/zmp-audit.cjs`: bản CLI kiểm duyệt đứng riêng để chép vào dự án Mini App.
- `zmp_request_login_qr` lưu ảnh QR ra file (`qrImagePath`).
- Test: `npm test`.

### Sửa (bảo mật)
- `zmp_wait_for_login` / `zmp_request_login_qr` không trả JWT về client khi token đã lưu vào `.env`.
- `zmp_start_oauth_callback` không ghi đè `ZMP_TOKEN` bằng authorization code; kiểm tra `state` (tạo bằng `crypto.randomBytes`).
- Trang OAuth callback escape tham số từ URL (chặn XSS phản chiếu) và báo đúng khi xác thực thất bại.

### Khác
- `@modelcontextprotocol/sdk` 1.32.0. Phiên bản server và User-Agent lấy từ một hằng `SERVER_VERSION`.
