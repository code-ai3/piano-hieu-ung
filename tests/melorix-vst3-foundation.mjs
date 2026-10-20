import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const native=readFileSync(new URL('../native/vst3-scan/main.cpp',import.meta.url),'utf8')
const main=readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8')
const preload=readFileSync(new URL('../desktop/preload.cjs',import.meta.url),'utf8')
const builder=readFileSync(new URL('../electron-builder.yml',import.meta.url),'utf8')
const ui=readFileSync(new URL('../src/components/MelorixVst3Browser.vue',import.meta.url),'utf8')
const view=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
for(const phrase of [
 'std::filesystem',
 'scan(const fs::path& folder',
 'fs::directory_options::skip_permission_denied',
 'extension==L".vst3"',
 'Contents',
 'x86_64-win',
 'GetEnvironmentVariableW',
 'WideCharToMultiByte',
 '"discovery-only"',
 'hasBinary',
])assert.ok(native.includes(phrase),'Missing native scanner control: '+phrase)
assert.ok(!native.includes('LoadLibrary'),'Scanner must not execute arbitrary VST3 DLLs')
assert.ok(!native.includes('CreateProcessW'),'Scanner must not start plugin binaries')
for(const phrase of [
 "ipcMain.handle('melorix:vst3:scan'",
 'isTrustedAppUrl(event.senderFrame.url)',
 'execFile(exe,[],{',
 'windowsHide:true,timeout:20000,maxBuffer:2*1024*1024',
 "result.engine!=='discovery-only'",
 "preload: path.join(app.getAppPath(), 'desktop', 'preload.cjs')",
 'nodeIntegration: false',
 'contextIsolation: true',
 'sandbox: true'
]) assert.ok(main.includes(phrase),'Missing native-to-UI IPC restriction: '+phrase)
assert.ok(preload.includes("contextBridge.exposeInMainWorld('melorixDesktop'"))
assert.ok(preload.includes("ipcRenderer.invoke('melorix:vst3:scan')"))
assert.ok(!preload.includes('fs.readFile'),'Preload should not expose general file reads')
assert.ok(builder.includes('desktop/preload.cjs'))
assert.ok(builder.includes('native/bin/melorix-vst3-scan.exe'))
assert.ok(builder.includes('to: vst3/melorix-vst3-scan.exe'))
assert.ok(ui.includes('Đang quét…'))
assert.ok(ui.includes('chưa thể mở Kontakt hoặc phát VST3'))
assert.ok(ui.includes('async function scanInstalled()'))
assert.ok(ui.includes('api.scanVst3()'))
assert.ok(view.includes('hasNativeVst3Scanner'))
assert.ok(view.includes('<MelorixVst3Browser v-if="showVst3Browser"'))
assert.ok(!main.includes('vst3:load'),'Scanner must not claim real plugin hosting yet')
console.log('PASS: native plugin discovery architecture, scoped Electron IPC, security and truthful VST3 UI')
