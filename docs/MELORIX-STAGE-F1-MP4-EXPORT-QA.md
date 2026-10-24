# MELORIX — Giai đoạn F.1: Xuất MP4/WAV an toàn và kiểm tra A/V tự động

Base: Giai đoạn E Draft PR #57 (HEAD `a21b3a8`) đã PASS CI và Cloudflare. Không merge Production. Nhánh riêng `feature/melorix-stage-f-export-validation`.

## Mục tiêu và thay đổi
1. MP4 phải có *video + AAC*, file có nội dung, audio có tín hiệu không im lặng, thời lượng stream audio/video khớp nhau trong 150ms cho fixture ngắn. Chromium CI thật tải file và dùng ffprobe / ffmpeg kiểm định chính nội dung đã xuất, thay vì chỉ kiểm lệnh render.
2. Bổ sung `src/util/melorix-stage-f-export-signal.ts` dùng chung cho xuất WAV/MP4: kiểm buffer thời lượng và kênh, loại NaN/Infinity, bắt trường hợp hoàn toàn im lặng, bảo vệ đỉnh PCM bằng phép hạ gain đồng đều để peak không vượt 0.98. Không boost âm lượng nhỏ, không thay tương quan stereo/velocity. Không giả vờ sửa được clipping đã phát sinh bên trong synthesizer trước khi render.
3. Kiểm thời lượng MIDI audio so với thời lượng frame MP4 trước encoding: chênh lệch âm thanh gốc ≤20ms và extra frame do ceil theo FPS ≤1 frame +20ms; xuất fail rõ ràng nếu sai, không ghi file lệch hình/tiếng.
4. Nút/cách lưu dự án E không đổi, MP4 tiếp tục ưu tiên captured Kontakt / âm thanh nguyên bản hơn MIDI synth, giữ per-track EQ/Reverb trên nhánh render MIDI, không áp FX lên recorded audio.
5. MP4 AAC 256kbps có thể không được WebCodecs hỗ trợ trên Linux/Chrome dù âm thanh PCM đã dựng xong. Khi native AudioEncoder không hỗ trợ cấu hình đó, chỉ lúc xuất MP4 MELORIX mới tải động bộ mã hóa AAC-LC FFmpeg/WASM chính thức `@mediabunny/aac-encoder@1.49.0` từ bundle tự host, không phụ thuộc CDN hoặc máy chủ chuyển mã. Package phiên bản 1.49.0 cùng Mediabunny đang khóa trong lock file.
6. `tests/melorix-stage-f-export.mjs` unit: normalize đỉnh, sample không hợp lệ, silence, kiểm timeline; Chromium QA export MP4 fixture 2 track có FX, kiểm H264/AAC, PCM decoded non-zero và A/V drift. GitHub Actions tự cài FFmpeg/ffprobe trên runner nếu chưa có (không yêu cầu người dùng cài CMD).

## Chứng cứ nghiệm thu
Cần `npm run build` PASS, GitHub Actions 2/2 PASS (bao gồm Chromium MP4 thật, giữ regressions A–E), Cloudflare Pages Deploy Successful đúng SHA, rồi mới có thể gọi là đã triển khai xong. Chất lượng âm nhạc chủ quan vẫn cần người nghe cuối cùng, CI không chứng minh giống biểu diễn người thật. F.2 (so sánh năng lượng FX dry/wet, stress bài dài, memory) sẽ là hạng mục riêng nếu cần.

## Giới hạn
- MP4/WebAudio codec và hỗ trợ H.264 tùy trình duyệt; không thay engine Kontakt.
- Bài dài vẫn có thể tốn RAM do OfflineAudioContext và lưu MP4 trong bộ nhớ trên trình duyệt thiếu File System Access API; chưa chứng minh stress test dài.
- Không cài CMD, TinyFish hoặc dịch vụ trả phí, không thay Production.
