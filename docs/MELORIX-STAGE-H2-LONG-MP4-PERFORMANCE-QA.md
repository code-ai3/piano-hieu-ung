# MELORIX H.2 — MP4 3–5 phút / 1080p và chỉ mục khung hình

## Nền
H.1 Draft PR #64, HEAD `2c1cf527b94beca96d60c964ca96c0fba3472351`, CI 2/2 và Cloudflare Deploy SUCCESS. Đã đọc nhật ký kỹ thuật trung tâm và `PianoView.vue`, memory budget F.2, H.1 cancellation/phase, bộ Chromium QA. Chủ dự án duyệt H.2 (MP4 dài 3–5 phút).
Branch tách riêng `feature/melorix-h2-long-mp4-performance`; không merge Main/Production.

## Tối ưu runtime đã triển khai
- Trước H.2: `draw()` quét mọi nốt MIDI bốn lần/khung hình (đổ nốt, smoke, latest pressed key và điểm phát sáng); `exportVideo()` quét mọi nốt lần nữa để tìm phím đang phát. Bài 5 phút 30 FPS × 20.000 nốt là hàng trăm triệu lượt kiểm tra thời gian không cần thiết, có thể gây CPU/rớt FPS xuất.
- `src/util/melorix-stage-h2-frame-index.ts`: tạo chỉ mục start/end theo thời gian một lần (`O(N log N)`); vòng xuất gọi `index.at(currentTime,lookahead)` tuyến tính theo số sự kiện mới đi qua và số nốt nằm trong vùng hiển thị. Chỉ mục bao gồm đuôi smoke (burn duration + smokeLife) để không xóa hiệu ứng quá sớm. Giữ *thứ tự nốt gốc* khi vẽ và latestPress/velocity theo MIDI/track. Nếu chuyển thời gian lùi, reset index. Không chạm mã engine phát nhạc.
- `PianoView.vue` `draw(targetCanvas,...,exportFrame?)`: chỉ đường xuất MP4 sử dụng tập nốt đã lập chỉ mục, còn đường preview vẫn vẽ chính xác như cũ từ notes.value. `keyState`/contact/glow cập nhật từ chỉ mục.
- `tests/melorix-stage-h2-frame-index.mjs`: tạo bài giả lập 5 phút, 30 FPS, 20.000 nốt ở 5 track; so các khung thời gian với brute-force cho visible notes và latest press, bao gồm smoke tails và thao tác seek lùi; đo số lượt kiểm tra so baseline. Đây là benchmark thuật toán, không phải FPS thực trình duyệt.

## Kiểm thử MP4 thật
Workflow mới `long-mp4-1080p` chạy matrix [180,300] giây trên GitHub Linux Chromium, mỗi job timeout 30 phút; song song với hồi quy WebAudio/G1–G3.
`tests/melorix-stage-h2-long-mp4-browser-qa.mjs` nhập .melorix hai track Synth Bass / Music Box, effect riêng, bản full song gần 3 hoặc 5 phút, xuất MP4 1920×1080 30FPS H.264/AAC thật, đọc file bằng ffprobe/ffmpeg, kiểm A/V drift <260ms, tín hiệu âm không im lặng, browser pageerrors, bộ nhớ RSS aggregate Chrome (<3800 MiB), JS heap (<1024MiB), wall time và kích thước file. Không dùng file video giả. CPU percent là tổng % Chrome processes trên Linux runner, không tương đương % CPU laptop Windows hay thông số pin.
Không dùng CMD Windows hoặc dịch vụ phí mới.

## Giới hạn và quy tắc nghiệm thu
- Những đo đạc CPU/RAM là từ GitHub Linux runners; không có chứng cứ hiệu năng laptop Windows HP 240 G8 hoặc thử xuất Kontakt native.
- `estimateExportBudget` F.2 vẫn là giới hạn ước tính bảo thủ trước xuất. Không bỏ bảo vệ RAM để ép test PASS.
- Mục tiêu Giai đoạn H.2 chỉ có thể tuyên bố 3–5 phút 1080p thành công khi GitHub CI 4/4 SUCCESS, Cloudflare Pages Deploy successful đúng SHA, các job matrix thật đều có log ffprobe/ffmpeg và RSS. Nếu lỗi/timeout thì sửa thực tế hoặc báo HOLD, không tuyên bố đã nghiệm thu.
- H.1 progress/audio cancellation và G.3 GM/WebAudio không được thay đổi chức năng.
