# MELORIX G.3 — Kiểm thử đa nhạc cụ GM và ngăn phát mẫu dự phòng ở đầu bài

Nền đã đọc: nhật ký kỹ thuật trung tâm, G.2 PR #62 (HEAD b3be020), GitHub Actions 2/2 PASS, Cloudflare Preview được xác nhận. Chủ dự án yêu cầu G.3. Branch feature/melorix-g3-multi-instrument-parity tách khỏi G.2; không merge Main hoặc Production.

## Mục tiêu
1. Đo tín hiệu thật của 5 GM đại diện: Bright Acoustic Piano (program 1), Steel Guitar (25), Finger Bass (33), Violin (40), String Ensemble (48); không tuyên bố đã đo cả 128 GM.
2. Khắc phục khác biệt chất âm đầu bài: WebAudio live preload GM bất đồng bộ rồi phát ngay nên nốt đầu có thể thành fallback oscillator, trong khi offline luôn chờ SoundFont; Stage G3 chờ toàn bộ các track GM đang được phát load xong đồng thời (tối đa 18s) trước khi schedule. Nếu tải thất bại, báo lỗi bằng tiếng Việt thay vì giả vờ chơi đúng tiếng GM.
3. Đo cùng tín hiệu PCM: lấy bản thu real live mono qua AudioContext ScriptProcessor (chỉ QA), so với WAV offline đã xuống mono L/R nhất quán (equal-power center pan), dùng RMS attack/tail, spectral centroid và tỉ trọng 3 dải tần. G2 lấy riêng offline L trong khi live đã downmix mono; G3 sửa sai khác phương pháp đo này. Hai đường cùng smplr SampleLoader/FluidR3_GM từ G2, kiểm fallback trống.
4. Các regression A–G2 (MP4 H264/AAC, WAV/FX, stress ~3 phút, sample strict) giữ nguyên. Unit G3 kiểm đúng GM program mapping, guard Play đợi sample, CI workflow cho nhánh.
5. Không tải thêm thư viện GM vào repo hoặc sử dụng dịch vụ mới; nguồn FluidR3 GM cần attribution CC BY 3.0. Không CMD Windows, không TinyFish.

## Tiêu chí nghiệm thu
GitHub Actions 2/2 PASS và Cloudflare Pages check completed/success đúng commit mới mới giao Preview. Các chỉ số onset/attack/tail/centroid sẽ được trình bày tách biệt với chất lượng nghe chủ quan. Nếu bất kỳ fixture nào không tải được mẫu thật hoặc xuất khác quá mức, đọc log rồi sửa; không bỏ qua.
