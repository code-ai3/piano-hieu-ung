# MELORIX Native VST3 Host — Giai đoạn 3A: Track Instances

**Trạng thái:** Native Track Instance Host đã vượt qua Windows CI; phần đóng gói Desktop và Kontakt editor/audio chưa nghiệm thu.
**Nhánh:** `feature/melorix-vst3-stage3-track-instances` · **Draft PR:** https://github.com/code-ai3/piano-hieu-ung/pull/43

## Đã triển khai

- `native/vst3-host/session.cpp`: tiến trình Windows x64 riêng, có thể tồn tại qua nhiều lệnh. Giao thức dòng UTF-8 trên stdin/stdout với PING, LOAD(track,path), LIST, UNLOAD(track), QUIT. Dùng **Steinberg SDK VST3 thực**, khởi tạo IComponent cho từng track (giới hạn 32), giữ owning `Steinberg::IPtr<IComponent>` xuyên suốt session, đảm bảo terminate/release trước khi DLL module unload. Không tự khởi chạy bất kỳ plugin nào khi quét.
- `desktop/vst3-session.cjs`: Electron main process chạy subprocess bằng `spawn` với `shell:false`, FIFO request/response JSON, timeout 15 giây, dọn tác vụ khi child crash hoặc đóng app. Không chạy VST3 DLL trong Electron renderer.
- `desktop/main.cjs` và `desktop/preload.cjs`: chỉ chính main frame `melorix://app` được gửi IPC. Đường dẫn .vst3 phải thuộc tập cho phép lấy từ kết quả quét native gần nhất trên chính cửa sổ đang yêu cầu. Track ID được kiểm soát, không có Node.js/FS hoặc lệnh shell bất kỳ exposed cho trình duyệt.
- `src/components/MelorixVst3Browser.vue`: hiển thị danh sách VST3 đã cài trên PC, chọn track MIDI thực tế, gắn/gỡ plugin và xác nhận trạng thái **khởi tạo instance**, không giả vờ đã mở GUI hoặc nghe Kontakt. `PianoView.vue` truyền track ID/tên thực.
- `electron-builder.yml` và Desktop Windows CI: đưa native VST3 Host vào `extraResources` khi tạo Portable/Setup, kèm scanner. Giai đoạn đóng gói chưa chứng minh chạy plugin trên máy thật.
- `tests/melorix-vst3-stage3.mjs`: hợp đồng lifetime, IPC allowlist, UI trạng thái. Giữ tests trước của GĐ2A/B.

## Kết quả kiểm chứng thực

**GitHub Actions Windows https://github.com/code-ai3/piano-hieu-ung/actions/runs/39486444031 — SUCCESS.**
- C++17/MSVC SDK 3.8.1 build thành công.
- Dùng `melorix-test-synth.vst3` thật của dự án (Steinberg SDK) để nạp 2 instance độc lập theo track 1 và 2 trong **cùng tiến trình đang sống**, LIST xác nhận 2; LOAD path Kontakt không tồn tại bị từ chối và 2 instance vẫn giữ nguyên; UNLOAD track 1 không ảnh hưởng track 2; QUIT sạch.
- Bài thử GĐ2B MIDI → VST3 `process()` → WAV PCM với peak 0,153 vẫn PASS, và ADelay VST3 thật được load/initialize/release đúng chuẩn.
- Đây là **bài test với plugin thử thực**, KHÔNG test Kontakt có giấy phép hoặc NKI.

## Lỗi đáng nhớ
Trong lần đầu, session gán `factory.createInstance<IComponent>(...)` trả `IPtr` *tạm* vào `IComponent*` thô, tạm thời bị hủy ngay sau biểu thức và gây heap crash. Phải lưu đối tượng bằng owning `Steinberg::IPtr<IComponent>`, sau đó giải phóng trước DLL Module. Các lỗi VM test Electron require tương đối và snapshot UI cũ cũng được cập nhật cho kiến trúc mới.

## Những thứ chưa thể tuyên bố hoàn thành

- **Không có Kontakt VST3 GUI** trong MELORIX; chưa tạo/call `IPlugView`, IEditController, HWND hoặc IPlugFrame.
- **Không có tiếng Kontakt khi bấm Play:** Persistent instances ở đây mới khởi tạo, chưa có block-based audio/MIDI processing loop, driver WASAPI/ASIO, disk streaming, latency routing, synth parameters/state và output bus.
- **Không có audio mixing/export Kontakt:** Chưa có real-time lẫn offline export từ instance theo từng track. Web bản cũ và Production không đổi.
- Chưa QA trên máy Windows cài Kontakt thật; không tự tải/đụng NKI, không cần loopMIDI trong kiến trúc VST3 trực tiếp. Không merge.

## Công việc tiếp theo GĐ3B–D

1. GĐ3B: mở **cửa sổ editor của plugin thật**, sử dụng chính VST3 IEditController/IPlugView + HWND/IPlugFrame, có message loop Win32 và quản lý độ phân giải/lifetime; gọi từ Desktop không mở Kontakt Standalone.
2. GĐ3C: engine audio RT xử lý MIDI từ Piano Roll, kích hoạt IAudioProcessor/process per track, WASAPI hoặc ASIO, xử lý đa bus, route 32-bit float, Mute/Solo/Volume.
3. GĐ3D: thử **Kontakt VST3 được cấp phép trên PC người dùng**, mở GUI chọn NKI, lưu plugin/project state, xuất WAV/MP4 từ âm plugin, xác nhận chất âm với người dùng trước khi phát hành.

**Quy tắc sản phẩm:** GitHub QA miễn phí và code branch-first, không CMD máy user, không tính phí khi chưa duyệt, không merge Main/Production khi chưa nghiệm thu.
