import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'
import {makeExportNoteFrameIndex} from '../src/util/melorix-stage-h2-frame-index.ts'
const songSeconds=300,fps=30
const notes=Array.from({length:20000},(_,i)=>({
 midi:48+(i%48),trackId:i%5,name:'C4',
 time:(i*37%30000)/100,
 duration:.08+(i%21)/14,
 velocity:.3+(i%7)/10
}))
const index=makeExportNoteFrameIndex(notes)
assert.equal(index.noteCount,20000)
const begin=performance.now()
let visibleScans=0,maxVisible=0
for(let frame=0;frame<songSeconds*fps;frame++){
 const t=frame/fps,lookahead=4
 const value=index.at(t,lookahead)
 visibleScans+=value.visibleNotes.length
 maxVisible=Math.max(maxVisible,value.visibleNotes.length)
 if(frame%900===0||frame===8999){
  const expected=notes.filter(n=>n.time<=t+lookahead&&
   n.time+Math.max(.05,n.duration)+Math.max(.4,Math.max(.05,n.duration)*.85)>=t)
  assert.deepEqual(value.visibleNotes,expected,'Exact time window and original note order')
  const latest=new Map()
  for(const n of notes){if(n.time<=t){
   const old=latest.get(n.midi)
   if(!old||n.time>=old.time)latest.set(n.midi,n)
  }}
  for(const [midi,n] of latest)assert.deepEqual(value.latestPress.get(midi),n,
   'Latest velocity/press must match original all-notes scan')
 }
}
const elapsed=Math.round(performance.now()-begin)
assert.ok(maxVisible<notes.length/10,'Index must bound active notes by visible time window')
assert.ok(visibleScans<notes.length*fps*songSeconds*.1,'Index must reduce full-list per-frame work by >90%')
index.at(80,4)
index.at(12,4) // backwards seek must reset
assert.deepEqual(index.at(12,4).visibleNotes,notes.filter(n=>
 n.time<=16&&n.time+Math.max(.05,n.duration)+Math.max(.4,Math.max(.05,n.duration)*.85)>=12))
assert.throws(()=>index.at(NaN,4),/Invalid/)
console.log('PASS MELORIX H.2 frame index: 5min at 30fps, 20k notes, identical visible and latest press, scanned note reduction',JSON.stringify({
 frames:9000,notes:notes.length,naiveVisits:notes.length*9000,indexedVisits:visibleScans,
 visitReductionPercent:Math.round((1-visibleScans/(notes.length*9000))*10000)/100,
 maximumVisible:maxVisible,indexMilliseconds:elapsed
}))
