# MELORIX G.1 — Kiểm soát tính nhất quán âm thanh WebAudio ↔ WAV/MP4

## Căn cứ
Nhật ký trung tâm và PR #60 F.3, HEAD `eaaff7f` đã CI/Cloudflare PASS. Chủ dự án đánh giá F.3 “tạm tạm ổn”, yêu cầu tiếp tục G — giữ âm sắc, lực đánh, pedal và FX từ lúc nghe đến lúc xuất. Thao tác G.1 trên branch mới `feature/melorix-g1-audio-fidelity` từ F.3; không merge Production.

## Những sai khác xác định từ mã
- `ExpressiveAudioMaster` phát realtime dùng `setTargetAtTime` để chuyển mềm các mode `natural/warm/original`; nếu OfflineAudioContext tạo master t=0 và dùng cùng ramp, transient 20–40ms đầu bị thay đổi/nhỏ hơn trạng thái master đã ổn định lúc nghe. Sửa chế độ `immediate` chỉ cho offline, giữ ramp realtime khi người dùng bấm đổi mode.
- Khi xuất một track GM khác piano, `Soundfont.load` có thể lỗi/mất mạng rồi tự thay `fallbackTone` hoặc `fallbackDrum` (oscillator/noise), khiến MP4 vẫn có tiếng nhưng khác nhạc cụ. Với nguồn `user:...` hoặc Erhu thiếu WAV, bộ xuất cũng từng có thể chuyển giọng âm thầm. Sửa strict sample source **chỉ cho export trong PianoView**, báo rõ nhạc cụ và nguồn thiếu, không xuất bản sai âm sắc. Live vẫn giữ fallback tạm thời để phát nhạc khi mạng yếu; nếu live đang dùng fallback thì bản xuất strict có thể đòi tải nhạc cụ trước — không hứa một GM sample remote sẽ luôn có sẵn.
- Nhánh xuất WAV local dùng exponential release trong khi live dùng linear release; đồng bộ đoạn release 100ms dùng linear.

## Nội dung G.1 và QA
- `src/util/melorix-expressive-audio.ts`: tham số `immediate=false` cho ExpressiveAudioMaster/Mode; offline tạo mới với immediate true. Giữ nguyên realtime.
- `src/util/melorix-offline-mix.ts`: `requireExactInstrument?` để thiếu GM SoundFont, WAV user, Erhu trở thành lỗi rõ ràng nếu đang xuất; không tự thay tiếng GM giả. Giữ `requireBundledPiano` và `velocityRange:[1,127]` của F.3.
- `src/views/PianoView.vue`: bật requireExactInstrument cho WAV và MP4 bản phối MIDI, tiếp tục dùng `audibleNotes`/A-B/Pedal/FX.
- Unit: test G.1 kiểm các guard và đồng bộ module, giữ toàn bộ hồi quy A–F.3.
- Chromium: nạp dự án thật, giả lập thiếu WAV và chặn mạng GM, kiểm bộ xuất hiển thị lỗi và **không tải file WAV** thay tiếng; hồi quy F.1 MP4 thực, F.2 WAV ~3 phút, F.3 expressive A/B.
- Chỉ gọi G.1 thành công khi GitHub Actions 2/2 PASS và Cloudflare Deploy successful đúng HEAD; người dùng nghe và nghiệm thu chất lượng khi thuận tiện.

## Giới hạn
- Đây là bước đầu của G, chưa chứng minh mức độ giống PCM theo từng mẫu giữa realtime và offline trong mọi trình duyệt, mọi soundfont GM/ổ Windows, hoặc Kontakt/VST3 native. SoundFont lấy từ nguồn mạng ngoài và Web Synth là hai loại tiếng khác nhau; G.1 ưu tiên **không âm thầm đổi tiếng**. Bước G.2 hợp lý: dùng cùng cache/bundled GM sample engine (nếu tuân thủ giấy phép), so sánh signal RMS/spectral envelope từng loại trên cả realtime và offline.
- Không yêu cầu CMD người dùng, TinyFish hoặc dịch vụ phí. Không thay main/production.
