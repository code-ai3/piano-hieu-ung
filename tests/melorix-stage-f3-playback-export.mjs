import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {audioInspectorPreview,DEFAULT_PERFORMANCE} from '../src/util/melorix-stage-b-performance.ts'
import {pianoFeelPreview,pianoFeelPreset} from '../src/util/melorix-stage-c-piano.ts'
import {synthVoicePlan} from '../src/util/melorix-instruments.ts'
const soft=synthVoicePlan('music-box',60,35,.5).strength
const medium=synthVoicePlan('music-box',60,80,.5).strength
const loud=synthVoicePlan('music-box',60,127,.5).strength
assert.ok(soft<medium&&medium<loud,
 'Web Synth must respect real MIDI velocities: soft < medium < loud')
assert.ok(soft<.3&&loud===1,'MIDI 35/127 normalized, MIDI 127 at unity')
const notes=[
 {midi:48,name:'C3',time:0,duration:.28,velocity:.52,trackId:0},
 {midi:60,name:'C4',time:0,duration:.22,velocity:.55,trackId:0},
 {midi:64,name:'E4',time:0,duration:.22,velocity:.60,trackId:0},
 {midi:68,name:'G#4',time:.46,duration:.35,velocity:.71,trackId:0},
 {midi:72,name:'C5',time:.12,duration:.44,velocity:.8,trackId:1}
]
const playback=pianoFeelPreview(audioInspectorPreview(notes,
 {0:{...DEFAULT_PERFORMANCE,velocity:160,humanizeMs:17,legato:28}},
 {0:true,1:true},{0:[{time:0,value:127},{time:.9,value:0}]}),
 {0:pianoFeelPreset('expressive')},{0:true,1:true},120)
assert.notDeepEqual(playback.filter(n=>n.trackId===0),notes.filter(n=>n.trackId===0),
 'B/C preview should affect audio without first committing to MIDI')
assert.deepEqual(notes,structuredClone(notes),'Preview must not change MIDI source')
assert.deepEqual(playback.filter(n=>n.trackId===1),notes.filter(n=>n.trackId===1),
 'Preview on track 0 must not alter other tracks')
const bypass=pianoFeelPreview(audioInspectorPreview(notes,
 {0:{...DEFAULT_PERFORMANCE,velocity:160}}, {0:false,1:true}),
 {0:pianoFeelPreset('expressive')},{0:false,1:true},120)
for(const n of bypass.filter(n=>n.trackId===0)){
 const original=notes.find(x=>x.trackId===0&&x.midi===n.midi)
 assert.ok(original,'Original note exists')
 assert.ok(Math.abs(n.time-original.time)<1e-7&&
  Math.abs(n.duration-original.duration)<1e-7&&
  Math.abs(n.velocity-original.velocity)<1e-7,
  'A/B off restores musical time/duration/velocity without float noise')
}
const view=readFileSync('src/views/PianoView.vue','utf8')
const mixer=readFileSync('src/util/melorix-offline-mix.ts','utf8')
assert.ok(view.includes('notes:audibleNotes.value,parts:midiParts.value'),
 'Offline mix must use WebAudio audition notes rather than raw notes')
assert.ok(view.includes('requireBundledPiano:true'),'Do not silently downgrade grand piano')
assert.ok(view.includes('midiBridge.externalOnly||missingNative.length'),
 'Native Kontakt/VST3 mix cannot be silently substituted with GM')
assert.ok(mixer.includes('volume:100,decayTime:.65'),'Sample piano configuration must match live playback')
assert.ok(mixer.includes('if(opts.requireBundledPiano)'),'Piano fallback must be explicit and guarded')
console.log('PASS MELORIX F.3: realtime B/C expression -> offline export note parity, sampled piano config, native guard')
