import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const native=readFileSync(new URL('../native/vst3-host/track-preview.hpp',import.meta.url),'utf8')
const buses=readFileSync(new URL('../native/vst3-host/audio-bus-layout.hpp',import.meta.url),'utf8')
const session=readFileSync(new URL('../native/vst3-host/session.cpp',import.meta.url),'utf8')
const main=readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8')
const preload=readFileSync(new URL('../desktop/preload.cjs',import.meta.url),'utf8')
const player=readFileSync(new URL('../src/util/melorix-vst3-preview.ts',import.meta.url),'utf8')
const ui=readFileSync(new URL('../src/components/MelorixVst3Browser.vue',import.meta.url),'utf8')
const piano=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
const wasapi=readFileSync(new URL('../native/vst3-host/wasapi-live.hpp',import.meta.url),'utf8')
for(const marker of [
 'component->queryInterface(IAudioProcessor::iid',
 'component->getBusCount(kAudio,kOutput)',
 'audioBuses.initialize(component,result.message)',
 'processor->setupProcessing(setup)',
 'processor->setProcessing(true)',
 'Event::kNoteOnEvent',
 'Event::kNoteOffEvent',
 'processor->process(data)',
 'data.numOutputs=audioBuses.outputCount()',
 'push16(wav,3)',
 'push16(wav,32)',
 'result.wavBase64=base64(wav)',
 'if(processing)processor->setProcessing(false)',
 'if(active)component->setActive(false)',
])assert.ok(native.includes(marker),'Missing real plugin PCM render: '+marker)
assert.ok(!native.includes('setBusArrangements(nullptr,0,&stereo,1)'), 'Do not force only one output bus')
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
assert.ok(ui.includes("'bindings-change'"))
assert.ok(ui.includes("emit('bindings-change',loaded.value.map"))
assert.ok(piano.includes('vst3AssignedTrackIds.value.has(targetTrack)'))
assert.ok(piano.includes('vst3KeyPreview.play(vst3Api,targetTrack,midi,95,500,trackVolumePercent(targetTrack)/100)'))
assert.ok(piano.includes('@bindings-change="onVst3BindingsChanged"'))
assert.ok(piano.includes('void refreshVst3PianoBindings()'))
assert.ok(piano.includes('void vst3KeyPreview.dispose()'))

for(const marker of [
 'MMDeviceEnumerator','GetDefaultAudioEndpoint(eRender,eConsole',
 'IAudioClient','IAudioRenderClient','AUDCLNT_SHAREMODE_SHARED',
 'KSDATAFORMAT_SUBTYPE_IEEE_FLOAT','processor->setupProcessing(setup)',
 'setup.processMode=kRealtime','processor->setProcessing(true)',
 'processor->process(pd)','processor->setProcessing(false)',
 'Event::kNoteOnEvent','Event::kNoteOffEvent',
 'GetCurrentPadding','ReleaseBuffer(frames','CoInitializeEx(nullptr,COINIT_MULTITHREADED)',
])assert.ok(wasapi.includes(marker),'Missing actual WASAPI native VST3 audio output: '+marker)
assert.ok(wasapi.includes('pd.numOutputs=audioBuses.outputCount()'))
assert.ok(wasapi.includes('pd.outputs=audioBuses.outputBuses()'))
assert.ok(!wasapi.includes('setBusArrangements(nullptr,0,&stereo,1)'))
for(const marker of ['getBusCount(kAudio,direction)','getBusInfo(kAudio,direction,i,info)',
 'descriptors.resize(static_cast<size_t>(count))','bus.channelBuffers32=',
 'kMaxTotalChannels','int32 outputCount()const'])
 assert.ok(buses.includes(marker),'Missing declared audio bus buffers: '+marker)
assert.ok(!wasapi.includes('std::sin('),'WASAPI host must play plugin output rather than synthesized substitute')
assert.ok(session.includes('liveOutput.start(it->second->component.get(),why)'))
assert.ok(session.includes('liveOutput.send(velocity>0,pitch,velocity)'))
assert.ok(session.includes('Stop the WASAPI stream before rendering a separate offline VST3 preview'))
assert.ok(preload.includes("ipcRenderer.invoke('melorix:vst3:live-note'"))
assert.ok(main.includes("ipcMain.handle('melorix:vst3:live-start'"))
assert.ok(main.includes("ipcMain.handle('melorix:vst3:live-stop'"))
assert.ok(main.includes("ipcMain.handle('melorix:vst3:live-note'"))
assert.ok(ui.includes('Bật WASAPI (thử)'))
assert.ok(ui.includes("'live-change'"))
assert.ok(piano.includes('vst3LiveTrackId.value===targetTrack'))
assert.ok(piano.includes('sendLiveVst3Note(targetTrack,midi,95)'))
assert.ok(piano.includes('sendLiveVst3Note(vst3LiveTrackId.value,activeVst3KeyPitch,0)'))
assert.ok(piano.includes('@live-change="onVst3LiveChanged"'))
console.log('PASS: Stage3C plugin PCM offline + experimental WASAPI live note-on/off in Piano Roll, gated per track')
