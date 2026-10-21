# MELORIX — Auto Pedal: 3 chế độ tự chọn (Giai đoạn 4A, nhánh thử)
Ngày 22/10/2026. Đã đọc nhật ký kỹ thuật Google Drive trước mọi thay đổi và xác minh GĐ3D Kontakt bus fix PR #47 HEAD 314dc8e. Không tác động main/production và không sửa plugin/driver của người dùng.

## Phạm vi đã lập trình
- Piano Roll có mục **Auto Pedal CC64** với đầy đủ 3 chế độ **Nhẹ nhàng / Tự nhiên / Ngân vang**, mặc định là **Tự nhiên**.
- Người dùng chủ động bấm **Xem đề xuất** để hiển thị đoạn đạp/nhả pedal trong lane thời gian; chỉ bấm **Áp dụng CC64** mới ghi CC64 cho track; có **Hoàn tác** riêng cho lần áp dụng gần nhất.
- `src/util/melorix-auto-pedal.ts` dùng heuristic dựa trên onset gần nhau thành hợp âm, khoảng lặng, biến đổi nốt bass và giới hạn độ dài pedal tương ứng từng phong cách. Đây **không phải mô hình nghe nhạc AI** hay tự động biết ý đồ biểu diễn nghệ thuật.
- `PianoView.vue` nạp CC64 sẵn có theo track qua `@tonejs/midi`, lưu theo từng track riêng, loại khi xóa track và xuất Standard MIDI File với CC64 (giá trị 0/127 đã chuẩn hóa); không đổi pitch, velocity hoặc độ dài nốt nhạc gốc.
- Lane CC64 hiển thị trạng thái lưu/đề xuất phân biệt bằng màu, đồng bộ vùng cuộn thời gian Piano Roll.
- `tests/melorix-auto-pedal.mjs` kiểm ba mode, tính tăng thời gian, on/off cân xứng, không sửa note gốc và trường hợp CC64 lỗi.
- Nút Auto Pedal không tự thay MIDI khi đổi mode hoặc đóng panel.

## Giới hạn bắt buộc nêu rõ
- **4A đề xuất CC64 + chỉnh/saving MIDI, chưa phải 4B native audio**. Host VST3 hiện có `LIVE_NOTE` nhưng chưa có `LIVE_CC` để gửi CC64 đúng VST3 MIDI Mapping/Parameter Changes tới Kontakt trong khi Play.
- Audio WebAudio tổng hợp cũng chưa xử lý sustain đúng theo CC64; không được tuyên bố "đã nghe tiếng ngân Kontakt thật" trước khi QA riêng.
- Chưa có half-pedal, CC66/67, tự động học theo audio, lựa chọn sức đạp liên tục, kiểm thử tác động ASIO hoặc playback/export native multitrack Kontakt.
- Không tự merge bản chính. Không dùng CMD, không cài thêm plugin hay ghi âm/NKI vào ổ C: trên máy người dùng.

## Tiếp theo
Giai đoạn 4B: xây đường CC64 real-time tới Kontakt VST3 và MIDI bridge, xử lý panic/reset khi Stop/Seek/Loop, rồi đo/đối chiếu âm thanh khi bật/tắt pedal trên máy Windows có Kontakt 8/NKI hợp lệ trước khi nghiệm thu.
