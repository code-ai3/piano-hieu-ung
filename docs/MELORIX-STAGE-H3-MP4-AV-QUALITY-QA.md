# MELORIX H.3 — Kiểm thử chất lượng MP4: nốt rơi, WAV parity, pan và đồng bộ A/V

## Cơ sở đã đối chiếu
- Technical project log của LUNOR MUSIC, mục H.2 FINAL (25/10/2026): H.2 commit `1c2a711117bb1abafd68806f4cfc496060cf1e2a`, Draft PR #65, GitHub Actions 4/4 PASS và Cloudflare SUCCESS. Đây là baseline H.3, **không merge Main/Production**.
- H.2 xác minh MP4 3/5 phút, 1920×1080 30 FPS H.264/AAC, file thực, A/V duration drift ~46 ms trên Ubuntu CI với simulated 4GB browser hint; chưa chứng minh nốt rơi không bị đứng hình hoặc so AAC vs WAV cùng project.
- Đã đọc `PianoView.vue`: MP4 `exportVideo()` dùng `renderEditedMidiMix()` làm âm thanh, `draw()` + chỉ mục H.2 làm hình; xuất WAV cũng gọi `renderEditedMidiMix()` nên có thể kiểm tra parity hai bản xuất từ cùng một project.
- Đã đọc F.3 audio parity, H.1 hủy và F.2 memory budget. Không đổi engine GM, biểu cảm B/C, CC64, audio FX, MP4 muxer, source PianoView, WAV hay UI đang được nghiệm thu.

## H.3A — Nốt rơi và hình/video
- Browser QA mới `tests/melorix-stage-h3-mp4-av-browser-qa.mjs` chạy Playwright Chromium Vite production build.
- Tạo project thực gồm hai nhạc cụ GM, 6 nốt MIDI trong ~13.3 giây; tải .melorix qua UI như người dùng và xuất MP4 thật (1920×1080 30FPS).
- Dùng ffprobe đọc codec, fps, thời lượng và đếm số **frame decode được**. Dùng ffmpeg giải mã 6 frame các đoạn đầu/giữa/cuối, thu nhỏ về grayscale 96×54 rồi so số pixel/thay đổi độ sáng; chặn video đứng hình hoặc piano/nốt rơi biến mất.
- Đây là kiểm tra chuyển động định lượng theo fixture, **không thay thế việc người dùng xem trực tiếp độ đẹp/mượt bằng mắt**.

## H.3B — Chất lượng âm thanh xuất
- Xuất WAV mix FX và MP4 AAC bằng **cùng** project. Giải mã PCM stereo 16 kHz bằng ffmpeg; đo correlation envelope RMS theo cửa sổ 100 ms, cho phép sai lệch AAC ±200 ms, yêu cầu correlation >0.85.
- 2 track thử: Synth Bass pan trái −65 và Music Box pan phải +65, velocity khác nhau, FX riêng và CC64 ở track Music Box. Kiểm tra năng lượng kênh trái/phải ở những đoạn mỗi track solo theo thời gian để chặn mất pan trong MP4.
- Nếu test PASS chỉ chứng minh WAV/MP4 tương quan trên fixture, **không** khẳng định mọi bản nhạc GM, mọi Kontakt NKI, sampled piano, loa Windows hoặc cảm thụ âm thanh là 100% giống nhau.
- Native Kontakt/VST3 chưa thể qua trình duyệt; trường hợp phải thu/import Kontakt sẽ cần nghiệm thu thật ở giai đoạn Desktop.

## H.3C — Đồng bộ hình/tiếng
- Đọc duration video/audio và drift giới hạn dưới 260 ms (như H.2), xác minh onset nốt đầu trong cửa sổ MIDI thực.
- Bổ sung đếm frame decode được, không chỉ đọc metadata 30 FPS.
- Tất cả assertions chạy trên **MP4/WAV đã tải được**, không dùng mock hoặc chỉ kiểm tra source string.

## H.3D / H.3E — Cổng nghiệm thu còn chờ
- Kiểm xuất MP4 thực trên **laptop Windows**, tua 0%/50%/100%, nghe bản WAV và MP4 cùng bài, kiểm note glow/pedal/FX nhiều track, kiểm thời gian xuất/RAM/chất lượng loa.
- Không coi GitHub runner Linux là laptop HP Windows; simulated navigator.deviceMemory=4 chỉ mô phỏng API hint.
- Không có live Kontakt/VST3/Web MIDI trong Chromium. Chưa tự phát hành Desktop, chưa sửa Production.
- H.3A–C chỉ PASS khi `audio-chromium` run QA mới thực sự PASS và PR head Cloudflare SUCCESS đúng SHA; H.3D/E tiếp tục UAT HOLD cho tới khi thử Windows.

## Chính sách triển khai
Branch `feature/melorix-h3-mp4-av-fidelity` tách từ H.2, PR ở dạng Draft, không merge main, không chạy workflow thủ công, không dùng TinyFish/CMD Windows/dịch vụ phí. Khi test fail, giữ trạng thái FAIL và sửa đúng nguồn, không bỏ ngưỡng để nhận PASS.
