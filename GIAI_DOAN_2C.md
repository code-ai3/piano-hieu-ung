# Giai đoạn 2C — Biểu cảm hình ảnh theo MIDI Velocity

Nhánh thử nghiệm: `feature/giai-doan-2c-velocity-cam-xuc`, tách từ Giai đoạn 2B. Không thay đổi `main` hoặc Cloudflare Production.

## Tính năng hiện có
- Trong **Hiệu ứng nốt**: chọn **Tắt**, **Tự nhiên**, **Nổi bật** và kéo thanh **Độ phản ứng** (0–100%).
- MIDI Velocity (0..1) điều khiển độ sáng/độ đậm nốt rơi, độ phát sáng lúc chạm phím, số lượng mảnh vỡ/hạt khói/tia lửa trong chế độ Smoke.
- Tính toán hiệu ứng theo công thức cố định, dùng chung cho live Preview và MP4 export.
- Không sửa dữ liệu MIDI gốc, không tự suy đoán biểu cảm mới và không chỉnh âm lượng phát của nhạc cụ.
- Vẫn tương thích track multi-color, video TikTok 9:16 và YouTube 16:9.

## Giới hạn hiện tại
- Ánh sáng phím Piano đã phản ứng theo Velocity khi nốt đang được nhấn. Màu phím vẫn theo thiết lập Piano.
- MIDI có tất cả Velocity đồng đều sẽ trông đồng đều; cần nguồn MIDI biểu cảm hoặc chỉnh Velocity bằng Cakewalk để thay đổi lực đánh thực.
- Việc chạy bản demo, xuất MP4 và nghe chất lượng thực tế cần QA trên Chrome.

## Kiểm thử
- Bộ test `tests/velocity-effects.mjs` kiểm tra ánh xạ lực đánh, độ tương phản, độ phản ứng và giới hạn số lượng hạt. Test chưa được chạy qua Cloudflare (CI chỉ xác nhận build).
- Build Vue/Vite trên Cloudflare được xác nhận success ở commit `7ca0f13`.
- QA thủ công: thử đoạn MIDI có nốt velocity 20, 60, 110; so sánh 3 chế độ; kiểm tra MP4 9:16 được xuất đúng hình/tiếng.

Giữ giấy phép MIT và thông tin tác giả dự án gốc. Chỉ merge sau khi được duyệt.