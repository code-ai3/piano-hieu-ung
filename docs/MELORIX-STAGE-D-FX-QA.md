# MELORIX — Giai đoạn D: EQ và Reverb theo từng track (WebAudio)

**Base:** GĐC đã được người dùng nghiệm thu, commit `3520fc2` và PR #55. Triển khai thử trên `feature/melorix-stage-d-track-fx`, base nhánh C, không merge Main/Production.

## Những gì làm thật
- Track WebAudio có đường âm riêng: nguồn -> Track Gain -> Stereo Panner B.2 -> EQ (BiquadFilterNode lowshelf Bass 180Hz, peaking Mid ~1kHz, highshelf Treble ~4.5kHz) -> song song Dry / Reverb ConvolverNode -> Track FX Output -> Master Audio hiện có.
- EQ Bass, Mid, Treble ±12dB; Reverb Wet 0–70%; độ dài phòng 350–2200ms. Impulse deterministic cục bộ, không tải mẫu từ mạng. Bật FX là opt-in, **mặc định tắt**.
- **Mỗi track hoàn toàn riêng**: FX draft, FX session đã lưu, A/B FX độc lập và Undo/Redo FX của từng track. A/B FX bật/tắt riêng FX, không ảnh hưởng nút A/B MIDI ở phía dưới. Reset FX chỉ reset bản nghe thử; không xóa thiết lập đã lưu, có thể Undo/Redo để điều chỉnh những lần Lưu FX.
- Volume/Pan, CC64, MIDI Performance B.2 và C không đổi. Xóa track hoặc nạp MIDI khác dọn state FX và WebAudio nodes tương ứng.
- **“Lưu FX phiên này” chỉ lưu tạm trong bộ nhớ trình duyệt**. Chưa có định dạng project lưu FX, MIDI .mid không chứa Reverb/EQ, và **xuất MP4/offline không tự động có hiệu ứng D**. Không tuyên bố đã tích hợp âm thanh Kontakt/VST3 native; WebAudio bản gốc WAV/MP3 bypass DSP nhánh MIDI.
- Global Expressive Audio Master (reverb/compressor tự nhiên từ trước) vẫn hoạt động như GĐC. A/B FX chỉ bypass bộ hiệu ứng track mới, không bypass master cũ.

## Kiểm thử và nghiệm thu
- `npm run test:stage-d`: chuẩn hóa giới hạn, wet/dry, default bypass, kiểm tra wiring track/session FX/undo.
- `npm run build`: unit regressions A–C + TS + Vite.
- Chromium trong `tests/melorix-stage-a-browser-qa.mjs`: Chrome WebAudio BiquadFilterNode, ConvolverNode hoạt động thật, Bass tăng +8 rồi giảm -6 ở hai track khác nhau, Room impulse 1.6s, save/undo/redo/A-B track isolation; Stage A–C PCM regression.
- Chỉ giao bản Preview khi GitHub Actions 2/2 PASS và Cloudflare Pages Deploy successful đúng SHA, sau đó chủ dự án thử cảm nhận trên loa để nghiệm thu.

Không dùng CMD Windows, không trả phí, không merge production.
