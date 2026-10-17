# Giai đoạn 2D — QA và ổn định xuất video MP4

## Phạm vi
Nhánh thử nghiệm `feature/giai-doan-2d-mp4-qa` (tách từ 2C). Không merge vào `main` hay sửa Cloudflare Production.

## Sửa lỗi và nâng cấp
- Giữ đầy đủ kênh âm thanh từ Web Audio khi gửi sang Mediabunny thay vì chỉ lấy kênh trái.
- Không gán lại width/height của canvas ở mỗi frame; reset transform để preview không bị tích lũy tỉ lệ.
- Thời gian video frame 0..N được tính bằng giây MIDI, kể cả khi playback speed đang khác 1×; lấy cùng timestamp để tính phím đang sáng.
- Chọn **xuất thử 15 giây**, **30 giây**, hoặc **toàn bộ bài** trước khi xuất; mặc định 15 giây để kiểm thử nhanh.
- Xuất hiện rõ trạng thái đang dựng âm thanh hay đang xuất video; giảm tần suất cập nhật giao diện trong vòng lặp encode.
- Tệp download được giữ Blob URL đủ thời gian để trình duyệt khởi động tải; nếu stream ghi đĩa thất bại thì `abort()` file chưa hoàn chỉnh.
- Các bài test xử lý MIDI, video, velocity và export timeline được chạy tự động trong Cloudflare build bằng npm, không dùng GitHub Actions.

## Kiểm thử tự động
- `npm run test:tracks`
- `npm run test:video`
- `npm run test:velocity`
- `npm run test:export`
- `npm run build` (bao gồm cả các test trên và TypeScript/Vite)
- Cloudflare có thể báo build thành công. Đó là chứng cứ CI pass, **không thay thế QA xuất MP4 thực tế**.

## Checklist QA bằng Chrome (cần thực hiện)
1. Mở **Preview nhánh 2D**, không đánh giá qua URL production Giai đoạn 1.
2. Mở mục **Xuất video → 15 giây**, thử Canon trước. Xác nhận tên file có hậu tố `-15s-test.mp4`; trên video phải nghe được Piano, phím sáng khớp nốt.
3. Dùng **MediaInfo / Windows File Properties** để xác nhận 1080×1920 (TikTok 9:16), 30 FPS và AAC.
4. Đổi sang 16:9, xuất 15 giây, xác nhận 1920×1080.
5. Thử MIDI 2–14 track từ Cakewalk/Tsumugi; Solo một track, thử xuất lại và đảm bảo chỉ còn nốt track được chọn.
6. Chỉnh speed 0.5×, 1×, 2× trước khi xuất; file MP4 phải có cùng mốc nhạc và hình theo MIDI (không đổi tốc độ khi xuất).
7. Đổi chế độ Velocity "Nổi bật" và xác nhận hiệu ứng mạnh/nhẹ được phản ánh trong bản xuất giống Preview.
8. Thử hủy cửa sổ lưu file và xuất lại; không làm treo giao diện.
9. Chỉ thử **toàn bài** khi bài 15 giây thành công; trên thiết bị không có File System Access API có thể phải dùng nhiều RAM để giữ MP4.

## Giới hạn chưa xử lý
- Nền **video động** được lấy từ thẻ video HTML phát realtime; khi xuất offline tốc độ nền có thể khác Preview. Khuyến nghị dùng **nền ảnh tĩnh** khi kiểm tra đồng bộ; việc gắn nhịp nền video vào timeline sẽ là nâng cấp riêng.
- Âm thanh VST/Kontakt chưa chạy trong web; file xuất dùng smplr piano.
- Chưa có kết quả MP4 thực tế trên Chrome/iPhone do chưa trực tiếp chạy/trích xuất file đầu ra ở thiết bị người dùng.
- Thử toàn bài dài 3–5 phút ở 1080p có thể tốn bộ nhớ và thời gian; chưa thể cam kết thời gian tối đa.

## Quy tắc
Luôn đối chiếu nhật ký Google Drive CHATGPT PROJECT CONTEXT trước khi làm tiếp; dùng dịch vụ miễn phí; không GitHub Actions, không CMD trên máy người dùng, không sửa nhánh main hoặc Production khi chưa được duyệt.
