# MELORIX — Chặng 5A: Danh sách kiểm tra ổn định

Phạm vi: lỗi phát MIDI, Play/Stop, ghi âm Kontakt, xuất video. Chỉ trên nhánh thử nghiệm; không thay Production.

## Tự động (npm build)
- Test tracks, Piano Roll, quantize, nhạc cụ, Kontakt, Web MIDI, kênh multitrack và căn âm thanh MP4 như baseline GĐ4.
- Test MIDI mới: nốt trùng cao độ/chung channel đang chồng thời gian không gửi Note Off sớm; nốt kề nhau được phát riêng, channel khác không bị gộp, Drum channel 10 vẫn riêng, đầu vào sai không gửi, không biến đổi dữ liệu gốc.
- Typecheck toàn bộ Vue/TS, Vite build thông qua Cloudflare.

## Kiểm tra thủ công trên Chrome/Edge Windows
1. Kết nối loopMIDI -> Kontakt 8: nhiều instrument đã nạp và gán Ch 1/2/10, có tiếng khi Play.
2. Piano Roll: bấm phím nghe được nhạc cụ đúng kênh; ngừng bấm thì ngừng tiếng.
3. Play/Pause/Stop: nốt tắt ngay cả khi đang chờ sampler tải, không tự phát lại sau Stop hoặc chuyển bài.
4. Mute/Solo và chuyển bài: không còn nốt treo; không dùng soundtrack thu từ bài trước.
5. Thu âm: bấm Dừng thu làm MIDI dừng; đóng cửa sổ lúc đang ghi không tạo bản audio ngầm.
6. Thu lại khi đã có soundtrack: bản tốt cũ còn tới khi bản mới giải mã thành công.
7. Xuất MP4: lựa chọn Kontakt dùng soundtrack đã thu/nhập; không chọn vẫn dùng piano; điều chỉnh offset được, file MP4 dài đúng thời lượng lựa chọn.

Lưu ý: Web MIDI không vận chuyển âm thanh. Thu system audio tùy quyền trình duyệt và driver ASIO; nếu im lặng có thể dùng file WAV/MP3 thu từ DAW.
