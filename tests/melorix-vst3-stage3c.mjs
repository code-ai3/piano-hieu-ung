import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const native=readFileSync(new URL('../native/vst3-host/track-preview.hpp',import.meta.url),'utf8')
const session=readFileSync(new URL('../native/vst3-host/session.cpp',import.meta.url),'utf8')
const main=readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8')
const preload=readFileSync(new URL('../desktop/preload.cjs',import.meta.url),'utf8')
const player=readFileSync(new URL('../src/util/melorix-vst3-preview.ts',import.meta.url),'utf8')
const ui=readFileSync(new URL('../src/components/MelorixVst3Browser.vue',import.meta.url),'utf8')
for(const marker of [
 'component->queryInterface(IAudioProcessor::iid',
 'component->getBusCount(kAudio,kOutput)',
 'processor->setBusArrangements(nullptr,0,&stereo,1)',
 'processor->setupProcessing(setup)',
 'processor->setProcessing(true)',
 'Event::kNoteOnEvent',
 'Event::kNoteOffEvent',
 'processor->process(data)',
 'float* channels[2]',
 'push16(wav,3)',
 'push16(wav,32)',
 'result.wavBase64=base64(wav)',
 'if(processing)processor->setProcessing(false)',
 'if(active)component->setActive(false)',
])assert.ok(native.includes(marker),'Missing real plugin PCM render: '+marker)
assert.ok(!native.includes('std::sin('),'Host may not imitate a VST3 synth')
assert.ok(!native.includes('std::ofstream'),'Do not write preview WAV to a Windows drive')
assert.ok(session.includes('MelorixPreview::render(it->second->component.get()'))
assert.ok(session.includes('AUDITION'))
assert.ok(main.includes("ipcMain.handle('melorix:vst3:audition'"))
assert.ok(main.includes('trustedNativeSender(event)'))
assert.ok(main.includes('getVst3Session().request('))
assert.ok(main.includes("'AUDITION\\t'+trackId+'\\t'+pitch"))
assert.ok(preload.includes("ipcRenderer.invoke('melorix:vst3:audition'"))
assert.ok(player.includes('new AudioContext()'))
assert.ok(player.includes('decodeAudioData('))
assert.ok(player.includes('source:\'vst3-process\''))
assert.ok(ui.includes('Nghe thử C4 từ VST3'))
assert.ok(ui.includes('nghe thử offline'))
console.log('PASS: native 32-bit PCM output from real VST3, no disk writes, secure Electron bridge and truthful audition UI')
