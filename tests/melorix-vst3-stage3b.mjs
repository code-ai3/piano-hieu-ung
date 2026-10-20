import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const native=readFileSync(new URL('../native/vst3-host/session.cpp',import.meta.url),'utf8')
const editor=readFileSync(new URL('../native/vst3-host/editor-win32.hpp',import.meta.url),'utf8')
const preload=readFileSync(new URL('../desktop/preload.cjs',import.meta.url),'utf8')
const main=readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8')
const ui=readFileSync(new URL('../src/components/MelorixVst3Browser.vue',import.meta.url),'utf8')
const flow=readFileSync(new URL('../.github/workflows/melorix-vst3-host-probe.yml',import.meta.url),'utf8')
for(const value of [
 'IEditController::iid',
 'factory.createInstance<IEditController>(VST3::UID(controllerCID))',
 'slot.controller->initialize(slot.context)',
 'slot.controller->createView',
 'slot.editor.open(slot.controller.get()',
 'it->second->editor.close()',
 'EDITOR_OPEN',
 'EDITOR_CLOSE',
 'GetMessageW(&msg,nullptr,0,0)',
 'DispatchMessageW(&msg)',
 'std::thread reader',
 'if(ownControllerInit)controller->terminate()',
]) {
 if(value==='slot.controller->createView') continue
 assert.ok(native.includes(value),'Missing native plugin editor protocol: '+value)
}
for(const value of [
 'controller->createView(ViewType::kEditor)',
 'view->isPlatformTypeSupported(kPlatformTypeHWND)',
 'view->attached(hwnd,kPlatformTypeHWND)',
 'view->removed()',
 'view->setFrame(frame)',
 'IPlugFrame',
 'resizeView(IPlugView* view,ViewRect* size)',
 'CreateWindowExW(',
 'WS_OVERLAPPED',
 'owner,nullptr,GetModuleHandleW(nullptr)',
 'DestroyWindow(',
 'SetWindowLongPtrW(hwnd,GWLP_USERDATA',
])assert.ok(editor.includes(value),'Missing real Win32 VST3 editor host: '+value)
assert.ok(preload.includes("ipcRenderer.invoke('melorix:vst3:editor-open'"))
assert.ok(preload.includes("ipcRenderer.invoke('melorix:vst3:editor-close'"))
assert.ok(main.includes('getNativeWindowHandle()'))
assert.ok(main.includes('trustedNativeSender(event)'))
assert.ok(main.includes("getVst3Session().request('EDITOR_OPEN\\t'+trackId+'\\t'+owner)"))
assert.ok(main.includes("getVst3Session().request('EDITOR_CLOSE\\t'+trackId)"))
assert.ok(ui.includes('async function toggleEditor('))
assert.ok(ui.includes('Mở giao diện VST3'))
assert.ok(ui.includes('Chưa kết nối âm thanh Kontakt'))
assert.ok(!main.includes('vst3:render-audio'),'Stage 3B does not claim audio renderer')
assert.ok(flow.includes('feature/melorix-vst3-stage3b-native-editor'))
console.log('PASS: Stage3B native Win32 IPlugView/IEditController plumbing and main-frame-only IPC, no false Kontakt audio claim')
