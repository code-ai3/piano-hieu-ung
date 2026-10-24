# MELORIX F.3 — Khắc phục bản MP4/WAV nghe khác với lúc phát trực tiếp

## Phát hiện từ mã nguồn và phản hồi chủ dự án
Chủ dự án thử bản F.2 https://c4481e47.piano-hieu-ung-test.pages.dev và báo âm thanh sau xuất MP4 không còn hay như lúc nghe trên web. Đây là lỗi parity chức năng, không thể coi F.2 nghiệm thu về chất lượng nhạc dù CI F.2 2/2 PASS.

Qua so sánh hai pipeline:
- WebAudio playback: `audibleNotes` = `audioInspectorPreview(notes, performance settings, A/B, pedal)` rồi `pianoFeelPreview` (Stage B/C). Khi phát còn dùng `expressedVelocity` master.
- Export Stage E/F.2: `renderEditedMidiMix` truyền `notes.value` bản MIDI gốc vào offline synth, **mất các điều chỉnh biểu cảm chưa commit đang được nghe**: velocity, human timing, legato, note length, sustain pedal và C piano-feel (Stage B/C).
- Mẫu piano realtime: SplendidGrandPiano với `volume:100` và `decayTime:.65`; Offline thiếu hai thuộc tính đó, gây sai envelope/mức mẫu.
- Offline piano khi không tải sample sẽ thay bằng Soundfont/oscillator dự phòng. MP4 có tiếng không đồng nghĩa giữ nguyên âm sắc; nếu người dùng đang nghe native Kontakt/VST3/Web MIDI, Offline WebAudio không phát được cùng plugin.

## F.3 sửa
- `src/views/PianoView.vue`: dùng `audibleNotes.value` làm nguồn offline MIDI/WAV/MP4; mang đúng preview B.2/C A/B của từng track. Ngăn xuất offline một bản phối chứa track native hoặc external-only thay bằng GM piano; hướng dẫn dùng bản thu âm Kontakt trong tính năng xuất MP4.
- `src/util/melorix-offline-mix.ts`: đồng nhất `volume:100, decayTime:.65` với piano sampled realtime. Nếu đường xuất yêu cầu piano thật mà sample load thất bại, dừng với thông báo tiếng Việt thay vì âm thầm thay bằng âm thanh tổng hợp kém chất lượng. Cho piano tối đa 20s load trước khi thất bại; không hứa browser nào cũng tải được trong 20s.
- `tests/melorix-stage-f3-playback-export.mjs`: kiểm B/C/Pedal tác động note preview, track isolation, A/B bypass, code wiring trong offline renderer và strict sample/native guards.
- `tests/melorix-stage-f2-browser-qa.mjs`: bổ sung export WAV thực tế khi Velocity 175% chỉ đang preview (không Apply MIDI), đo RMS lớn hơn WAV gốc, bật A/B original phải đưa RMS về gần gốc, tránh tái diễn mất biểu cảm sau export. Giữ F.1 MP4 thật và F.2 WAV dài/FX khác biệt.
- CI `npm run build` thêm unit `test:stage-f3`; workflow chạy nhánh F.3. Chỉ giao immutable Preview khi GitHub Actions 2/2 PASS + Cloudflare Pages Deploy Success đúng HEAD.

## Hạn chế không che giấu
Bản xuất MIDI synth vẫn không tương đương hoàn toàn với bản phát native Kontakt, bản ghi âm gốc hoặc mọi GM soundfont nếu chúng không được tải đầy đủ. Bản F.3 **ngăn âm thầm thay nhạc cụ** và đồng bộ MIDI expression/piano sample; không cam kết âm sắc trùng 100% trên mọi thiết bị khi chưa so sánh PCM hai nguồn. Trường hợp GM remote soundfont fallback vẫn có thể khác tiếng realtime; cần lựa chọn xuất từ audio recording khi muốn giống hoàn toàn.
Chỉ sửa nhánh thử nghiệm mới, không merge Production, không dùng CMD Windows hoặc dịch vụ phí/TinyFish.
