# MELORIX — Piano Roll Editor (bản thử nghiệm)
## Cách mở
1. Mở MELORIX với MIDI có ít nhất một track.
2. Trong bảng Track MIDI bên trái, nhấp đúp vào dải nốt màu xanh/hồng để mở Piano Roll ở nửa dưới.
3. Kéo thanh phân cách để chỉnh chiều cao; đóng bằng nút × trên cửa sổ Piano Roll.

## Chỉnh nốt
- Nhấp đúp vùng trống trong grid để thêm nốt; snap 1/4, 1/8, 1/16, 1/32 hoặc tắt.
- Kéo nốt theo ngang (thời điểm) và dọc (cao độ); kéo mép phải để chỉnh độ ngân.
- Nhấp đúp nốt để xóa; chọn công cụ Xóa rồi bấm nốt cũng xóa.
- Thanh Velocity nằm dưới: kéo từng cột lên/xuống, giá trị giới hạn 1–127.
- Phím piano đặt bên trái, thước thời gian phía trên, zoom ngang.

## Đồng bộ
Chỉnh sửa cập nhật vào `allNotes`. Các track khác giữ nguyên. Preview phát lại và MP4 lấy dữ liệu mới từ `allNotes`. Khi sửa, playback đang chạy sẽ tạm dừng, tránh lịch phát cũ.

## Lưu
Vào **Tệp → Lưu MIDI đã chỉnh (.mid)** để tải file MIDI có nhiều track. File xuất tái tạo các nốt và tempo cơ bản; metadata/tempo thay đổi phức tạp có thể chưa được giữ đầy đủ. Bản web không lưu dữ liệu MIDI tự động sau khi tải lại trang.

## Kiểm tra bắt buộc trước nghiệm thu
- Nhấp đúp dải Piano RH mở đúng RH; sửa không động Piano LH.
- Di chuyển 1 nốt, thay đổi cao độ, kéo dài, thêm, xóa và thử nghe lại.
- Kéo Velocity từ 25 lên 110 phải khác rõ ràng khi nghe phát lại, đồng thời video MP4 dùng dữ liệu đã sửa.
- Tải .mid đã chỉnh, nhập lại vào MELORIX/Cubase và xác nhận số nốt, cao độ, trường độ, Velocity.
- Đóng Editor và xác nhận Piano trở lại kích thước lớn; giao diện không cuộn toàn trang.
- Test các màn hình nhỏ, kiểm tra timeline/inspector, xuất MP4 15 giây.
- Nếu không đạt, sửa trên branch `feature/melorix-piano-roll-editor`; không merge vào main/Production.

Không dùng GitHub Actions, không chi phí trả phí, không CMD trên máy người dùng.
