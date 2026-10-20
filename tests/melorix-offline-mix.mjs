import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {mixVoiceType,renderMultiTrackAudio} from '../src/util/melorix-offline-mix.ts'
import {gmVoiceForTrack} from '../src/util/melorix-gm-audio.ts'
assert.equal(mixVoiceType(undefined,'acoustic_grand_piano'),'piano')
assert.equal(mixVoiceType('piano','acoustic_grand_piano'),'piano')
assert.equal(mixVoiceType(undefined,'electric_bass_finger'),'gm')
assert.equal(mixVoiceType('organ','acoustic_grand_piano'),'synth')
assert.equal(mixVoiceType('synth-bass','electric_bass_finger'),'synth')
assert.equal(mixVoiceType('user:1','acoustic_grand_piano'),'wav')
assert.equal(mixVoiceType('library:erhu-hmoob-nplog','fiddle'),'erhu')
assert.equal(mixVoiceType('library:snare-kit','percussion'),'gm')
assert.equal(gmVoiceForTrack({channel:10,name:'Drums'}).percussion,true)
const source=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
for(const item of [
 'renderMultiTrackAudio({','notes:notes.value','parts:midiParts.value',
 'programs:importedMidiPrograms.value','presets:assignedTrackPresets.value',
 'volumes:trackVolumeLevels.value','erhuSamples:erhuWebSampler.getDecodedSamples()',
 'tempo:midiTempo.value','expression:expressionMode.value',
 'audioBuf=mix.audioBuffer','MP4 dùng bản phối đa nhạc cụ'
])assert.ok(source.includes(item),'Missing export wiring: '+item)
const mixer=readFileSync(new URL('../src/util/melorix-offline-mix.ts',import.meta.url),'utf8')
assert.match(mixer,/parts\.filter\(p=>p\.enabled\)/)
assert.match(mixer,/if\(volume===0\)return/)
assert.match(mixer,/fallbackDrum\(ctx/)
assert.match(mixer,/fallbackTone\(ctx/)
assert.match(mixer,/nearestErhuSample\(n\.midi,roots\)/)
assert.match(mixer,/duration:Math\.max\(\.06,n\.duration\)/)
assert.match(mixer,/await Promise\.all\(groups\.map/)
const blank={notes:[],parts:[],programs:{},presets:{},volumes:{},
 wavSamples:new Map(),erhuSamples:new Map(),seconds:0,tempo:120,expression:'natural'}
await assert.rejects(renderMultiTrackAudio(blank),/Invalid export duration/)
console.log('PASS: MP4 multi-track routes, faders, drum/piano/GM/Synth/WAV/Erhu and expression')
