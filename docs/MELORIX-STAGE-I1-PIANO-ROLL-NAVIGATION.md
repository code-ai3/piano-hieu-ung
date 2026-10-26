# MELORIX — Giai đoạn I.1: Điều hướng Piano Roll khi bài dài

## Nền và phạm vi
Đã đọc nhật ký kỹ thuật trung tâm, PR #67 H.3D/E HEAD `83659128d80a0251a5d73771f36a52185c9cc459` và source thực `MelorixPianoRoll.vue`, `PianoView.vue`, `melorix-roll.css`. Trạng thái H3 Windows CI và Cloudflare PASS, user UAT nhạc thật / Kontakt native chưa kiểm. Chủ dự án chọn bỏ qua UAT thủ công và chuyển sang giai đoạn I. Chỉ cải thiện giao diện/điều hướng Piano Roll đang có; **không tự tuyên bố nghiệm thu âm thanh Kontakt, không sửa engine GM, VST3, MIDI editing, pedal, MP4/WAV**.

Branch `feature/melorix-i1-piano-roll-navigation` tách từ HEAD H3DE; chỉ Draft PR, không merge Main/Production.

## Thay đổi sử dụng được
- Thanh Zoom có nút phóng to/thu nhỏ, không chỉ thanh kéo.
- **Toàn bài:** thu phóng để nhìn cả track dài 3–5 phút trong diện tích hiện có; giới hạn tối thiểu 1 px/s cho overview (khác với chế độ chỉnh nốt chi tiết).
- **Nốt chọn:** khi chọn một hoặc nhiều nốt, có thể tập trung vùng thời gian/cao độ đang chọn để chỉnh; vô hiệu hóa khi chưa chọn nốt.
- **Tới Playhead:** đưa cửa sổ về vạch chạy và bật lại tự theo Playhead. Nút riêng bật/tắt theo Playhead, không tự cuộn đè khi người dùng đang quan sát vùng khác.
- Zoom thường lấy mốc thời gian dưới trung tâm cửa sổ để không nhảy vị trí đang xem. Các hàm tính có bảo vệ NaN, giới hạn zoom 1–160px/s, thước ruler đổi mốc 1/2/5/10/15/20/30/60/120/300s tùy mức zoom để tránh chữ chồng nhau.
- Giữ một vùng làm việc Piano Roll, không thêm panel mới hoặc tăng chiều cao cố định. CSS nút gọn, cuộn ngang nếu hẹp.
- Từng track và nốt MIDI, lực đánh, pedal, save/export không thay đổi vì thao tác điều hướng chỉ đọc dữ liệu MIDI.

## Kiểm thử tự động
- `tests/melorix-stage-i1-piano-navigation.mjs`: Node helper geometry, 5 phút whole-song fit, short note selected, clamp/NaN, pan viewport anchor, adaptive ruler.
- `tests/melorix-stage-i1-piano-browser-qa.mjs`: Chromium load .melorix 2 tracks/3 nốt RH tại 1s, 96s, 179s, mở đúng Piano Roll RH, kiểm toàn bài, phóng/thu, vùng nốt chọn, theo Playhead, đổi sang LH và số nốt không đổi; không pageerrors.
- `package.json` nối test:stage-i1 vào `npm run build` cùng TypeScript/Vite và các hồi quy từ A–H2.
- `.github/workflows/melorix-i1-piano-roll-qa.yml`: chỉ một job build/typecheck/unit + Chromium, không chạy lại hai stress MP4 3/5 phút do phần audio/video chưa thay đổi và đã có H3 PASS. Không hạ chất lượng xuất để CI PASS.

## Gates
- **Code/CI:** PASS chỉ khi GitHub Actions đúng head SHA hoàn tất success, Chromium kiểm thử trên UI thật success.
- **Cloudflare:** chỉ giao URL immutable khi bot Deploy successful và check đúng SHA; không dùng bản URL HEAD cũ giả làm I1 mới.
- **UAT trực tiếp:** người dùng đã chọn không làm các bước test thủ công; không yêu cầu.
- **Production/Native:** PR Draft không merge, không chạm bản chính, không installer hay CMD Windows, không chi phí mới hoặc TinyFish.

Giai đoạn I.2 tiếp theo nếu chủ dự án yêu cầu: tinh chỉnh trải nghiệm lựa chọn/copy-paste nốt và xử lý trường hợp tương tác chuột/cảm ứng khó dùng; dựa trên bằng chứng khi thực sự phát sinh vấn đề.
