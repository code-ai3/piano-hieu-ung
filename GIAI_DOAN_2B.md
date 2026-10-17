# Giai đoạn 2B — Video dọc TikTok (9:16)

**Nhánh:** `feature/giai-doan-2b-video-tiktok-9x16`. Tạo từ nhánh 2A; chưa merge Giai đoạn 1 hoặc 2A vào `main`.

## Tính năng mới

1. Nút **Xuất video** mở hai preset: **TikTok/Shorts 9:16** (1080×1920, 30 FPS) và **YouTube 16:9** (1920×1080, 30 FPS).
2. **Preview theo đúng tỷ lệ khung xuất**: Canvas xem trước đổi từ ngang thành dọc ngay khi chọn preset (không chỉ đổi số pixel khi xuất).
3. Video dọc giữ bàn phím ở khoảng **20% chiều cao** để tránh chèn kín hình, có thời gian nốt rơi 5 giây thay cho 4 giây ngang.
4. Dải phím dọc mặc định **tự chọn 4 quãng tám** dựa trên nhiều nốt nhất trong MIDI, tăng kích thước phím khi quay dọc. Người dùng có thể chọn C1–B4, C2–B5, C3–B6, C4–B7 hoặc tất cả nốt.
5. Nếu có nốt nằm ngoài dải phím dọc đang chọn, hiển thị cảnh báo số lượng nốt. Chọn **Hiển thị tất cả** nếu không muốn mất nốt ngoài khung (đổi lại phím nhỏ).
6. Đầu ra MP4 dùng chung bộ `draw` với live preview và vẫn dựa trên bộ lọc track từ 2A; không đụng vào thời điểm, độ dài hoặc velocity.
7. Khi xuất video, tạm dừng playback để tránh cạnh tranh thời gian; khôi phục vị trí xem trước khi hoàn tất hoặc khi lỗi.

## Kiểm tra tự động

- `npm run test:video`: các kích thước, chọn 4 quãng tám, thủ công/toàn bộ.
- `npm run test:tracks`: hồi quy 2A (bật/tắt track, màu, thứ tự nốt).
- `npm run build`: TypeScript + Vite/Cloudflare CI.

## Kiểm thử thủ công trước khi nghiệm thu

- Cloudflare Preview của **nhánh 2B** báo build success. Không xem nhầm Production Giai đoạn 1.
- Mở Chrome PC, chọn **Xuất video → TikTok/Shorts (9:16)**, kiểm tra preview dọc và thông số 1080×1920.
- Nhập MIDI từ Cakewalk/Tsumugi, chọn vài track, kiểm tra cảnh báo ngoài khung và chế độ *Hiển thị tất cả*.
- Xuất một bài MIDI **ngắn 10–20 giây**, tải MP4 và dùng Properties kiểm tra độ phân giải **1080×1920**, có âm thanh, khớp nốt.
- Chuyển 16:9, xuất lại: **1920×1080**. Nếu lỗi, lưu log trình duyệt/Cloudflare.
- Thử trên Chrome/iPhone (nếu trình duyệt không hỗ trợ encoder hoặc lưu tệp thì cần báo rõ). Tránh bắt đầu với bài dài 3–5 phút do mã hóa 1080p có thể tiêu tốn thời gian và RAM.

## Phạm vi chưa làm

- AI audio→MIDI kết hợp NeuralNote sâu, kết nối VST/Kontakt và humanize MIDI chưa thuộc 2B.
- Hiệu ứng velocity nâng cao là 2C; QA xuất MP4 chuyên sâu là 2D.
- Chưa xác nhận chất lượng phát/đầu ra video thật trước khi kiểm thử trên browser.

## Nguyên tắc

Ưu tiên miễn phí, không CMD trên máy người dùng, không GitHub Actions, không đổi Production và không merge `main` khi chưa duyệt. Giữ MIT License và attribution nguồn gốc `imlishiyuan/piano-fx`.
