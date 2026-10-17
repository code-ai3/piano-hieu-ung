# Piano Hiệu Ứng — Giai đoạn 2A: MIDI nhiều track

**Nhánh:** `feature/giai-doan-2a-midi-da-track` (từ nhánh Giai đoạn 1, không merge vào `main`)

## Đã triển khai trên mã nguồn

- Đọc các track MIDI từ `@tonejs/midi`, giữ track ID gốc, tên, số kênh và lượng nốt.
- Bộ trộn trong giao diện: bật/tắt, bật hết, tắt hết, nghe riêng từng track (solo) và chọn màu nốt theo track.
- Khi thay đổi bộ trộn, phát lại từ đầu để không còn âm thanh cũ được lên lịch trước đó.
- Đường dữ liệu nốt đã lọc được sử dụng chung cho hiển thị nốt rơi, phát Piano bằng smplr và xuất video MP4.
- Vẫn giữ nguyên velocity/thời điểm/độ dài nốt của file MIDI, không tự humanize hay đổi nhạc cụ.
- Thông báo khi file MIDI không đọc được, chuyển âm thanh thất bại hoặc khi toàn bộ track bị tắt.

## Giới hạn cần nói rõ

- Đây **không phải** công cụ tạo MIDI nhiều nhạc cụ từ audio. MIDI đã có nhiều track sẽ được nhận diện và cho điều khiển; AI Basic Pitch hiện tại có thể tạo MIDI một track.
- Tất cả track khi nghe trong ứng dụng web vẫn dùng chung tiếng Piano. Chưa phát đúng Guitar, Bass, Drum hoặc thư viện Kontakt (VST không chạy trong trình duyệt).
- Phân màu từng track áp dụng cho nốt rơi và hiệu ứng hạt, nhưng màu đèn bàn phím chung vẫn theo cài đặt Piano.
- Xuất 9:16 cho TikTok thuộc Giai đoạn 2B, chưa triển khai ở đây.

## Kiểm tra

- Đã chạy độc lập bộ test `node --experimental-strip-types tests/midi-tracks.mjs`: PASS (track name, note order, mute, color, empty MIDI).
- `tsc --noEmit --strict ...` cho `src/util/midi-tracks.ts`: PASS trong môi trường độc lập.
- Đã kiểm tra khóa dịch vi/en/zh-CN có cùng tập khóa, không thiếu khóa đang dùng.
- **Chưa được xác minh** build toàn bộ Vue/Vite, trải nghiệm trên Chrome/iPhone, âm thanh/ví dụ MP4 thực tế cho nhánh 2A. Cần xem log Cloudflare Pages.

## Thử trên Cloudflare Pages

1. Mở dự án Pages `piano-hieu-ung-test` → **Deployments**.
2. Tìm build thuộc nhánh `feature/giai-doan-2a-midi-da-track`; lấy URL **Preview** do Cloudflare cấp. Không mở URL Production của Giai đoạn 1 để đánh giá mã 2A.
3. Nhập MIDI 14-track từ Tsumugi/Cakewalk → mở **Các track MIDI** → chọn **Nghe riêng** Bass → xác nhận chỉ còn nốt Bass trên màn hình và audio Piano ở cao độ Bass.
4. Bật tất cả, thử màu cho Guitar/Strings, mở lại bài; xác nhận không lẫn note cũ.
5. Thử xuất MP4 ngắn, kiểm tra video khớp những track đã bật.
6. Nếu build lỗi, mở log và sửa trên **nhánh 2A**, không sửa `main` hay Production.

Giấy phép MIT và attribution nguồn gốc `imlishiyuan/piano-fx` được giữ nguyên.
