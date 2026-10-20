import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const native=readFileSync(new URL('../native/vst3-host/session.cpp',import.meta.url),'utf8')
const cmake=readFileSync(new URL('../native/vst3-host/CMakeLists.txt',import.meta.url),'utf8')
const main=readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8')
const preload=readFileSync(new URL('../desktop/preload.cjs',import.meta.url),'utf8')
const browser=readFileSync(new URL('../src/components/MelorixVst3Browser.vue',import.meta.url),'utf8')
const view=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
const workflow=readFileSync(new URL('../.github/workflows/melorix-vst3-host-probe.yml',import.meta.url),'utf8')

for(const marker of [
 'VST3::Hosting::Module::create(utf8(path.wstring()),error)',
 'std::map<int,std::unique_ptr<Loaded>> instances',
 'candidate->component->initialize(candidate->context)',
 'instances[id]=std::move(candidate)',
 'instances.erase(id)',
 'instances.clear()',
 'if(initialized)component->terminate()',
 'component=nullptr;',
 'module.reset()',
 'factory.classInfos()',
 'if(instances.size()>=32',
 'process(line)',
 '"PING"',
 '"LIST"',
 '"QUIT"',
 'parsePluginPath(raw,path)',
 'std::getline(std::cin,line)',
])assert.ok(native.includes(marker),'Missing real persistent VST3 component lifecycle: '+marker)
assert.ok(native.indexOf('component=nullptr')<native.indexOf('module.reset()'),
 'VST3 component must be released before its DLL is unloaded')
assert.ok(!native.includes('IAudioProcessor::process('),
 'Stage3A session must not masquerade as a live audio engine')
assert.ok(!native.includes('IPlugView::attached('),
 'Stage3A session must not claim native Kontakt editor integration')
assert.ok(cmake.includes('add_executable(melorix-vst3-session'))
assert.ok(preload.includes("ipcRenderer.invoke('melorix:vst3:bind'"))
assert.ok(preload.includes("ipcRenderer.invoke('melorix:vst3:unbind'"))
assert.ok(preload.includes("ipcRenderer.invoke('melorix:vst3:tracks'"))
assert.ok(main.includes('trustedNativeSender(event)'))
assert.ok(main.includes('event.senderFrame===event.sender.mainFrame'))
assert.ok(main.includes('vst3Approvals.set(event.sender.id,new Set('))
assert.ok(main.includes('approvedPluginPath(pluginPath,'))
assert.ok(main.includes('validTrackId(trackId)'))
assert.ok(main.includes('vst3Session?.shutdown()'))
assert.ok(main.includes("getVst3Session().request('LOAD\\t'+trackId+'\\t'+selected)"))
const {validTrackId,approvedPluginPath,Vst3Session}=require('../desktop/vst3-session.cjs')
assert.equal(validTrackId(1),true)
assert.equal(validTrackId(0),true)
for(const id of [-1,1.5,'1',NaN,Infinity,10000001])assert.equal(validTrackId(id),false)
const found=new Set(['c:\\program files\\common files\\vst3\\kontakt 8.vst3'])
assert.equal(approvedPluginPath('C:\\Program Files\\Common Files\\VST3\\Kontakt 8.vst3',found),
 'C:\\Program Files\\Common Files\\VST3\\Kontakt 8.vst3')
for(const denied of [
 'C:\\random\\test.vst3','C:\\Program Files\\Common Files\\VST3\\evil.dll',
 'C:\\Program Files\\Common Files\\VST3\\Kontakt 8.vst3\nLIST',
 'C:\\Program Files\\Common Files\\VST3\\Kontakt 8.vst3\tQUIT',
])assert.equal(approvedPluginPath(denied,found),null)
assert.equal(typeof Vst3Session,'function')
assert.ok(browser.includes('async function bindToTrack()'))
assert.ok(browser.includes('async function removeBinding(id:number)'))
assert.ok(browser.includes('chưa đưa tiếng VST3 vào thanh phát'))
assert.ok(view.includes(':tracks="midiParts.map(part=>({id:part.id,label:part.name}))"'))
assert.ok(workflow.includes('Exercise real VST3 instances per track'))
assert.ok(workflow.includes('melorix-vst3-session'))
assert.ok(workflow.includes('real SDK plugin')||workflow.includes('real QA VST3'))
console.log('PASS: VST3 Stage 3A track instance lifecycle, scoped Electron IPC, allowlisted paths, truthful UI')
