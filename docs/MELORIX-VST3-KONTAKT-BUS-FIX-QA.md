# MELORIX Kontakt 8 — lỗi stereo bus / sửa tương thích nhiều output (22/10/2026)

## Bằng chứng từ người dùng (Windows Desktop GĐ3D)
- Track 0 đã nạp Kontakt 8. QA PCM: `VST3 does not accept stereo output bus`.
- QA WASAPI: `VST3 rejected stereo output bus`, Note On/Off chưa chạy.
- Đây là lỗi host cứng nhắc `setBusArrangements(nullptr,0,&stereo,1)`; không chứng minh lỗi card âm thanh, driver hoặc NKI.

## Phân tích và cách sửa
Theo Steinberg VST3 SDK, số lượng bus trong `setBusArrangements` phải phù hợp `getBusCount`; host gửi một bus trong khi plugin có thể khai báo nhiều bus là không đúng. Host mới:
- Không tự ép số lượng bus đầu ra về một. Tôn trọng cấu hình bus mặc định của plugin.
- Hỏi `IComponent::getBusCount/getBusInfo` cho TẤT CẢ output / input audio buses; cấp `AudioBusBuffers` đúng thứ tự mỗi bus (kể cả các aux bus chưa kích hoạt), với giới hạn an toàn 64 bus/256 kênh; kích hoạt bus output đầu và MIDI input đầu như trước.
- Trong offline PCM và WASAPI xử lý đúng dữ liệu `IAudioProcessor::process`, chỉ phát stereo down-selection từ output bus đầu, mono được copy sang hai kênh. Không giả synth, không nạp Kontakt giả hoặc sao chép NKI.
- Kiểm thử CI thêm test instrument chuẩn Steinberg có hai output bus và cố tình từ chối yêu cầu chỉ một stereo, phải có PCM thật để PASS. Tránh phụ thuộc Kontakt thương mại trong CI.

## Giới hạn và nghiệm thu tiếp
- Chưa kiểm được Kontakt 8 thương mại hoặc âm thanh NKI thực tế trên PC user. CI 2-bus synth PASS chỉ xác nhận host phù hợp hơn với multi-bus, không đồng nghĩa mọi VST3 đều tương thích.
- Nếu Kontakt dùng aux output hoặc plugin thiếu sample, PCM vẫn có thể bằng 0. Nếu không phát được thì cần xem lỗi mới, không quay sang ASIO khi thiếu bằng chứng.
- Cần tải bản MELORIX Windows QA build từ nhánh riêng; khi test user cần nạp Kontakt 8, chọn NKI hợp lệ ở native editor, tắt WASAPI, bấm Chẩn đoán VST3, xác nhận âm thật và sao chép QA.
- Không merge main/production; không bắt người dùng chạy CMD, không lưu dữ liệu sang C:, không đưa NKI/VST3 plugin lên GitHub.
