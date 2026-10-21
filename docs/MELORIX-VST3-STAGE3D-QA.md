# MELORIX — GĐ3D: Chẩn đoán Kontakt/VST3 trực tiếp trên Windows

Ngày 21/10/2026. Tạo từ GĐ3C1 HEAD 4f3b8d8946aa6c4e5cf10d33d313151c3fe8edac. Đây là nhánh thử nghiệm, chưa thay đổi main/Production.

## Mục tiêu / cách thực hiện không CMD
1. Trên MELORIX Windows Desktop, nhập hoặc tạo một track MIDI.
2. Mở **Nhạc cụ VST3** → **Quét lại VST3** → chọn Kontakt 8 VST3 có bản quyền và gắn vào track.
3. Bấm **Mở giao diện VST3**, chọn một thư viện NKI hợp lệ trong GUI native của plugin.
4. Tắt WASAPI đang phát, dừng transport. Bấm **Chẩn đoán VST3** dưới đúng track.
5. MELORIX kiểm tra native instance, render nốt C4 PCM float32 thực, kiểm tra peak/nonzero; phát thử Note On/Off qua native WASAPI shared, bảo đảm Note Off và dừng WASAPI cả khi lỗi.
6. Chọn **Có tiếng / Không có tiếng**, bấm **Sao chép kết quả QA** và gửi báo cáo lại. Nội dung chỉ gồm tên plugin, mã track và trạng thái, không copy đường dẫn DLL/NKI hoặc dữ liệu mẫu. Không tự upload báo cáo.

## An toàn và ranh giới
- Không đụng dịch vụ trả phí, không sử dụng loopMIDI/Kontakt Standalone, không tự ghi file xuống C:, không tải NKI hoặc thư viện plugin lên Internet.
- Khi phát hiện có luồng WASAPI đang hoạt động, QA từ chối can thiệp; phải do người dùng dừng trước.
- Kết quả native PCM + WASAPI Note On/Off thành công CHỈ là kiểm chứng tầng kỹ thuật. Không tự chứng minh Kontakt 8/NKI thương mại phát tiếng thật qua soundcard. Chỉ người dùng trên Windows mới xác nhận có nghe.
- Thiết bị Windows của người dùng hiện offline theo Desktop Commander; chưa thể kiểm thử Kontakt thật.
- Chưa có native multitrack mix, ASIO, Volume/Mute/Solo, NKI state persistence, full WAV/MP4 export VST3.
- Windows GitHub Actions chạy Steinberg SDK VST3 test instrument, KHÔNG có Kontakt/NKI có license.

## Tiêu chí nghiệm thu
- Regression suite + Vue TypeScript/Vite + Windows packaging PASS tại đúng HEAD.
- Người dùng mở .exe QA và cung cấp bản chẩn đoán từ plugin Kontakt/NKI đã chọn.
- Không merge main/Production cho đến khi người dùng chủ động phê duyệt.
