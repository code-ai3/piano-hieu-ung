# MELORIX Stage 5A — Instrument Track như Cubase, nạp VST3 riêng theo track
Ngày 22/10/2026. Đã đọc và đối chiếu nhật ký kỹ thuật Drive trước khi sửa. Cơ sở: MELORIX Stage 4B Draft PR #49, HEAD f260fd6b6738a8ff4094610fb79ce2519de6934a. Không merge hoặc sửa Production/main.

## Đã thực hiện
- Ở nút + trong sidebar, menu chọn **Instrument Track (VST3)** hoặc **MIDI Track / nhạc cụ web** (giữ nguyên luồng MIDI cũ).
- Instrument Track mở hộp thoại độc lập, tự quét các VST3 thực đã cài Windows, cho chọn plugin Kontakt 8/Spire, tên track và số lượng 1–4, hiển thị MIDI input và WASAPI shared output thật nhưng không giả hỗ trợ hardware input/output chưa có.
- Khi xác nhận, Electron chỉ nạp đường dẫn plugin được phê duyệt bởi lượt scan trong cùng ứng dụng; native VST3 session đã có từ GĐ3A khởi tạo **instance riêng cho từng track ID**. Batch add bảo toàn cả những VST3 ID từ bài cũ, không đụng instance có sẵn, rollback toàn bộ instance mới nếu một LOAD lỗi, và chỉ commit các track vào MIDI UI sau khi native xác nhận componentInitialized.
- Từng track có tên + tên plugin VST3 riêng, nút **VST3** mở editor native để người dùng chọn NKI của chính track ấy. Khi xóa track, gửi UNLOAD instance tương ứng.
- Instrument Track mới không lén phát WebAudio GM/Piano mặc định khi native WASAPI chưa bật, để tránh người dùng nghe nhạc cụ giả rồi nhầm với Kontakt.
- Bộ test mới dùng esbuild để chạy thật hàm prepareInstrumentTracks với API giả lập: unique IDs, 3 instance riêng, rollback khi instance thứ hai lỗi, count validation và UI integration. CI Windows build Portable/Setup trên branch QA riêng.

## Ranh giới cần minh bạch
- **GĐ5A chỉ tạo các track/instrument VST3 RIÊNG, chưa trộn PCM nhiều VST3.** Live WASAPI host hiện chỉ có một track đang phát tại một thời điểm. Một track VST3 khác không thể phát đồng thời cùng tiếng plugin riêng; tính năng đó bắt buộc GĐ5B native multitrack mixer.
- Volume, Mute, Solo của bảng MIDI hiện tác động tốt tới WebAudio; native VST3 mixer gain/mute/solo độc lập chưa hoàn chỉnh. Không quảng cáo 'như Cubase 100%' ở bước này.
- NKI và plugin đều được lựa chọn/nghe trên Windows thực của người dùng; CI chỉ có plugin test hợp lệ, không đưa thư viện Kontakt/NKI lên repo.
- Không đổi / phá baseline GĐ3D Kontakt 8 đã được user xác nhận có tiếng, hay GĐ4B CC64 (chưa nghiệm thu tiếng sustain).
- Không CMD, không sử dụng TinyFish, không ép ghi dữ liệu lên C: của máy người dùng.

## Kế hoạch tiếp theo
- **GĐ5B**: một audio callback WASAPI chung, mỗi VST3 có processor, event queue và buffer độc lập; mix PCM và hệ số gain trên realtime thread, xử lý mute/solo, stop/panic, sample-rate, plugin lifetime; stress test 2 Kontakt instances và 4 track trước khi mở rộng.
- **GĐ5C**: native project state/plugin state riêng mỗi track, output routing, MIDI external input, ASIO nếu cần và kiểm thử âm thanh thực trên PC chủ dự án.
