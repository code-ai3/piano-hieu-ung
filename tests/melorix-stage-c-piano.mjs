import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {DEFAULT_PIANO_FEEL,pianoFeelPreset,normalizedPianoFeel,shapePianoTrackNotes,pianoFeelPreview} from '../src/util/melorix-stage-c-piano.ts'
import {snapshotAudioTrack,restoreAudioTrack} from '../src/util/melorix-stage-b-track-state.ts'
const notes=[
 {midi:48,name:'C3',time:0,duration:.35,velocity:.51,trackId:0},
 {midi:60,name:'C4',time:0,duration:.3,velocity:.62,trackId:0},
 {midi:64,name:'E4',time:0,duration:.3,velocity:.50,trackId:0},
 {midi:52,name:'E3',time:.32,duration:.2,velocity:.53,trackId:0},
 {midi:55,name:'G3',time:.61,duration:.2,velocity:.49,trackId:0},
 {midi:57,name:'A3',time:1.6,duration:.2,velocity:.56,trackId:0},
 {midi:72,name:'C5',time:0,duration:.6,velocity:.81,trackId:1},
 {midi:74,name:'D5',time:.5,duration:.4,velocity:.73,trackId:1}]
const original=structuredClone(notes)
assert.deepEqual(shapePianoTrackNotes(notes,0,DEFAULT_PIANO_FEEL),notes)
assert.deepEqual(normalizedPianoFeel({preset:'expressive',dynamics:999,chordRollMs:-20}),{preset:'expressive',dynamics:100,chordRollMs:0})
const natural=pianoFeelPreset('natural'),expressive=pianoFeelPreset('expressive')
const shaped=shapePianoTrackNotes(notes,0,natural,120)
assert.deepEqual(shaped,shapePianoTrackNotes(notes,0,natural,120),'Deterministic')
assert.deepEqual(shaped.filter(n=>n.trackId===1),notes.filter(n=>n.trackId===1),'Other tracks unchanged')
assert.ok(shaped.filter(n=>n.trackId===0).some(n=>n.velocity!==notes.find(x=>x.trackId===0&&x.midi===n.midi).velocity),'Dynamic curve alters velocity')
const chord=shaped.filter(n=>n.trackId===0&&[48,60,64].includes(n.midi))
assert.ok(chord[0].time<=chord[1].time&&chord[1].time<chord[2].time,'Upward piano roll')
assert.ok(chord[2].time-chord[0].time<=.02401,'Bounded roll')
const inputChord=notes.filter(n=>n.trackId===0&&[48,60,64].includes(n.midi))
assert.ok(Math.abs(chord[0].velocity/inputChord[0].velocity-chord[2].velocity/inputChord[2].velocity)<1e-8,'Chord retains velocity balance')
assert.deepEqual(notes,original,'Input unchanged')
const bypass=pianoFeelPreview(notes,{0:expressive,1:natural},{0:false,1:true},120)
assert.deepEqual(bypass.filter(n=>n.trackId===0),notes.filter(n=>n.trackId===0),'A/B track 0 bypass')
assert.notDeepEqual(bypass.filter(n=>n.trackId===1),notes.filter(n=>n.trackId===1),'Track 1 independent')
const snap=snapshotAudioTrack(notes,0,[{time:0,value:127},{time:1,value:0}],15)
const undone=restoreAudioTrack(shaped,0,snap)
assert.deepEqual(undone.filter(n=>n.trackId===1),notes.filter(n=>n.trackId===1))
assert.deepEqual(undone.filter(n=>n.trackId===0),snap.notes)
const view=readFileSync('src/views/PianoView.vue','utf8')
const inspector=readFileSync('src/components/MelorixAudioInspector.vue','utf8')
for(const token of ['pianoFeelByTrack.value','pianoFeelPreview(','shapePianoTrackNotes(','pianoFeelByTrack.value=omitTrackSetting(','pianoFeelByTrack.value={}','@piano-feel="updatePianoFeel"','hasPianoFeel(feel)'])
 assert.ok(view.includes(token),'Missing Stage C integration: '+token)
for(const token of ['Phong cách diễn tấu piano','Độ nhấn câu nhạc','Độ rải hợp âm',"emit('piano-feel'"])
 assert.ok(inspector.includes(token),'Missing Stage C control: '+token)
console.log('PASS MELORIX Stage C: dynamics, chord roll, A/B, undo and UI integration')
