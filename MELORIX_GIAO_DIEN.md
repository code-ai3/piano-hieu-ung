# MELORIX — Giai đoạn thiết kế lại giao diện (bản thử nghiệm)

## Phạm vi được duyệt
Mẫu giao diện desktop làm việc kiểu DAW/Cakewalk, ảnh tham chiếu do chủ dự án chọn. Tên mới MELORIX. **Giai đoạn 3 NeuralNote tạm dừng.**

## Những gì đã đưa vào bản thử nghiệm
- Giao diện tối màu charcoal, điểm nhấn cam, menu và thanh công cụ phía trên, timeline MIDI đa track phía giữa.
- Xem nốt rơi/video chiếm khu vực rộng phía dưới timeline. Cạnh phải là bảng thuộc tính: nốt rơi, Velocity, phím Piano, cảnh nền, định dạng 9:16/16:9.
- MIDI track hiện tên, màu, Mute/Solo và tổng quan nốt theo thời gian; click lên timeline chuyển thời điểm phát (tạm dừng trước khi seek).
- Tích hợp trình xem trước, Play/Pause, Stop, chuyển bài, nhập MIDI/âm thanh, toàn màn hình, chụp PNG khung hình, xuất MP4.
- Engine 2A–2D giữ nguyên: lọc track, velocity, Basic Pitch, xuất 15/30 giây hoặc toàn bài; không chỉnh sửa thuật toán này.
- Mặc định mở khung ngang 16:9 và giao diện dark; người dùng vẫn có thể chuyển sang 9:16.
- Timeline chỉ là **tổng quan hiển thị**, lấy mẫu tối đa 160 nốt/track để nhẹ. Chưa chỉnh nốt bằng chuột, chưa mixer VST/DAW chuyên nghiệp.

## Nghiệm thu cần thực hiện
1. Cloudflare báo build thành công trên branch **feature/melorix-giao-dien-workspace** (không phải Production).
2. Mở Chrome và so mẫu thiết kế: header/menu, toolbar, timeline MIDI, preview dưới, inspector phải.
3. Nhập MIDI đa track: thấy lane đúng, Mute/Solo đồng bộ với nốt rơi/phát lại.
4. Click timeline và Play, xem vị trí chạy đúng, đổi hiệu ứng và màu trực tiếp ở inspector.
5. Xuất thử MP4 ngang 16:9 và dọc 9:16 (15 giây); kiểm tra video thực có hình/tiếng/độ phân giải.
6. Xem trên cửa sổ hẹp / iPhone: inspector chuyển xuống dưới, timeline cuộn được; tránh bị che controls.
7. Nếu Cloudflare build lỗi, sửa trên branch này, không cập nhật `main`/Production.

## Nguyên tắc
Không chi phí trả phí, không GitHub Actions/CMD, không sửa Production, không merge PR khi chưa duyệt. Giữ MIT License và attribution gốc Piano FX.
