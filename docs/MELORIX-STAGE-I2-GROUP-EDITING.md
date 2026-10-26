# MELORIX I.2 — Chỉnh sửa nhóm nốt MIDI trong Piano Roll

## Cơ sở
Đã đọc và đối chiếu master technical log LUNOR MUSIC, PR #68 MELORIX I.1 `e490647b86561e73b5c0c009d79bfa0fdd219743`, source `MelorixPianoRoll.vue`, `piano-roll-selection.ts` và UI QA I.1. I.2 tách nhánh từ chính I.1, không merge Production. H.3 kiểm thử Windows hosted MP4 PASS; UAT laptop/nghe thật/Kontakt 8 native vẫn chưa nghiệm thu theo lựa chọn bỏ qua kiểm thử thủ công của người dùng.

## I.2 chức năng
- Công cụ **Chọn** giữ nguyên, Shift/Ctrl/Cmd nhấp để chọn nhiều nốt, hoặc kéo vùng trên lưới để chọn nhóm.
- Khi nhiều nốt được chọn, **kéo mép phải một nốt được chọn** thay đổi thời lượng tất cả nốt đã chọn với cùng độ tăng/giảm; giữ time, pitch, velocity và track ID; mỗi nốt có tối thiểu 0.04s.
- **Alt + kéo phần thân nốt** sẽ tạo bản sao chính các nốt được chọn, giữ khoảng cách các nốt và velocity; không sửa nguồn. Nếu chỉ Alt + nhấp không di chuyển sẽ không sinh nốt thừa. Lệnh **Ctrl+D** nhân đôi như trước; Ctrl+C/Ctrl+V vào playhead không bị thay đổi.
- **Mũi tên trái/phải** dịch nhóm một ô Snap (Snap Off thì 0.05s); **lên/xuống** đổi cao độ nhóm ±1 semitone. Giới hạn MIDI note [21,108], thời gian không âm; áp dụng thay đổi trong track đang chỉnh. Phím tắt không cướp sự kiện khi người dùng đang nhập ở input/select.
- Mỗi thao tác kéo hoàn tất hoặc phím mũi tên là **một lần Undo/Redo**; `pointercancel` khôi phục trước khi kéo (không lưu dữ liệu bị hỏng) và đóng editor không commit một drag dở.
- Phần hướng dẫn ở cuối editor cập nhật phím tắt, không thêm panel chiếm chỗ.

## Những thứ không đổi
MIDI schema, nhập/xuất, CC64, GM instruments, Kontakt/VST3, WebAudio, FX, WAV, H.264/AAC MP4, H.1/H.2/H.3 QA, UI Dock và Main/Production. Không ép người dùng tải hay chạy CMD/installer.

## Unit / trình duyệt thật
- `tests/melorix-stage-i2-group-edit.mjs`: group resize +/− và clamp, Alt-copy bất biến, di chuyển nhóm ngang/dọc, không tác động track khác.
- `tests/melorix-stage-i2-group-browser-qa.mjs`: import project 2 track thật, chọn 2 nốt Shift+click, resize nhóm, Undo/Redo, Alt+drag sao chép, Undo/Redo, ArrowRight, kiểm track Piano LH vẫn chỉ có 1 nốt, browser không lỗi.
- `npm run build` chạy test I.2 và toàn bộ unit/type/Vite hiện có. Workflow riêng `.github/workflows/melorix-i2-piano-roll-qa.yml` chạy trên GitHub Actions Ubuntu Chromium. Không rerun stress MP4 dài do engine không thay đổi.

## Gates
QA code PASS khi đúng SHA có build/type/Chromium PASS. Cloudflare Preview chỉ công bố khi deploy thành công đúng SHA. PR Draft, không merge hay phát hành Desktop. User đã chọn bỏ UAT thủ công, nên không yêu cầu tự đánh giá từng bước.

Nếu có lỗi CI, giữ FAIL và sửa nguồn, tuyệt đối không xóa bài test để nhận PASS.
