import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {midiControlChange,midiVolume,trackMidiChannel} from '../src/util/melorix-web-midi.ts'

assert.deepEqual(midiControlChange(7,127,0),[0xb0,7,127])
assert.deepEqual(midiControlChange(7,64,9),[0xb9,7,64])
assert.deepEqual(midiControlChange(7,0,15),[0xbf,7,0])
assert.equal(midiVolume(0),0)
assert.equal(midiVolume(100),127)
assert.equal(midiVolume(50),64)
assert.equal(midiVolume(NaN),127)
assert.equal(trackMidiChannel(1),0)
assert.equal(trackMidiChannel(10),9)
const bridge=readFileSync(new URL('../src/util/melorix-midi-bridge.ts',import.meta.url),'utf8')
const view=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
const connector=readFileSync(new URL('../src/components/MelorixMidiConnector.vue',import.meta.url),'utf8')
const desktop=readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8')
for(const marker of [
 'setChannelVolume(channel:number,percent:number)',
 'output.send(midiControlChange(7,midiVolume(percent),channel))',
 'output=access.outputs.get(selectedId)??null',
 "setExternalOnly(enabled:boolean)",
 "sendMidiNote(output,note,velocity,channel",
])assert.ok(bridge.includes(marker),'Missing MIDI Kontakt bridge: '+marker)
for(const marker of [
 'const kontaktMidiLive=ref(false)',
 'function activateKontaktOnly()',
 'if(useOriginalAudio.value)',
 'useOriginalAudio.value=false',
 '@kontakt-enabled="activateKontaktOnly"',
 'if(midiBridge.externalOnly)midiBridge.setChannelVolume(',
 'if(midiBridge.playbackEnabled)',
 'kontaktMidiLive ?',
 'mx-kontakt-live-action',
])assert.ok(view.includes(marker),'Missing Kontakt integration in piano: '+marker)
for(const marker of [
 "const preferredPort=computed(()",
 'async function quickKontakt()',
 "midiBridge.requestAccess()",
 "midiBridge.selectPort(port.id)",
 "midiBridge.setExternalOnly(true)",
 "emit('kontakt-enabled')",
 "if(props.playing||busy.value)return",
 "midiBridge.test(testNote.value,testChannel.value-1)",
 "loopMIDI",
 "Kontakt 8 (Standalone)",
 "quickMessage.value='Đã gửi MIDI",
])assert.ok(connector.includes(marker),'Missing Kontakt connection UI: '+marker)
assert.match(desktop,/setPermissionRequestHandler/)
assert.match(desktop,/setPermissionCheckHandler/)
assert.match(desktop,/permission !== 'midi'/)
assert.match(desktop,/callback\(permission === 'midi'/)
assert.ok(!view.includes('midiBridge.sendProgramChange'),'Do not replace Kontakt NKI with GM program change')
console.log('PASS Kontakt Desktop: virtual MIDI port, only-Kontakt, CC7 track volume, permission checks, status, non-claim of audio verification')
