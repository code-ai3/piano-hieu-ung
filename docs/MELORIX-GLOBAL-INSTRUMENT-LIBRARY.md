# MELORIX — Thư viện nhạc cụ chung (Phương án A)

Mục tiêu: tệp nhạc cụ đã **phát hành** nằm trong bản MELORIX do chủ dự án quản lý và được mọi người dùng nhìn thấy qua menu `Nhạc cụ → Thư viện nhạc cụ chung`. Danh mục **không lưu trong RAM/localStorage/IndexedDB**. F5, xóa cache, máy khác hoặc người dùng mới đều lấy từ cùng bản phát hành.

## Quy trình phát hành an toàn (miễn phí, repo GitHub + Cloudflare Pages)
1. Chủ sở hữu chọn một tệp nhạc cụ **mà mình được quyền tái phân phối cho công chúng** (.wav tự thu / .nki tự tạo hoặc có giấy phép cho phép chia sẻ). Không tự đăng tệp Kontakt thương mại hay sample có bản quyền.
2. Trong GitHub, ở nhánh phát hành nháp, đưa file đến `public/instruments/<id>/<filename>.wav` hoặc `.../<filename>.nki`. Chỉ thêm assets có nguồn và giấy phép rõ ràng.
3. Thêm một đối tượng tương ứng vào `public/instruments/catalog.json`; ví dụ **chỉ là mẫu cấu trúc, KHÔNG phải file đã được thêm vào kho**:

```json
{
  "schemaVersion": 1,
  "instruments": [
    {
      "id": "my-original-violin",
      "label": "Violin của MELORIX",
      "format": "wav",
      "file": "violin.wav",
      "rootMidi": 60,
      "license": "Original recording - public redistribution authorized",
      "redistributionApproved": true,
      "description": "Một mẫu WAV duy nhất, có thay đổi cao độ trong WebAudio."
    }
  ]
}
```

4. Tạo Draft PR, chạy build/test và Cloudflare Preview, kiểm tra tiếng. **Chỉ merge / deploy Production sau khi chủ sở hữu đồng ý**. Sau đó tất cả người dùng thấy nhạc cụ mới. Trong tương lai có thể bổ sung bộ xuất bản web bảo mật trên Cloudflare Pages Functions + R2 (yêu cầu cấu hình riêng, chưa triển khai; không lấy token GitHub bằng frontend).
5. Để gỡ bỏ một nhạc cụ, tạo một phiên bản mới bỏ mục tương ứng khỏi manifest; không xóa file nào không có xác nhận.

## Định dạng và giới hạn
- `.wav`: nhạc cụ dạng 1 sample có nốt gốc `rootMidi` (21–108). Sau khi phát hành, MELORIX tải WAV trực tiếp từ URL thuộc cùng website, giải mã tại trình duyệt và tạo track; reload vẫn thấy mục này ở danh mục và có thể chọn lại (mẫu phát được cache bởi trình duyệt tùy tình trạng kết nối). Đây không phải engine Kontakt và không mô phỏng đầy đủ nhạc cụ đa sample.
- `.nki`: tệp NKI **được phân phối nếu được cấp quyền** và có thể tải xuống từ thư viện chung, người dùng mở trong Kontakt 8 tương thích; MELORIX chỉ điều khiển bằng Web MIDI/loopMIDI. Không tự giải mã NKI hay yêu cầu họ tải WAV vào MELORIX. Nếu nhạc cụ dùng thư mục Samples tách rời thì muốn sử dụng ở máy khác phải phát hành hợp pháp **toàn bộ dependency phù hợp**, hoặc cung cấp hướng dẫn nguồn của nhà sản xuất. Không giả định NKI lúc nào cũng chứa toàn bộ âm thanh.
- Cloudflare Pages/GitHub có giới hạn kích thước tệp và dung lượng, nên tệp lớn cần kho phân phối khác (R2/CDN) và thống nhất trước khi sử dụng; **không tự kích hoạt dịch vụ trả phí**.
- Danh mục khởi tạo là **rỗng có chủ đích**, do người dùng chưa cung cấp tệp và xác nhận giấy phép chia sẻ công cộng. Chưa có nhạc cụ ngoài bản mặc định nào đã được xuất bản.

## Phân quyền và bảo mật
- Mọi người: được xem thư viện và sử dụng những file đã được phát hành.
- Chỉ chủ dự án qua GitHub PR được duyệt: được thêm/sửa/xóa bản phát hành.
- Không có endpoint upload công khai hoặc khóa API/gh token nhúng vào JS client. **Tính năng tải từ trình duyệt trực tiếp thành nội dung chung chưa được xây dựng**; không nói nhập WAV trong RAM là phát hành toàn hệ thống.
- `src/util/melorix-published-library.ts` lọc dữ liệu manifest (id, tên file, đúng extension, `redistributionApproved:true`, giấy phép; path ở cùng domain), tránh file không duyệt/traversal hay URL tùy ý.
