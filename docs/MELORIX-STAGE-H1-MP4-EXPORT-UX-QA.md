# MELORIX H.1 — Tiến độ xuất MP4 trung thực và khả năng hủy an toàn

**Nền:** G.3 Draft PR #63, HEAD `48d06d5fa80c30bc104837741e3d9de7aa284ade`, GitHub Actions 2/2 + Cloudflare check PASS. Trước sửa đã đọc nhật ký MELORIX trung tâm và mã PianoView, offline-mix, memory budget F.2 và browser QA. Nhánh `feature/melorix-h1-mp4-export-control`, không merge Main/Production.

## Vấn đề thực tế
Người dùng trước đó đã gặp xuất MP4 đứng **0% hơn một phút** khi đang “Đang dựng âm thanh”, rồi sau đó MP4 hoàn thành. Bởi `exportProgress` chỉ được cập nhật trong vòng lặp khung hình, còn `renderEditedMidiMix()`, `decodeOriginalAudio()` và bộ mã hóa AAC không có callbacks tiến độ. Không được giả lập phần trăm audio. Modal X có thể đóng khiến người dùng không biết export còn đang chạy, không có nút hủy.

## Thực hiện
- `src/views/PianoView.vue`: 5 trạng thái `preparing / audio / encoding / rendering / finalizing`. Trước khi vào mỗi công đoạn chuyển nhãn thông báo rõ tên công việc. Bước âm thanh **không hiện % giả**, thay bằng progress indeterminate và **thời gian đã xử lý thực** từ đồng hồ `performance.now`. Trong giai đoạn video `rendering` mới hiện phần trăm `frame/totalFrames` và ETA tính từ tốc độ encode thực. Khi đóng file/hoàn tất ghi có trạng thái finalizing rõ.
- Thêm **Hủy xuất MP4** và cờ `exportCancelRequested`, kiểm tra tại các ranh giới sau mỗi thao tác async (sau render âm thanh, sau output.start, mỗi khối AAC, mỗi frame, trước finalize và trước ghi file/download). Khi hủy, không tải MP4 chưa hoàn thiện, File System Access writer `abort()` nếu có. Giải phóng từng `AudioSample` ở `finally` cả khi hủy.
- Chú thích công khai: bước dựng OfflineAudioContext **không thể hủy ngay** bằng API này; nếu người dùng bấm Hủy khi đang dựng âm thanh, yêu cầu được ghi nhận và có hiệu lực ngay sau khi promise render hiện tại kết thúc; không giả vờ đã dừng DSP nền lập tức. Nút X/backdrop không được âm thầm che phiên export đang chạy. Bảo toàn trạng thái timeline sau thành công/thất bại/hủy. Bộ đếm elapsed setInterval được clear trong finally.
- Giữ nguyên H.0/F1/F2 memory guard, nguồn audio Konzert/Kontakt, WAV, nguồn GM, pedal, FX và codec H264/AAC.

## QA
- `tests/melorix-stage-h1-export.mjs`: kiểm trạng thái thực, không hiển thị % giả, các điểm cancellation, xử lý writer và timer.
- `tests/melorix-stage-a-browser-qa.mjs`: giữ kiểm thử MP4 H264/AAC, FFmpeg audio không im lặng, A/V sync và WAV/Project regressions; sau đó giả lập OfflineAudioContext render bị kéo dài 2.2 giây, bấm Hủy khi đang ở pha audio, xác nhận UI không báo 0% giả, hiển thị yêu cầu hủy, không tải file MP4 và thông báo đã hủy rõ.
- `npm run build` thêm `test:stage-h1`, GitHub Actions workflow cho nhánh H1.
- Nghiệm thu khi CI 2/2 PASS, Cloudflare Pages Deploy success đúng SHA, Draft PR riêng.

## Giới hạn và bước tiếp
H1 là cải thiện UX, khả năng hủy tại ranh giới, **chưa** phải chia block WebAudio dài để đo % hoặc hủy ngay trong OfflineAudioContext. Không khẳng định đã giảm RAM so với F2, chưa stress MP4 3–5 phút ở 1080p; H.2 tập trung đo file MP4 dài, thời gian, peak RSS trên runner, lỗi khi hết RAM, and timeout watchdog. Không đụng Production, TinyFish, CMD hay chi phí trả phí.
