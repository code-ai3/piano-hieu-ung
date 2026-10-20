# MELORIX Native VST3 — Giai đoạn 2A/2B: báo cáo kiểm chứng

**Ngày:** 21/10/2026  
**Phạm vi:** bộ nạp VST3 thật và đường MIDI → `IAudioProcessor::process()` → WAV PCM trên Windows x64, không phải bản Desktop tích hợp Kontakt.

## Mã nguồn / cách kiểm thử
- `native/vst3-host/probe.cpp`: nạp module bằng `VST3::Hosting::Module::create`, đọc factory, thử khởi tạo `IComponent` và `IAudioProcessor` theo yêu cầu, giải phóng đối tượng factory trước khi tháo DLL. Có kiểm tra đường dẫn không hợp lệ và chạy plugin trong tiến trình riêng.
- `native/vst3-host/offline-render.cpp`: render 1 giây, 44.100 mẫu/giây, hai kênh, 16-bit PCM trong WAV. Host gửi Note On ở đầu và Note Off tại 0,5 giây qua `EventList`. **Host không sinh tiếng bằng oscillator**: các mẫu PCM được đọc trực tiếp từ `IAudioProcessor::process()` của plugin.
- `native/vst3-host/test-synth.cpp`: nhạc cụ VST3 thử nghiệm thực sự, biên dịch bằng Steinberg SDK 3.8.1 (MIT), đáp ứng hai sự kiện MIDI và tạo sin qua `process()`. Đây là plugin QA riêng do MELORIX tự viết, **không phải Kontakt hoặc nhạc cụ thương mại**.
- `native/vst3-host/CMakeLists.txt`: Windows MSVC/Ninja, SDK 3.8.1 ghim commit `3cdf9ca5d1f5b1b21e0a86832aa4abe55607bd96`; link SDK hosting cùng `module_win32.cpp`, plugin QA riêng và Steinberg ADelay.
- `.github/workflows/melorix-vst3-host-probe.yml`: CI Windows miễn phí, quét bằng source tests, biên dịch/khởi chạy bộ xử lý thật, xác minh PCM không rỗng, peak giới hạn và nốt im sau Note Off, nạp và khởi tạo plugin ADelay chính thức của Steinberg.

## Bằng chứng kiểm thử cuối
**GitHub Actions run #39483846115**:  
https://github.com/code-ai3/piano-hieu-ung/actions/runs/39483846115

**Kết quả: SUCCESS toàn bộ các bước.**
- Native SDK build pass, source test stage 2A+2B pass.
- MIDI Note On/Off → plugin test qua `IAudioProcessor::process()` → PCM stereo 44,1 kHz **PASS**, peak 0,153, có 44.100 frame, phần sau Note Off im tiếng.
- Steinberg **ADelay VST3 thật** được nạp, factory có **3 lớp**, `IComponent` initialize + `IAudioProcessor` query thành công rồi giải phóng và unload, không crash.
- Thử plugin path không tồn tại trả lỗi được kiểm soát.
- Chỉ tạo artifact *engineering-only* `MELORIX-VST3-loader-probe-x64-NOT-RELEASE`, ID `12292826907`, không phải trình cài MELORIX. Không đưa binary host/plugin thương mại hoặc âm thanh NKI vào repo.

## Lỗi đã sửa dựa trên log GitHub, không đoán
- Runner dùng Visual Studio 2026 nên Ninja/MSVC thay generator VS 2022 cứng.
- Header `vsttypes.h`, macro `kVstAudioEffectClass`, và mã nạp `module_win32.cpp` của SDK.
- CMake SDK `PROJECT_VERSION`, `SDK_ROOT`, helper mẫu `smtg_target_setup_as_vst3_example`, projectversion.h.
- Điều chỉnh `SMTG_CREATE_BUNDLE_FOR_WINDOWS=OFF` để CI tìm đúng DLL `.vst3` độc lập.
- Override `setProcessing()` của plugin QA, vì `AudioEffect` mặc định trả `kNotImplemented`.
- **Quan trọng:** không được `module.reset()` trước khi wrapper `PluginFactory` bị hủy: lỗi này làm ADelay crash với mã 0xC0000005. Sửa thứ tự sống/chết đối tượng theo scope rồi kiểm chứng ADelay thành công.

## Giới hạn chưa hoàn thành
- PCM chứng minh audio từ một nhạc cụ **VST3 thử nghiệm**, **không** chứng minh Kontakt/VST3 NKI của người dùng đã được mở, cấp phép, hoặc phát tiếng.
- Bộ render hiện là **công cụ QA cố định 1 giây**; chưa nhận file MIDI dự án nhiều track, chưa có real-time WASAPI/ASIO, chưa có UI plugin qua `IPlugView`, chưa quản lý đa instance, chưa lưu/khôi phục state Kontakt, chưa gắn audio render với export MELORIX.
- Chưa kết nối renderer native vào giao diện Electron hoặc nút chọn nhạc cụ; bản web và Desktop hiện có không bị thay đổi.
- Chưa có giấy phép/installer hoặc bản phát hành mới, không cung cấp user file .exe gọi là Kontakt host.

## Bước tiếp theo — Giai đoạn 3
1. Tạo tiến trình host chạy lâu dài để quản lý instance/plugin từng track; giao thức IPC có kiểm tra quyền.
2. Tích hợp realtime Windows WASAPI/ASIO, MIDI scheduling, event queues và PCM routing (không gửi PCM từng sample qua Electron IPC).
3. Dùng chính `IPlugView` và HWND để mở UI Kontakt VST3 trên máy Windows có plugin hợp lệ; chọn NKI, lưu/khôi phục state.
4. Thử plugin Kontakt thực với soundcard của người dùng, xác minh âm thanh và xử lý plugin crash riêng; chỉ khi đó mới có bản Desktop thử để nghiệm thu.
5. Mute/Solo/Volume per-track và xuất mix WAV/MP4 từ âm thanh plugin, có xử lý Kontakt disk streaming và fallback render thời gian thực nếu cần.

**Quy tắc:** không merge main/Production, không cần loopMIDI cho kiến trúc VST3 host, không chạy CMD trên PC người dùng, không tự mua dịch vụ hay tải/copy NKI.
