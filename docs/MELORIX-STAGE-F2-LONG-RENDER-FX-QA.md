# MELORIX — Giai đoạn F.2: Bài dài, RAM, kiểm chứng âm thanh FX A/B

**Nền kỹ thuật:** GĐF.1 `0ccf6f8`, GitHub Actions #40070698296 PASS 2/2, PR #58 Draft. Triển khai F.2 trên nhánh `feature/melorix-stage-f2-long-render-fx-qa`, kế thừa F.1; không merge Main/Production.

## Thay đổi
- `src/util/melorix-stage-f2-export-budget.ts`: dự tính bộ nhớ **trước** `OfflineAudioContext` cho MP4/WAV theo sample rate, số kênh, thời lượng, bản nén MP4 trong RAM và hỗ trợ File System Access stream-to-disk; giới hạn bảo thủ dựa trên `navigator.deviceMemory` nếu trình duyệt có công bố (nếu không mặc định 4GB). Nếu vượt ngưỡng sẽ **chặn trước** và hướng dẫn chọn bản 15/30s hoặc máy nhiều RAM, tránh treo/OOM. Đây là *ước tính an toàn*, không đo chính xác bộ nhớ card đồ họa, codec WASM hoặc hệ điều hành; hỗ trợ tắt File System API trên các trình duyệt vẫn được tính đúng là xuất vào RAM.
- `PianoView.vue`: tích hợp budget guard cho xuất WAV và MP4 trước khi render, giữ nguyên FX, âm thanh nguồn gốc / Kontakt captured, MIDI engine, UI các bước A–F.1.
- `tests/melorix-stage-f2-export.mjs`: so giới hạn 30s, 3m, 4m, 20m, MP4 streamed/unstreamed, reject thời lượng sai; bảo đảm đã nối guard vào 2 đường xuất.
- `tests/melorix-stage-f2-browser-qa.mjs`: Chrom(e/ium) real offline WAV hai-track dùng WebAudio synth tự sinh, không cần CDN mẫu; 3 lần xuất WAV cùng bài với FX ON/OFF, phân tích RMS/peak/tương quan chênh lệch waveform (đòi chênh lệch tương đối >2.5%). Sau đó xuất **bài gần 3 phút thực tế** (~179 giây) có 150 nốt ở hai track, kiểm nội dung WAV và RMS >0, peak <0.981, báo thời gian render, đỉnh Chrome-process RSS (gồm nhiều tiến trình Chrome, không phải bộ nhớ riêng tab) và JS heap Chromium. Giới hạn QA RSS tổng Chrome <2800 MiB để phát hiện bất thường lớn trên GitHub runner. Số liệu này không khẳng định máy Windows cụ thể đạt cùng mức.
- CI thêm `test:stage-f2` vào build; browser job chạy F2 riêng sau Chromium A–F1, được kiểm tra cùng check-run. Không thay đổi file midi project format .melorix.

## Giới hạn và điều kiện nghiệm thu
- Thử dài gần 3 phút WAV **không đồng nghĩa** MP4 đủ dài, hàng ngàn track, video 4K hoặc 20 phút được bảo đảm trên mọi PC; F2 chặn các cấu hình ước tính quá nặng và mới xác nhận qua một fixture. Chưa có streaming/chunked OfflineAudioContext, chưa đo Windows RAM máy người dùng, chưa có so sánh chủ quan bằng tai.
- FX A/B chỉ khác waveform PCM khi các điều khiển FX được bật, không khẳng định đẹp hơn/gần biểu diễn con người.
- Cần GitHub CI unit+Vite+Chromium 2/2 PASS và Cloudflare Pages Deploy successful **đúng HEAD** mới giao Preview. PR Draft; không hợp nhất hoặc thay Production khi chưa duyệt, không yêu cầu CMD Windows/TinyFish/dịch vụ phí.
