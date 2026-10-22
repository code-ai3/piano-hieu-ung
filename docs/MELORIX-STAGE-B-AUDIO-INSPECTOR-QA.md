# MELORIX — Giai đoạn B: Audio Inspector (QA notes)

## Baseline
- Technical log Google Drive được đọc và đối chiếu trước chỉnh sửa.
- GĐA WebAudio commit `0ea6216`: PASS 2 GitHub jobs; nhánh thử nghiệm.
- GĐB là Draft PR #53, nhánh `feature/melorix-stage-b-audio-inspector`, base Stage A. Không merge main/Production.

## Điều khiển thật
- Tại track, bấm biểu tượng thanh trượt **Audio Inspector** mở bảng bên phải.
- Velocity (30–180%) thay đổi lực đánh nốt MIDI; Humanize ±0–40ms deterministic, note length 40–170%, Legato 0–100%; mỗi track riêng biệt.
- Mọi điều chỉnh biểu cảm mới được tính trong `audibleNotes`, WebAudio nghe trước; MIDI gốc trong `allNotes` chưa đổi cho tới khi nhấn **Áp dụng vào MIDI**.
- A/B tắt/bật những điều chỉnh biểu cảm *chưa áp dụng* và preview Pan, nhưng không tắt CC64 hoặc nốt đã lưu.
- Volume dùng track GainNode cũ; Pan dùng StereoPannerNode giữa GainNode và ExpressiveAudioMaster, áp dụng trực tiếp WebAudio. Khi Apply, Pan được lưu thành CC10 để xuất MIDI.
- Auto Pedal Nhẹ/Tự nhiên/Ngân vang ghi CC64 của track; khi phát WebAudio, thời gian note-off thực được kéo đến lúc CC64 off, tối đa 2.5 giây mỗi nốt để không bị kẹt pedal. Dữ liệu nốt gốc không bị kéo dài trong file MIDI chỉ do pedal.
- Undo/Redo theo snapshot nốt MIDI, Pan CC10 và pedal CC64 đã áp dụng. Reset thanh kéo chỉ reset preview chứ không âm thầm xóa MIDI.
- Khi nhập MIDI mới, reset preview/Undo-Redo, nạp lại pan CC10 từ file; khi xóa track xóa bộ thông số tương ứng.

## Giới hạn phải giữ minh bạch
- WebAudio trên trình duyệt dùng piano sampled/GM; không tự chạy DLL Kontakt/NKI từ Windows.
- Kontakt VST3 hiện mới một track WASAPI live; để Kontakt dùng biểu cảm MIDI cần nhấn Apply. Pan nghe thử trên WebAudio, chưa có host audio mixer Pan đa VST3.
- Reverb/EQ nằm trong GĐD, không có trong bản GĐB.
- Giá trị slider *chưa áp dụng* là preview tạm trong phiên; muốn bảo toàn lực đánh/thời gian/pedal/Pan thì bấm Apply → xuất file .mid. Chưa có lưu file project gốc cho trạng thái UI.
- Chromium headless xác nhận WebAudio signal PCM qua analyzer/controls chứ không đo chất lượng âm nhạc từ loa của người dùng.

## QA cụ thể
- Unit test `tests/melorix-stage-b-audio-inspector.mjs`: deterministic playback, không đổi nốt track khác, velocity/duration/legato, CC64 off, A/B bypass, tích hợp Pan thật.
- Browser QA `tests/melorix-stage-a-browser-qa.mjs`: WebAudio PCM, play/pause/stop/next, mở Inspector, Velocity, A/B, Apply, Undo/Redo, Apply CC64.
- GitHub Actions `.github/workflows/melorix-web-qa.yml` phải PASS đúng HEAD và Cloudflare Preview thành công trước khi giao nghiệm thu.

## Đề nghị người dùng thử
1. Mở MIDI; ở track chọn biểu tượng Audio Inspector.
2. Bấm Play, đổi Velocity/Humanize/Legato/Length/Pan, kiểm tra tiếng đàn/trái-phải có thay đổi hay không.
3. Bấm A/B so sánh; Apply rồi Undo/Redo; tải file MIDI đã sửa và kiểm tra nốt/CC10/CC64.
4. Thử Auto Pedal 3 mức; báo nếu nốt bị đục/chồng, không nhận CC64 hay âm thanh khô.

Không CMD, không đẩy DLL/NKI, không đổi production và không mua dịch vụ.
