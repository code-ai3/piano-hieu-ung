import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {snapshotAudioTrack,restoreAudioTrack} from '../src/util/melorix-stage-b-track-state.ts'
import {audioInspectorPreview,DEFAULT_PERFORMANCE} from '../src/util/melorix-stage-b-performance.ts'

const notes=[
 {midi:60,time:0,duration:.2,velocity:.5,trackId:0},
 {midi:55,time:0,duration:.3,velocity:.4,trackId:1},
 {midi:62,time:.4,duration:.2,velocity:.5,trackId:0},
 {midi:57,time:.5,duration:.3,velocity:.4,trackId:1}
]
const original=structuredClone(notes)
const piano0={...DEFAULT_PERFORMANCE,velocity:160,pan:70}
const piano1={...DEFAULT_PERFORMANCE,velocity:55,pan:-80}
const after=audioInspectorPreview(notes,{0:piano0,1:piano1},{0:true,1:true})
assert.ok(after.find(n=>n.trackId===0).velocity>.5)
assert.ok(after.find(n=>n.trackId===1).velocity<.4)
const aOff=audioInspectorPreview(notes,{0:piano0,1:piano1},{0:false,1:true})
assert.equal(aOff.find(n=>n.trackId===0).velocity,.5,'A/B 0 original only')
assert.ok(aOff.find(n=>n.trackId===1).velocity<.4,'A/B 0 must not disable track 1')
const bOff=audioInspectorPreview(notes,{0:piano0,1:piano1},{0:true,1:false})
assert.ok(bOff.find(n=>n.trackId===0).velocity>.5,'A/B 1 must not disable track 0')
assert.equal(bOff.find(n=>n.trackId===1).velocity,.4)
assert.deepEqual(notes,original,'Preview never mutates MIDI')

const pedal0=[{time:0,value:127},{time:1,value:0}]
const pedal1=[{time:0,value:127},{time:2,value:0}]
const snap0=snapshotAudioTrack(notes,0,pedal0,65)
assert.equal(snap0.notes.length,2)
const changed=audioInspectorPreview(notes,{0:piano0,1:piano1},{0:true,1:true})
const track1Before=structuredClone(changed.filter(n=>n.trackId===1))
const restored=restoreAudioTrack(changed,0,snap0)
assert.deepEqual(restored.filter(n=>n.trackId===0),snap0.notes)
assert.deepEqual(restored.filter(n=>n.trackId===1),track1Before,'Undo of RH cannot overwrite LH')
assert.deepEqual(pedal0,[{time:0,value:127},{time:1,value:0}])
assert.deepEqual(pedal1,[{time:0,value:127},{time:2,value:0}])
snap0.notes[0].velocity=.01
assert.equal(notes[0].velocity,.5,'Undo snapshot must be deep-cloned notes')

const vue=readFileSync('src/views/PianoView.vue','utf8')
const inspector=readFileSync('src/components/MelorixAudioInspector.vue','utf8')
for(const token of [
 'performancePreviewByTrack.value','inspectorUndoByTrack.value','inspectorRedoByTrack.value',
 'inspectorStatusByTrack.value','pedalModeByTrack.value','snapshotAudioTrack(','restoreAudioTrack(',
 'setInspectorStatus(id,','@track="openAudioInspector"','selectedUndoCount','selectedRedoCount',
 'performancePreviewByTrack.value={...performancePreviewByTrack.value,[id]:next}',
 'pedalByTrack.value={...pedalByTrack.value,[id]:snapshot.pedal',
 'committedPanByTrack.value={...committedPanByTrack.value,[id]:snapshot.pan'
])assert.ok(vue.includes(token),'track isolation integration missing: '+token)
for(const token of ['Chọn track cần chỉnh riêng','v-for="track in tracks"','emit(\'track\',id)','pedalMode','Mỗi track có Velocity']){
 assert.ok(inspector.includes(token),'track picker missing: '+token)
}
console.log('PASS MELORIX Stage B.2: independent RH/LH preview, A/B, snapshot, undo/redo and track picker')
