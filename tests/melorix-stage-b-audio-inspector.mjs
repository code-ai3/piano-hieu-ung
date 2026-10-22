import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {DEFAULT_PERFORMANCE,normalizedPerformance,hasNoteExpression,shapeTrackNotes,audioInspectorPreview,sustainEnd} from '../src/util/melorix-stage-b-performance.ts'
const notes=[
 {trackId:1,midi:60,time:0,duration:.2,velocity:.4},
 {trackId:1,midi:62,time:.3,duration:.1,velocity:.6},
 {trackId:2,midi:70,time:.33,duration:.2,velocity:.5}
]
const expressive=normalizedPerformance({velocity:140,humanizeMs:10,lengthPercent:130,legato:50,pan:-40})
assert.deepEqual(normalizedPerformance({velocity:999,humanizeMs:-500,pan:300}),{velocity:180,humanizeMs:0,lengthPercent:100,legato:0,pan:100})
assert.equal(hasNoteExpression({...DEFAULT_PERFORMANCE,pan:60}),false,'pan should not write MIDI notes')
assert.equal(hasNoteExpression(expressive),true)
const once=shapeTrackNotes(notes,1,expressive)
const twice=shapeTrackNotes(notes,1,expressive)
assert.deepEqual(once,twice,'humanize must not vary between replays')
assert.deepEqual(once[2],notes[2],'must never alter the other track')
assert.ok(once[0].velocity>.4,'velocity really changes')
assert.ok(once[0].duration>.2,'note length and legato really change')
assert.ok(Math.abs(once[0].time-notes[0].time)<=.011)
assert.equal(sustainEnd(.4,[{time:.1,value:127},{time:.8,value:0}]),.8)
assert.equal(sustainEnd(.4,[{time:.1,value:127},{time:12,value:0}]),2.9,'pedal bounded')
assert.equal(sustainEnd(.4,[{time:.1,value:127},{time:.3,value:0}]),.4,'released pedal leaves note unchanged')
const pedal={1:[{time:0,value:127},{time:.8,value:0}]}
const original=audioInspectorPreview(notes,{1:expressive},false,pedal)
assert.equal(original.find(n=>n.trackId===1&&n.midi===60).velocity,.4,'A/B bypasses expression')
assert.ok(original.find(n=>n.trackId===1&&n.midi===60).duration>.2,'saved CC64 remains audible with A/B off')
const preview=audioInspectorPreview(notes,{1:expressive},true,pedal)
assert.ok(preview.find(n=>n.trackId===1&&n.midi===60).velocity>.4)
assert.deepEqual(notes[0],{trackId:1,midi:60,time:0,duration:.2,velocity:.4},'preview cannot mutate original')
const vue=readFileSync('src/views/PianoView.vue','utf8')
const inspector=readFileSync('src/components/MelorixAudioInspector.vue','utf8')
assert.ok(vue.includes('pan:committedPanByTrack.value[id]??0'), 'Reset must preserve committed MIDI CC10 pan')
for(const t of ['audibleNotes.value','const panner=ctx.createStereoPanner()','panner.connect(getAudioMaster(ctx))','shapeTrackNotes(allNotes.value,id,setting)','suggestAutoPedal(','track.addCC({number:10','inspectorUndo.value','inspectorRedo.value','<MelorixAudioInspector','openAudioInspector(part.id)'])assert.ok(vue.includes(t),'missing integration: '+t)
for(const t of ['Velocity','Humanize Timing','Legato','Pan (web)','A/B','Undo','Redo','Áp dụng pedal CC64'])assert.ok(inspector.includes(t),'missing inspector control: '+t)
console.log('PASS Stage B: per-track dynamics/timing/legato/CC64, reversible A/B, real stereo pan and MIDI export wiring')
