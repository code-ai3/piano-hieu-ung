# MELORIX — Thư viện nhạc cụ chung (Phương án A)

Mục tiêu: tệp nhạc cụ đã **phát hành** nằm trong bản MELORIX do chủ dự án quản lý và được mọi người dùng nhìn thấy qua menu `Nhạc cụ → Thư viện nhạc cụ chung`. Danh mục **không lưu trong RAM/localStorage/IndexedDB**. F5, xóa cache, máy khác hoặc người dùng mới đều lấy từ cùng bản phát hành.

## Tình trạng gói phát hành thử — 19/10/2026

Chủ thư viện đã xác nhận trong trò chuyện rằng có quyền phân phối công khai. Catalog hiện dự kiến có **32 NKI** và **1 NKM** từ Drive; 18 NKI nhỏ đã được đóng gói trực tiếp vào Preview, 14 NKI và 1 NKM còn lại có link mở file gốc trên Google Drive. Có liên kết thư viện Samples cho 31/33 mục; hai mục chưa xác định đầy đủ sample là Picked Acoustic (Melody) và Roland A-500S Sampler Mansome. Đây là phân phối tệp nhạc cụ, **không** phải cài Kontakt lên máy người dùng hoặc chạy `.nki` trong web.

Hmong Sampler có các folder Samples/WAV riêng (Erhu, Dizi, Drum Mix, v.v.), Yamaha S90ES Natural Grand có khoảng 214 .ncw (~232 MB), Junior S90 ES có .nkx ~1.31 GB. Dữ liệu sample lớn **chưa được sao chép vào Cloudflare Pages/GitHub**; link Drive mở thư mục gốc để người dùng tải nguyên cấu trúc hợp lệ. Một số bộ cần cài đủ tài nguyên và liên kết lại thư mục sample trong Kontakt. Google Drive có thể giới hạn tải; không được tuyên bố các sample lớn có sẵn offline hay ứng dụng phát NKI trực tiếp. NKM chỉ mở trong Kontakt.

**Không phát hành lên Production** cho đến khi chủ sở hữu xác nhận bản Preview; không sử dụng dịch vụ trả phí. Catalog là một phần của source/release, không nằm trong localStorage; thư viện hiện có truy cập toàn bộ tên tệp sau reload. Các đường dẫn Drive bên ngoài không phải lời hứa lưu trữ độc lập hay hoạt động ngoại tuyến.

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
- Danh mục ban đầu rỗng đã được thay thế ở nhánh Preview mới bằng các tệp NKI/NKM người dùng cung cấp. Các gói sample lớn chỉ liên kết Drive, không đi kèm bản web.

## Phân quyền và bảo mật
- Mọi người: được xem thư viện và sử dụng những file đã được phát hành.
- Chỉ chủ dự án qua GitHub PR được duyệt: được thêm/sửa/xóa bản phát hành.
- Không có endpoint upload công khai hoặc khóa API/gh token nhúng vào JS client. **Tính năng tải từ trình duyệt trực tiếp thành nội dung chung chưa được xây dựng**; không nói nhập WAV trong RAM là phát hành toàn hệ thống.
- `src/util/melorix-published-library.ts` lọc dữ liệu manifest (id, tên file, đúng extension, `redistributionApproved:true`, giấy phép; path ở cùng domain), tránh file không duyệt/traversal hay URL tùy ý.
