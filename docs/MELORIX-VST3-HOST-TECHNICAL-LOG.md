# MELORIX Native VST3 Host — Technical Project Log

**Ngày 21/10/2026 — quyết định sản phẩm đã được chủ dự án xác nhận.**

## Mục tiêu không thay đổi
MELORIX Desktop phải hoạt động như một VST3 host thật trên Windows 10/11 x64, giống đường đi audio của DAW:
**MELORIX → native VST3 host → Kontakt VST3 đã cài trên máy → nhạc cụ NKI được cấp phép → audio engine → soundcard**.

Người dùng yêu cầu đủ 5 chức năng: (1) quét VST3 Windows; (2) nạp Kontakt **trong MELORIX** không mở Standalone; (3) chọn plugin/instance riêng cho từng track MIDI; (4) mở chính giao diện native Kontakt để người dùng chọn NKI; (5) render stereo/multichannel thực, track Volume/Mute/Solo và xuất bản phối. **loopMIDI chỉ là fallback của Desktop đời trước, không được đòi hỏi trong VST3 Host mới**.

## Giấy phép và lựa chọn kỹ thuật
- Dùng [Steinberg VST3 SDK](https://github.com/steinbergmedia/vst3sdk) **MIT**, tương thích với giấy phép MIT hiện có của repo. Phải giữ copyright/notice nếu đưa SDK vào sản phẩm.
- KHÔNG dùng JUCE AGPL/commercial mà không đánh giá/xin phép trước. Việc download SDK trong GitHub CI chỉ phục vụ build test, không tải plugin Kontakt, NKI hay các sample thương mại.
- Tách giao diện Vue/Electron khỏi native audio engine riêng trên Windows. Không nạp DLL tùy ý trong Electron renderer hoặc luồng audio UI.
- Không thể chuyển việc host VST3 trực tiếp sang Cloudflare Pages (trình duyệt không load DLL native). Phần thiết kế giao diện vẫn có thể preview web; kiểm thử âm thanh Kontakt cần Windows thật.
- Plugin VST3 bên ngoài phải được coi là mã không tin cậy; kiểm soát lifetime/crash/hang, yêu cầu người dùng chủ động mở; cơ chế cách ly process cần cân nhắc để một plugin lỗi không làm hỏng toàn app.

## Các cột mốc có kiểm chứng

### GĐ1 — Discovery/bridge (đang triển khai; chưa là VST3 host)
- Duyệt thư mục VST3 hệ thống bằng scanner native C++17 Windows x64; không LoadLibrary; không tải thư viện từ mạng; không gửi danh sách plugin hay đường dẫn cá nhân lên cloud.
- Electron preload API `scanVst3` được kiểm soát qua origin `melorix://app` và IPC, sandbox/contextIsolation. Giao diện Desktop hiển thị plugin được tìm thấy, ghi rõ **chưa thể phát Kontakt**.
- GitHub standard Windows runner miễn phí phải biên dịch C++ scanner, tạo fixture `Kontakt 8.vst3` giả **chỉ cho test thư mục/metadata**, xác nhận `discovery-only`; sau đó package Native helper trong `extraResources`. Fixture tuyệt đối KHÔNG được dùng để tuyên bố đã chạy Kontakt thật.
- QA: scanner thực trên máy người dùng tìm đúng plugin Kontakt đã cài hoặc hỗ trợ thêm thư mục tùy chọn nếu hệ thống cài nơi khác.

### GĐ2 — Real host, test bằng VST3 miễn phí
- Tạo native process bằng VST3 SDK thực: module loading, `IPluginFactory`, class info, `IComponent/IEditController`, processor setup/activation, event list, process() và bus mapping. Đóng và giải phóng đúng vòng đời.
- Chạy thử một plugin VST3 **test** hợp pháp có thể phát audio trên Windows runner hoặc VM, xác minh WAV/PCM tạo từ MIDI thật, không phải oscillator mô phỏng.
- Bố trí audio driver Windows WASAPI/ASIO phù hợp trong native process; giám sát xruns, tránh gửi audio qua IPC/WebSocket theo từng sample.

### GĐ3 — Kontakt VST3 thật và editor
- Tự động tìm Kontakt VST3 đã cài trên **PC người dùng**, khởi tạo instance. Mở `IPlugView`/HWND cửa sổ plugin và gắn vào vùng giao diện MELORIX Windows; người dùng chọn NKI trong Kontakt thật.
- Test Note On/Off, sustain/CC, track channel, load/save plugin state, startup/restart và xử lý lỗi thiếu library/license.
- Chỉ xác nhận “đã chạy Kontakt” khi audio render từ Kontakt thật trên PC hoặc môi trường đã cài Kontakt hợp lệ.

### GĐ4 — Mix/export/DAW
- Mỗi track có plugin instance/routing riêng, MIDI scheduling theo sample clock, audio buses, Volume/Mute/Solo đúng nghĩa audio. Có thể render offline nếu Kontakt hỗ trợ; nếu không, thu real-time để không mất audio/script và export thành WAV/MP4.
- Quản lý project lưu MIDI, đường dẫn plugin (không copy plugin/NKI trái phép), preset state, sample rate, buffer size, effects/routing, tránh thay dữ liệu người dùng ngoài vùng dự án.

## Trạng thái hiện tại / giới hạn cứng
Code GĐ1 scan-native đã được tạo trên `feature/melorix-native-vst3-host`, branch phát triển riêng từ `feature/melorix-desktop-kontakt-live`. Phần đang tạo này **chỉ đọc danh sách VST3**, chưa host plugin, chưa mở giao diện Kontakt, chưa thu audio; không ngụy tạo hay phát hành dưới tên VST3 Host hoàn chỉnh. Chưa merge main/Production; không dùng CMD trên PC, không yêu cầu kết nối trả phí, không tải hay chạm vào plugin Kontakt/NKI của người dùng. Mọi bản Windows mới phải được người dùng thử và duyệt.
