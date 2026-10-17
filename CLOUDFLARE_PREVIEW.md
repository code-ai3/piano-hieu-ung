# Piano Hiệu Ứng — Triển khai thử nghiệm Cloudflare Pages

## Phạm vi an toàn
- Chỉ triển khai một **Cloudflare Pages project mới**, tách khỏi các website đang dùng.
- Đọc nhật ký Google Drive CHATGPT PROJECT CONTEXT trước khi tiếp tục thay đổi.
- Mã nguồn từ nhánh thử nghiệm `feature/giai-doan-1-viet-hoa-on-dinh` (không phải `main`).
- Không merge Pull Request #1, không cập nhật production của dự án nào khác.
- Không sử dụng GitHub Actions, CMD hoặc PowerShell trên máy cá nhân.

## Cấu hình Cloudflare Pages

1. Mở https://dash.cloudflare.com/ → Workers & Pages → Create → Pages → **Connect to Git** / Import Git repository.
2. Kết nối GitHub nếu Cloudflare yêu cầu. Đây là quyền truy cập GitHub **của Cloudflare**, không phải quyền ChatGPT. Chỉ cấp quyền repo `code-ai3/piano-hieu-ung`.
3. Chọn repository `code-ai3/piano-hieu-ung`.
4. Tạo **dự án Pages mới** với cấu hình:

| Trường | Giá trị |
| --- | --- |
| Project name | `piano-hieu-ung-test` (đổi sang tên còn trống nếu cần) |
| Production branch **của dự án thử nghiệm này** | `feature/giai-doan-1-viet-hoa-on-dinh` |
| Framework preset | Vue / Vue (Vite), hoặc None |
| Root directory | `/` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | Không cần (Node 22.16.0 đã được ghim bằng `.node-version`) |

5. Chọn **Save and Deploy** và chờ Cloudflare báo kết quả. Chỉ coi thành công khi hiện Deploy succeeded và có URL `*.pages.dev`.
6. Nếu Cloudflare không hiển thị `feature/giai-doan-1-viet-hoa-on-dinh` khi chọn branch, **dừng lại**, không chọn `main` thay thế.
7. Kiểm tra URL thực tế: giao diện tiếng Việt, tải MIDI mẫu, phát nốt rơi, đổi hiệu ứng, đổi ngôn ngữ, nhập MIDI cá nhân và thử xuất MP4. Bước kiểm tra MP3/WAV và AI Basic Pitch thực hiện riêng vì có thể nặng.

## Khi build thất bại
- Mở Deployments → failed build → View build log.
- Lưu/copy các dòng báo lỗi đầu tiên. Không bấm retry liên tục khi chưa xác định nguyên nhân.
- Không tự nâng cấp dependency hàng loạt hoặc thay nhánh `main`.

## Chưa xác minh
- Chưa có build / URL Pages thực tế trong lần chuẩn bị này.
- Chưa xác nhận MIDI/audio/MP4 chạy đúng trên trình duyệt, chỉ kiểm tra tĩnh của repo.
- Phần 9:16 TikTok và tích hợp trực tiếp NeuralNote thuộc giai đoạn tiếp theo.

Nguồn hướng dẫn: https://developers.cloudflare.com/pages/configuration/git-integration/ và https://developers.cloudflare.com/pages/framework-guides/deploy-a-vue-site/
