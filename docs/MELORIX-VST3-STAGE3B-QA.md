# MELORIX Native VST3 Host — Giai đoạn 3B: Windows Plugin Editor

**Ngày:** 21/10/2026 · **Trạng thái:** Win32 VST3 editor QA PASS bằng plugin SDK thực · Kontakt 8/NKI trên máy người dùng chưa nghiệm thu.

## Yêu cầu đã xác nhận
Người dùng muốn giống Cubase: mở **Kontakt VST3 trực tiếp từ MELORIX Desktop**, không loopMIDI/Kontakt Standalone; plugin editor dùng chính mã vendor, chọn thư viện NKI và gắn plugin vào từng track. GĐ3B tập trung giao diện native, GĐ3C mới là audio live, GĐ3D QA Kontakt.

## Triển khai trên Draft PR #44
- Nhánh `feature/melorix-vst3-stage3b-native-editor`, base GĐ3A `feature/melorix-vst3-stage3-track-instances`, Draft PR https://github.com/code-ai3/piano-hieu-ung/pull/44. Không merge vào main/Production.
- `native/vst3-host/editor-win32.hpp` — Windows HWND editor host dùng `IEditController::createView(ViewType::kEditor)`, `IPlugView::isPlatformTypeSupported(kPlatformTypeHWND)`, `setFrame(IPlugFrame)`, `attached(hwnd,kPlatformTypeHWND)` và `removed()` lúc đóng; resize native, quản lý refcount, vẽ giao diện là chính plugin đảm nhiệm.
- `native/vst3-host/session.cpp` — mỗi track giữ `IPtr<IEditController>` và EditorWindow cùng với IComponent; controller riêng được khởi tạo nếu được factory cung cấp Controller Class ID; Win32 STA message loop xử lý vendor GUI trên **cùng thread tạo plugin**, reader thread chỉ queue lệnh. Mỗi cửa sổ native editor là **cửa sổ thuộc MELORIX**, không phải màn giả lập hoặc Kontakt Standalone. Editor không được dock trực tiếp vào vùng Vue/HTML; định hướng dock ở chặng sau nếu khả thi.
- `desktop/main.cjs` và `desktop/preload.cjs` — IPC `editor-open/editor-close` theo track, chỉ main frame `melorix://app`; Electron tự đọc **HWND thật của BrowserWindow**, renderer không được cung cấp HWND hay đường dẫn DLL tùy ý.
- `src/components/MelorixVst3Browser.vue` — Mở giao diện VST3 / Đóng giao diện bên cạnh plugin đã gán cho track; trạng thái chỉ báo khởi tạo/editor và không quảng cáo có audio Kontakt.
- `native/vst3-host/test-synth.cpp` — mở rộng nhạc cụ VST3 QA được biên dịch qua Steinberg SDK thành **plugin có IEditController + CPluginView** tự tạo điều khiển con native Win32. Đây là fixture GUI thật, không phải Kontakt và không phải NKI.
- `tests/melorix-vst3-stage3b.mjs` — kiểm tra có code IPlugView/STA HWND owner, Electron IPC, UI trạng thái, không lẫn audio GĐ3C.

## Bằng chứng QA
**Native Windows GitHub Actions https://github.com/code-ai3/piano-hieu-ung/actions/runs/39491449638 — COMPLETED SUCCESS.**

Các phép thử gồm:
- GĐ2: MIDI Note On/Off → VST3 thật `IAudioProcessor::process()` → WAV PCM stereo 44,1 kHz peak 0,153.
- GĐ3A: host long-running nạp độc lập hai VST3 instances theo track; gỡ một không mất track còn lại.
- GĐ3B: load plugin QA có editor thật; gửi `EDITOR_OPEN track=8 owner=0`; `IPlugView` gắn vào cửa sổ HWND Win32; LIST phản hồi `editorOpened=true`; gửi `EDITOR_CLOSE` rồi LIST phản hồi `editorOpened=false`, instance track vẫn còn. Test mở editor của track không tồn tại bị từ chối, session không crash.
- Steinberg ADelay VST3 thật load / initialize / release không crash, không dùng bản sao Kontakt/NKI.

**Giới hạn chứng cứ:** Test tích cực trên GitHub xác minh HWND/IPlugView của *plugin QA*, không thể chứng minh mở Kontakt GUI thật (runner không cài Kontakt có bản quyền), cũng không đánh giá NKI, chất tiếng, audio-device/latency hoặc xử lý playback. Windows Desktop build/TypeScript/Portable-Setup cần CI riêng.

## Tiếp theo
- **GĐ3C:** native host soundcard WASAPI/ASIO, MIDI Piano Roll → VST3 events/process, audio buses và mix theo track, latency/clock, Mute/Solo/Volume và xuất PCM từ plugin.
- **GĐ3D:** nghiệm thu với Kontakt VST3 đã cài và được cấp phép trên Windows người dùng: mở GUI thật, chọn NKI, lưu/trả plugin state, phát nốt & xuất âm thanh đúng tiếng Kontakt; khi đó mới cho tải bản Kontakt-ready.
- Nếu Kontakt GUI cần `IComponentHandler`, `IConnectionPoint` hoặc cơ chế DPI/resize riêng, bổ sung theo SDK và kết quả thử thật; không phỏng đoán hoặc báo đã tương thích khi chưa QA.

**Quy tắc:** không sửa Production, không tự merge, không dùng loopMIDI trong kiến trúc VST3 Host, không yêu cầu CMD hoặc mua dịch vụ, không sao chép Kontakt/NKI lên cloud.
