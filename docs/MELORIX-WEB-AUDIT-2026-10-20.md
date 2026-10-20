# MELORIX — Rà soát kỹ thuật vòng 1 (20/10/2026)

**Đích kiểm thử:** website Cloudflare Preview trước. Không thay Production hoặc đóng gói Windows khi chưa được người dùng xác nhận.

## Phạm vi đã đọc
- Nhật ký kỹ thuật chính LUNOR MUSIC, PR #34 và HEAD `bd88b87`.
- PianoView.vue: nhập MIDI/audio, playlist, track editor, Solo/Mute/Volume, âm GM/Piano/WAV/Kontakt, lịch phát, kéo timeline, Video MP4, lưu MIDI.
- MelorixPianoRoll.vue: chỉnh note, snap/quantize, velocity, undo/redo, hợp âm và phím nghe thử.
- Engine: `melorix-gm-audio.ts`, `melorix-expressive-audio.ts`, `melorix-instruments.ts`, `melorix-erhu-web-sampler.ts`, MIDI bridge, metadata/canonical GM programs, thư viện NKI, các kiểm thử dự án.
- Build Vite + TypeScript và các regression test. **Không nhầm build pass với QA nghe/nhìn trên thiết bị thật.**

## Lỗi đã sửa trên nhánh thử
| Ưu tiên | Phát hiện | Sửa |
|---|---|---|
| P1 | Lưu MIDI đã chỉnh khởi tạo mỗi track mới ở Piano (program 0) nếu người dùng chưa chọn preset mới. Tên track Guitar/Bass được giữ nhưng tiếng trên DAW khác bị sai | Giữ số chương trình General MIDI của track import, chỉ override nếu chủ động chọn preset MELORIX rõ ràng; test roundtrip Tone MIDI |
| P1 | Đổi track Bass/Drums sang preset Piano nhưng `gmVoiceForTrack` vẫn ưu tiên program/kênh gốc → có thể không nghe tiếng Piano | Thêm cờ `forcePiano` từ lựa chọn thủ công, test Bass và Drums |
| P2 | Form xuất MP4 chỉ hiển thị thông báo Piano mặc định quá ngắn, khiến người dùng dễ tưởng bản phối GM và âm lượng từng track đã vào video | Ghi rõ âm MP4 chưa là bản phối đang nghe và biểu cảm/volume chưa được nối, không âm thầm đổi bản xuất |

## Hạng mục còn thiếu / cần kiểm tra trong lượt tiếp theo
| Mức | Hạng mục | Trạng thái & phương án |
|---|---|---|
| P1 | **MP4 chưa dùng bản phối đa nhạc cụ** | Mã export hiện dựng `SplendidGrandPiano` cho mọi note dù track là Guitar, Bass, Drums và dù người dùng chỉnh Volume/biểu cảm. Cần làm offline audio mix tương đương khi phát web, test nghe đối chiếu, không chắp vá ngay |
| P2 | **Khả năng phát thực tế sau Stop/đổi MIDI nhiều lần** | Có đóng/mở AudioContext và preload sample; cần test trọn vòng Play → Pause → Resume → Stop → Next, kiểm tra voice bị đọng, im lặng hoặc tăng RAM |
| P2 | **Hiệu năng khi dùng nhiều Piano track** | Mỗi track Piano có `SplendidGrandPiano` riêng, dễ tải/giải mã nhiều sample giống nhau. Thử 8–16 track và bài hàng nghìn nốt trước khi cân nhắc shared sample cache |
| P2 | **Bản web offline và các NKI** | Tiếng GM chất lượng cao cần mạng, sample Piano có sẵn; web không chạy NKI Kontakt, các nhạc cụ chưa có WAV vẫn sử dụng GM/dự phòng; cần báo chính xác để tránh nhầm đã có full Kontakt |
| P2 | **Xuất MIDI nhiều biến thiên tempo/time signature** | Mã đang dùng BPM đầu tiên cho file đã chỉnh. Cần test tệp có tempo changes, để tránh đánh mất thông tin đặc biệt khi tạo MIDI mới |
| P2 | **Web MIDI/Kontakt so với audio mixer** | Track Volume/reverb áp dụng Web Audio nội bộ, không thay lượng tiếng phát từ ứng dụng Kontakt ngoài; cần xác định có yêu cầu riêng cho MIDI CC7/CC11 hay không |
| P3 | **UX và responsive** | Test thao tác track sidebar + Piano Roll trên màn nhỏ/điện thoại; một số nhãn/ghi chú kỹ thuật không đồng nhất tiếng Việt. Không tự ý thiết kế lại giao diện đã được duyệt |
| P3 | **Hiệu ứng và xuất hình** | So sánh nhịp nốt rơi, playhead, velocity, 16:9 / 9:16; xác minh video xuất dài không làm tràn RAM. Chưa có E2E quay màn hình sau sửa |
| P3 | **Lưu trạng thái dự án** | Track volume, chọn nhạc cụ, chế độ biểu cảm và mẫu WAV riêng hiện chưa thành một tệp project độc lập có thể mở lại hoàn chỉnh. Có thể đề xuất định dạng project sau khi ổn định âm thanh |

## Bài kiểm tra cần người dùng xác nhận trên Preview
1. Nhập một MIDI gồm Piano, Guitar, Bass và Drums; Play, từng track đều có tiếng và đúng preset. Đổi Bass sang Piano, nghe tiếng Piano mới.
2. Kéo Volume mỗi track từ 100% xuống 0% và 50%; Mute, Solo từng track, Pause/Resume và Stop.
3. Mở Piano Roll, chèn/xóa/di chuyển nốt, undo/redo, nghe preview, lưu .mid; tải .mid đó lại để kiểm tra tên và nhạc cụ không tự đổi.
4. So sánh Nguyên bản MIDI / Tự nhiên / Ấm và sâu; kiểm tra có bị vang quá mức và có mất tiếng sau khi đổi bài.
5. Trên form MP4, đọc cảnh báo tiếng Piano mặc định; tránh coi âm video là đúng bản phối cho tới khi audio offline mix được hoàn thiện.

## Những việc KHÔNG thực hiện
- Không xây lại menu, không xóa tính năng đã chạy, không thêm dịch vụ trả phí.
- Không tự merge main/Production hoặc tạo Windows Setup/Portable.
- Không khẳng định các thao tác UI/audio đã được kiểm chứng trên Chrome của người dùng. Chỉ QA đó mới xác nhận chất lượng cuối.
