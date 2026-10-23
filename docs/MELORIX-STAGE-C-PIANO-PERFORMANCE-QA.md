# MELORIX — Giai đoạn C: Piano Performance Engine

## Nền và phạm vi
- Base: B.2 đã được người dùng nghiệm thu, commit `e5267bb`, Draft PR #54.
- GĐC triển khai riêng trên `feature/melorix-stage-c-piano-performance`. Không merge Main/Production, không chạm DLL Kontakt/NKI hoặc đường native VST3.
- Đây là **MIDI performance shaping**, không phải AI nhận diện nhạc hay thư viện sample piano mới. Mọi diễn giải “giống người chơi thật” vẫn phải nghe thử với MIDI và loa thực tế.

## Chức năng
1. Trong **Audio Inspector > Piano Performance**, chọn **Nguyên bản** (mặc định, không biến đổi), **Tự nhiên** hoặc **Biểu cảm** riêng mỗi track.
2. **Độ nhấn câu nhạc** 0–100% sinh đường lực đánh có cao trào nhỏ, bắt đầu câu nổi hơn. Nhóm các nốt bấm cùng lúc theo một hệ số, **giữ cân bằng velocity hợp âm**. Đường biểu cảm xác định, có thể tái tạo. Không sửa nốt thuộc track khác.
3. **Độ rải hợp âm** 0–24ms xếp nốt hợp âm từ thấp đến cao rất nhẹ; nốt đơn không bị dịch thời gian. Không tạo CC mới hoặc audio plugin.
4. Mọi chỉnh sửa là Preview WebAudio, **A/B độc lập**, không phá MIDI gốc. Chỉ nút **Áp dụng vào MIDI** ghi velocity/time vào `allNotes` và có Undo/Redo snapshot theo track. Reset chỉ đưa preview về Original, không xóa CC64/CC10 hay nốt đã commit.
5. Nạp MIDI mới xóa cấu hình preview GĐC; xóa track chỉ dọn cấu hình của track đó. Các nút B.2 và pan/pedal cũ không đổi.
6. **Pedal CC64 và Pan CC10** giữ logic B.2. Biểu cảm Stage C xuất được trong .mid sau khi Apply. Contact native VST3 nhận biểu cảm MIDI đã ghi, nhưng Browser **không chạy Kontakt**.

## Kiểm thử
- `npm run test:stage-c` kiểm deterministic, bypass Original, clamping, velocity/câu nhạc, giới hạn roll, giữ voicing hợp âm, track isolation A/B, tương thích snapshot Undo.
- `npm run build` phải PASS regression các giai đoạn trước, TypeScript và Vite.
- Chromium browser QA cần mở MIDI 2 track, chỉnh preset C Natural/Expressive, xác minh A/B, riêng từng track, Apply và Undo cùng bài test WebAudio PCM hiện có.
- Chỉ giao Preview sau CI + Cloudflare Deploy Success đúng HEAD. Chủ dự án tự nghe chất lượng nhạc trên Chrome/loa để nghiệm thu.

## Hạn chế và hướng tiếp
- Không đoán phách mạnh từ bản nhạc đầy đủ; contour suy ra theo nhóm onset và khoảng nghỉ, không hiểu diễn đạt tình cảm hay phân tích hòa thanh bằng AI.
- Độ rải hợp âm nhỏ không thay thế thuật toán piano human-performance chuyên sâu.
- Không bổ sung Reverb/EQ (GĐD) hay multi-VST3 mixer native vào C.
