# Piano Hiệu Ứng — Giai đoạn 1

Ứng dụng chuyển MIDI thành video nốt rơi, hỗ trợ nhận diện âm thanh qua Spotify Basic Pitch và xuất MP4 trong trình duyệt. Đây là nhánh thử nghiệm, chưa triển khai production.

## Khởi chạy ở môi trường có Node.js

- Cài phụ thuộc từ lockfile: `npm ci`
- Chạy kiểm tra build: `npm run build`
- Chạy dev: `npm run dev`

## Tính năng đang có

- Giao diện tiếng Việt mặc định, đổi sang English/中文 và lưu lựa chọn.
- Nhập MIDI hoặc âm thanh; xem nốt rơi; thay hiệu ứng và hình nền.
- Xuất MP4 ngang 1920×1080, 30 FPS; định dạng dọc 9:16 chưa thực hiện ở giai đoạn này.
- Khi tải MIDI/audio/xuất MP4 lỗi, hiển thị thông báo thay vì im lặng.

## Kiểm tra trước khi merge

1. Build TypeScript + Vite thành công.
2. Thử các bản dịch, nhập MIDI, âm thanh, xuất MP4 cả có tiếng.
3. Kiểm tra Mobile/Chrome; tránh sai lệch nốt/âm thanh.
4. Chỉ merge hoặc triển khai production khi chủ dự án duyệt.

Nguồn: fork dự án [imlishiyuan/piano-fx](https://github.com/imlishiyuan/piano-fx). Giữ nguyên giấy phép MIT và thông tin tác giả gốc.
