# MELORIX Desktop cho Windows 10/11 (x64)

MELORIX Desktop đóng gói **mã Vue/Vite hiện có** trong cửa sổ Electron, không phải lối tắt tới Cloudflare. Nhánh thử phát triển riêng, chưa phát hành Production.

## Hai bản Windows
- **MELORIX-Portable-1.0.0-x64.exe**: chạy trực tiếp, không cần trình cài đặt.
- **MELORIX-Setup-1.0.0-x64.exe**: cài đặt theo hướng dẫn, có lựa chọn vị trí và biểu tượng ứng dụng.

File do Windows runner tạo ở thư mục `release/`. Sau khi job thành công, tải ZIP `MELORIX-Windows-x64` tại tab **Actions** của GitHub và giải nén để có 2 file .exe.

## Những gì hoạt động
- Mở trên máy không cần Chrome hoặc kết nối tới trang web MELORIX.
- Piano Roll, phát MIDI đa track, GM sample khi có mạng, trống/synth **dự phòng offline**, Volume riêng từng track, chỉnh nốt, hiệu ứng nốt rơi.
- Các tệp `public/samples` (~45 MB) hiện có và catalog nhạc cụ được đóng gói trong ứng dụng.
- Các file MIDI nhập từ ổ đĩa chỉ ở máy người dùng. Dữ liệu browser/IndexedDB nằm trong hồ sơ MELORIX Desktop riêng (không tự dùng chung với Chrome).
- Web MIDI có thể dùng với ứng dụng ngoài nếu hệ thống/cổng ảo hỗ trợ, nhưng **Kontakt .NKI không chạy trong Electron**.

## Giới hạn cần biết
- Bộ General MIDI Soundfont nguồn FluidR3_GM vẫn tải qua Internet; khi offline hoặc tải thất bại, MELORIX dùng tiếng Web Audio dự phòng. Không quảng cáo đây là đủ 128 nhạc cụ sample offline hay tiếng NKI nguyên bản.
- File .exe trong CI **chưa được ký số**. Windows SmartScreen có thể cảnh báo phần mềm chưa được nhận diện.
- Công cụ xuất MP4 dùng các API trình duyệt/Electron. Phải thử xuất video trong bản Windows trước khi coi là đã nghiệm thu.
- File NSIS/Portable chỉ chạy trên **Windows x64**. Không ghi đè vào phiên bản web hiện tại; không merge main trước khi thử.
- Chức năng tự cập nhật chưa có. Muốn bản mới phải tải lại .exe.

## Quy trình đóng gói không cần CMD trên máy của bạn
1. GitHub Actions, workflow **MELORIX Windows Desktop** chạy tự động sau commit lên nhánh `feature/melorix-desktop-electron`. Có thể khởi chạy thủ công qua `workflow_dispatch` khi workflow đã có trên nhánh mặc định.
2. Runner Windows sử dụng Node.js 22, `npm ci`, cài tạm `electron-builder@26.0.12` không sửa lockfile, chạy `npm run build` (toàn bộ test và type check), sau đó `npm run desktop:build:win`.
3. Kiểm tra có hai file .exe, upload thành artifact `MELORIX-Windows-x64`.
4. Nghiệm thu: mở Portable, nhập MIDI, bấm Play, test trống, kéo Volume các track, dừng/tua, thoát và mở lại; thử Setup và xuất MP4.
5. Khi có kết quả nghiệm thu đạt, mới cân nhắc bản phát hành chính thức.

## Các tệp chính
- `desktop/main.cjs`: cửa sổ Electron và protocol `melorix://app` đọc tệp đã đóng gói (không mở website bên ngoài).
- `electron-builder.yml`: config NSIS và Portable x64.
- `desktop/make_windows_icon.py`: sinh icon .ico nhiều kích thước (có 256×256) từ hình thương hiệu MELORIX, phục vụ Windows builder.
- `.github/workflows/melorix-desktop-windows.yml`: tự động build Windows.
- `tests/melorix-desktop.mjs`: kiểm tra bảo mật scheme và cấu hình đóng gói.

Về bảo mật: Electron renderer không được quyền truy cập Node.js (`nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`). Mọi điều hướng ra bên ngoài ứng dụng được mở trong browser hệ thống; không bật SysEx mặc định. Source không có dịch vụ nền, không yêu cầu quyền quản trị.
