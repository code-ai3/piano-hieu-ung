# MELORIX Desktop — Kết nối Kontakt thật (Windows)

**Mục tiêu:** phát MIDI mà bạn vẽ/chỉnh trong MELORIX bằng các thư viện nhạc cụ đang có trong Native Instruments Kontakt Standalone, không dựng lại bằng bộ General MIDI của web.

## Kiến trúc đã triển khai
`MELORIX Desktop (Electron) → Web MIDI → cổng ảo loopMIDI → Kontakt Standalone → soundcard của Kontakt`.

Đây là kết nối **MIDI**, không phải VST3 host. MELORIX không thể tự nhúng hoặc mở `.nki`, không thể tự quét giấy phép Kontakt, và **không** lấy tín hiệu audio của Kontakt qua Web MIDI. Người dùng phải có Kontakt đã cài và thư viện NKI hợp lệ. Không cần cài lại Kontakt nếu đã có.

## Kết nối không dùng CMD
1. Trên Windows, chạy MELORIX Portable hoặc Setup, mở bài MIDI.
2. Mở `loopMIDI` (phần mềm tạo cổng MIDI ảo) từ <https://www.tobias-erichsen.de/software/loopmidi.html> rồi nhấn dấu **+**, đặt tên cổng `MELORIX-KONTAKT`. Giữ loopMIDI chạy.
3. Mở Kontakt 8 **Standalone**, vào **File → Options → MIDI → Inputs**, tìm `MELORIX-KONTAKT`, chọn **Port A**. Nếu Kontakt đã chạy trước khi tạo cổng, thử đóng/mở lại Kontakt. Chọn soundcard/ASIO của bạn trong Options → Audio; mở NKI của bạn và đặt Instrument MIDI Ch là `[A] 1` hoặc `Omni` để thử bước đầu.
4. Trong MELORIX, nhấn nút **Kết nối Kontakt** ở thanh phát → **Kết nối nhanh Kontakt trên Windows**. MELORIX xin quyền Web MIDI, tìm cổng `MELORIX-KONTAKT`/loopMIDI, chọn nó, bật chỉ gửi MIDI qua Kontakt (không phát GM trong MELORIX) và gửi Note On/Off thử.
5. **Nghe thật**: chọn MIDI Ch 1, bấm **Thử nốt**. Chỉ khi nghe tiếng ở loa qua soundcard của Kontakt mới đánh dấu ô xác nhận nghe Kontakt. Nếu không nghe, kiểm tra đúng tên loopMIDI, Port A, MIDI channel, output audio, mute/solo Kontakt.
6. Nhiều track: mở **Công cụ → Thiết lập kênh Kontakt**, dùng tự phân kênh, nạp mỗi NKI vào Kontakt và gán Ch 1, Ch 2… Khẩu trống đi Ch 10 nếu tương ứng.
7. Kéo Volume track trong MELORIX gửi **MIDI CC7** trên kênh của track. Đảm bảo các track không trùng MIDI channel nếu muốn âm lượng từng track độc lập.

## Lưu ý kỹ thuật
- “Đã gửi nốt” chỉ chứng minh **MELORIX gửi MIDI** tới cổng, **không chứng minh Kontakt đã nhận hay phát tiếng**. Cần nghe hoặc kiểm tra MIDI activity tại Kontakt thực.
- Chế độ chỉ Kontakt tránh nghe đồng thời GM và Kontakt. Bản thu MP3/WAV được tắt khi kích hoạt Kontakt Live, để Play gửi MIDI tới nhạc cụ.
- MIDI CC7 hiệu quả phụ thuộc cấu hình nhạc cụ NKI, script và MIDI input của Kontakt. Một số preset có thể không tuân theo CC7.
- Soundcard/ASIO chịu trách nhiệm tiếng Kontakt. MELORIX không yêu cầu thay driver ASIO và không cấu hình soundcard của Kontakt.
- Chế độ thu/xuất MP4 cần **thu hoặc nhập audio phát ra từ Kontakt**; MIDI kết nối không tự chuyển được âm thanh từ Kontakt vào MP4.
- Nếu Kontakt đang được nạp **dưới dạng VST3 bên trong Cubase**, nó không tự nhận cổng loopMIDI từ MELORIX. Hướng dẫn ở đây áp dụng **Kontakt Standalone**. Bạn có thể mở standalone riêng, hoặc tự route loopMIDI qua MIDI track của Cubase nếu DAW hỗ trợ.
- loopMIDI yêu cầu cài đặt ứng dụng/driver Windows bằng giao diện đồ họa nếu máy chưa có, nhưng không cần CMD/PowerShell.
- Installer .exe chưa được ký số: Windows SmartScreen có thể hiện cảnh báo. Kiểm tra nguồn GitHub của dự án và SHA-256 trong log trước khi chạy.
- Đóng gói Portable/Setup không sửa phiên bản Web Production. Bản mới cần nghiệm thu thật bằng Kontakt đang mở trên máy người dùng, chưa đánh dấu đã nghe.

## Danh sách nghiệm thu bản Windows
1. Chạy Portable, mở giao diện mà không cần trình duyệt.
2. Giao diện báo chưa kết nối; nhấn nút Kontakt → auto chọn `MELORIX-KONTAKT`, báo gửi Note On/Off.
3. Kontakt Standalone thực sự phát nốt vừa thử đúng NKI ở Ch 1.
4. Chế độ Kontakt Live phát MIDI track mới/chỉnh trong Piano Roll, không phát chồng GM.
5. Thử 2 NKI hai kênh khác nhau, Mute/Solo và Volume độc lập; bấm Stop không còn nốt treo.
6. Ngắt loopMIDI giữa chừng, UI thông báo ngắt cổng và không giả vờ vẫn kết nối.
7. Sau khi qua 1–6 mới đề nghị ổn định bản Windows và cân nhắc merge; không tự merge Production.
