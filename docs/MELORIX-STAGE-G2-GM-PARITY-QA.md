# MELORIX G.2 — Shared FluidR3 GM sample buffers và đo parity tín hiệu thật

## Căn cứ & mục đích
Người dùng duyệt G.2 sau G.1 PASS và lời hứa: đồng nhất GM source, đo âm thanh nghe trực tiếp vs khi xuất, tránh SoundFont bị chuyển tiếng.
Đã đọc nhật ký kỹ thuật trung tâm, PR #61 HEAD a3de4a3, code GmWebAudio, offline-mix, PianoView, Chrome QA. G.2 phát triển từ G.1 tại branch feature/melorix-g2-gm-source-parity, không merge production.

## Thực hiện
- src/util/melorix-gm-sample-cache.ts: smplr SampleLoader được lưu một lần cho từng live AudioContext trong WeakMap; CacheStorage của smplr được tái sử dụng nếu trình duyệt hỗ trợ Cache API an toàn. Không đưa mẫu FluidR3 vào repository; việc sử dụng FluidR3 GM tiếp tục yêu cầu attribution CC BY 3.0, không tuyên bố quyền sở hữu sample.
- GmWebAudio live pass cùng loader/storage cho FluidR3 GM Soundfont; có whenReady() để bài kiểm thử phát sau khi đã load thật, không đo tiếng fallback.
- offline WAV/MP4 cũng pass cùng bộ loader khi đã có live audio context; khi chưa phát thì dùng loader riêng + cache storage cho cùng nguồn. Không đổi kit FluidR3_GM, nhạc cụ GM preset hoặc fallback policy G.1.
- src/util/melorix-g2-parity-metrics.ts: fingerprint PCM Float32 (RMS, peak, onset, RMS attack/tail, DFT 512-point centroid và tỷ lệ năng lượng low/mid/high), dùng để so 2 tín hiệu không bị lệch bởi thời điểm AudioContext khởi đầu.
- Unit test kiểm bắt thay đổi spectral/attack, invariant pha silent lead và cấu hình shared loader.
- Browser Chromium test chạy Vite development server riêng: dùng GM violin sampled FluidR3 loaded thật qua GmWebAudio realtime, ghi PCM với ScriptProcessor (chỉ trong test), renderMultiTrackAudio offline cùng note/kit/decoded loader, phân tích onset/tail/RMS/spectrum 2 đường, xác nhận không dùng fallback. Bài này cần truy cập remote FluidR3 GM qua internet. Không đánh giá kiểu “âm nhạc nghe hay hơn” chỉ từ RMS.
- Regression A–G.1, MP4 H264/AAC, WAV 2:59 và FX per-track vẫn chạy nguyên.

## Gate trước giao bản
GitHub CI 2/2 SUCCESS + Cloudflare Pages check success đúng HEAD, giữ PR Draft và không merge Main/Production. Nếu GM fixture từ mạng ngoài không tải được, test FAIL và cần xử lý rõ (không skip hoặc giả vờ PASS). Quality UAT bằng tai của người dùng vẫn là bước riêng. Không yêu cầu CMD, TinyFish hay phát sinh phí mới.
