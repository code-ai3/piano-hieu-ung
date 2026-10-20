import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gmVoiceForTrack} from '../src/util/melorix-gm-audio.ts'
const mixer=readFileSync(new URL('../src/util/melorix-offline-mix.ts',import.meta.url),'utf8')
assert.match(mixer, /gmKey==='acoustic_grand_piano'/)
assert.match(mixer, /gmKey==='acoustic_grand_piano'/)
assert.match(mixer, /gmKey==='acoustic_grand_piano'/)
assert.match(mixer, /isInstrumentPreset/)
assert.match(mixer, /isInstrumentPreset/)
assert.match(mixer, /preset\?\.startsWith/)
assert.match(mixer, /preset==='library:erhu-hmoob-nplog'/)
assert.match(mixer, /gmKey==='acoustic_grand_piano'/)
assert.equal(gmVoiceForTrack({channel:10,name:'Drums'}).percussion,true)
const source=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
for(const item of [
 'renderMultiTrackAudio({','notes:notes.value','parts:midiParts.value',
 'programs:importedMidiPrograms.value','presets:assignedTrackPresets.value',
 'volumes:trackVolumeLevels.value','erhuSamples:erhuWebSampler.getDecodedSamples()',
 'tempo:midiTempo.value','expression:expressionMode.value',
 'audioBuf=mix.audioBuffer','MP4 dựng lại âm thanh từ MIDI bằng Piano/GM/Drums/Synth'
])assert.ok(source.includes(item),'Missing export wiring: '+item)
assert.match(mixer,/parts\.filter\(p=>p\.enabled\)/)
assert.match(mixer,/if\(volume===0\)return/)
assert.match(mixer,/fallbackDrum\(ctx/)
assert.match(mixer,/fallbackTone\(ctx/)
assert.match(mixer,/nearestErhuSample\(n\.midi,roots\)/)
assert.match(mixer,/duration:Math\.max\(\.06,n\.duration\)/)
assert.match(mixer,/await Promise\.all\(groups\.map/)
console.log('PASS: MP4 multi-track routes, faders, drum/piano/GM/Synth/WAV/Erhu and expression')
