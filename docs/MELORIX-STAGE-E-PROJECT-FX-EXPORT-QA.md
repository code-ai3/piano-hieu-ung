# MELORIX — Giai đoạn E: Lưu dự án + xuất âm thanh với FX

Nền: MELORIX D (Draft PR #56, commit 7310195) đã được chủ dự án đồng ý, GitHub QA và Cloudflare Preview PASS. Đây là Stage E kế thừa D bằng nhánh thử nghiệm riêng, không merge Production.

## Tính năng
1. Tệp > Lưu dự án (.melorix): tạo JSON portable, lưu tên bài, BPM, track ID/tên/màu/trạng thái bật tắt, nốt MIDI (đã chỉnh), chương trình GM, tên preset nhạc cụ, Volume, Pan đã commit, Pedal CC64, biểu cảm B/C nghe thử, biểu cảm master, EQ/Reverb từng track (bao gồm giá trị draft đang nghe). Giới hạn nhập 32 MB, tối đa 128 track/200.000 nốt, kiểm tra dữ liệu trước khi sửa phiên.
2. Tệp > Mở dự án (.melorix): chọn tệp trên PC, khôi phục các thuộc tính trên và MIDI playlist hiện tại, tái tạo audio graph trên Play. Tệp dự án không nhúng WAV/MP3 âm thanh gốc, NKI, DLL/VST3 hoặc blob sample; những thư viện bên ngoài cần có lại trên máy. Lưu MIDI .mid thông thường vẫn chỉ lưu MIDI/CC không lưu Audio FX.
3. Xuất WAV bản phối (FX): render OfflineAudioContext bản phối MIDI bằng nhạc cụ WebAudio và TrackFxRack giống realtime, xuất PCM16 stereo/mono. Không dùng dịch vụ trả phí, giới hạn 20 phút trong bước này.
4. Xuất MP4: phần âm thanh bản phối MIDI cũng dùng TrackFxRack từng track (EQ, Reverb Wet/Dry, room length), cùng track Pan và volume. Không can thiệp hình ảnh nốt rơi; các bài chọn **âm thanh bản thu gốc** hoặc **Kontakt recorded audio** vẫn ưu tiên nguồn thu gốc và **không** đi qua FX của các track MIDI, được giải thích minh bạch.
5. Những FX đang nghe trên Inspector được áp dụng trong xuất WAV/MP4 qua fxPreviewByTrack > fxSavedByTrack; A/B bypass mới được giữ. EQ/Reverb không chuyển được vào file .mid; đây là DSP âm thanh, không phải sự kiện MIDI.

## Kiểm thử
- npm run test:stage-e: validation, reject file corrupt, MIDI two-track + FX roundtrip, WAV RIFF PCM16 header/sample, đường offline FX.
- npm run build: hồi quy A–D, type check, Vite.
- Browser QA: save file .melorix từ UI, đọc file và nạp lại, so từng track FX; kiểm không làm biến đổi MIDI/track khác. Điều kiện giao Preview: GitHub Actions 2/2 PASS **và** Cloudflare Pages Deploy successful đúng commit hiện tại; nghe trực tiếp do người dùng xác nhận mới xem như nghiệm thu.

## Giới hạn và bước sau
- Dự án chưa đóng gói bản thu WAV/MP3 hoặc thư viện Kontakt, cũng chưa lưu video background hay trạng thái desktop host/DAW arrangement khác. Không hứa biến MELORIX thành DAW đầy đủ chỉ từ giai đoạn này.
- Không có native VST3 host FX trong browser; nếu preset không có sample trên máy, offline renderer có thể dùng GM fallback và báo rõ. Reverb tail có thể bị cắt ở thời điểm kết thúc thời lượng export.
- WAV/MP4 là tín hiệu WebAudio offline, không áp lên âm thanh captured Kontakt/original audio đang được ưu tiên.

Không CMD người dùng, không TinyFish, không sử dụng dịch vụ phí, không merge Main/Production.
