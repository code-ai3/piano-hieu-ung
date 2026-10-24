# MELORIX H.3D–E — Windows QA + nghiệm thu nhạc thật

Ngày: 25/10/2026. Tách từ H.3A–C Draft PR #66 (HEAD f508d49595afbc2557579be6c482f87d58c7917c) đã CI Chromium Linux PASS và Cloudflare SUCCESS. Không merge Main/Production.

## H.3D.1 — Windows GitHub Runner (kiểm thử từ xa khả thi)
- `.github/workflows/melorix-h3-windows-qa.yml` chạy riêng khi push branch `feature/melorix-h3de-windows-real-uat` và PR về nhánh H.3, không cần workflow dispatch thủ công.
- Sử dụng GitHub-hosted `windows-2022`, Node 22, chính mã MELORIX/Vite, Chrome/Edge đã có ở runner, FFmpeg/ffprobe có thật, Playwright QA driver tạm thời.
- `tests/melorix-stage-h3-mp4-av-browser-qa.mjs` đã xử lý đường dẫn browser Windows và FFmpeg trong PATH. Bài test **có xuất file WAV/MP4 thật** theo project mẫu hai track với FX, pan, velocity và CC64: H.264/AAC, 1920x1080@30, đếm frame giải mã được, 6 đoạn khung hình chuyển động, so RMS PCM WAV/AAC, pan và onset.
- Mọi tiêu chí H3A–C cũ vẫn giữ nguyên, không hạ ngưỡng. Nếu Windows CI FAIL phải xem log xử lý, KHÔNG được đánh dấu PASS hay bỏ check.
- Đây là Windows Server chạy từ cloud, **không phải laptop HP 240 G8**, không dùng driver ASIO/soundcard của chủ dự án và không chứng minh Native Kontakt 8.

## H.3D.2–E — User Acceptance Test trên chính Windows/laptop
- Link QA Web trên branch sau khi Cloudflare deploy thật: `/h3-windows-uat.html` (không dùng bản cũ làm kết quả).
- Tại MELORIX Web trên cùng branch, người dùng nhập một bản nhạc MIDI hoặc .melorix **do chính họ chọn**, dài 3–5 phút, có ít nhất hai track, velocity khác nhau, một track có CC64, hai FX/Pan/Volume riêng.
- Xuất cả `WAV bản phối (FX)` và `MP4 1920×1080/30FPS` từ cùng project, KHÔNG đổi thiết lập giữa hai lần xuất. Nếu đang dùng âm thanh Kontakt 8 thật, phải thu/import audio Kontakt vào MELORIX trước khi export MP4 và ghi nhận đó là captured audio (không tự coi Web đang host Kontakt VST3).
- Mở trang QA; chọn file WAV và MP4 từ laptop (file **không upload lên cloud**); trang hiển thị duration, kích thước, độ lệch thời lượng theo metadata. Tua đầu, giữa, gần cuối; nghe qua soundcard/tai nghe thường dùng; tự chấm sáu tiêu chí visual, âm thanh sạch, velocity, pedal, FX/pan và khả năng xuất ổn định; riêng Kontakt đánh dấu kiểm tra nếu có dùng bản thu.
- Có thể ghi thời gian xuất và RAM quan sát từ Task Manager bằng giao diện Windows, không yêu cầu CMD/PowerShell. Xuất báo cáo JSON local, gửi báo cáo đó về chat để nghiệm thu dựa trên dữ liệu thật.

## Tiêu chuẩn nghiệm thu và giới hạn
- **Windows CI:** chỉ PASS khi job GitHub Windows 2022 xuất và đọc file WAV/MP4, assertions PASS trên đúng HEAD.
- **Windows laptop UAT:** chỉ được ghi `USER_SELF_REPORTED_PASS` sau khi chính người dùng xem/nghe và đánh dấu đủ; chưa xem thì HOLD. Kết quả cảm thụ là người dùng đánh giá, không phải đo khoa học.
- **Native Kontakt 8/NKI:** không tự đánh dấu PASS bởi Web UAT hoặc Windows runner khi chưa trực tiếp nạp VST3 trên desktop Windows với soundcard; phần này thuộc nghiệm thu host Desktop tiếp theo. Web H.3 chỉ có thể xuất file âm thanh Kontakt đã thu/import.
- **Deployment:** chỉ phát link immutable Cloudflare khi đúng HEAD deployed successfully. Tách biệt hoàn toàn Main/Production; không tự merge.
- **An toàn:** không tải file nhạc người dùng lên server, không ghi ổ C bằng trình cài mới, không gửi dữ liệu không yêu cầu; không dùng TinyFish/CMD máy người dùng, không dịch vụ tính phí, không xây Windows installer trong H.3.
