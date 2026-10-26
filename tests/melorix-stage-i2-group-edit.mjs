import assert from 'node:assert/strict'
import { cloneNotes, sameNotes } from '../src/util/piano-roll-selection.ts'
import { resizeSelectedMidiNotes, duplicateDraggedMidiNotes, nudgeSelectedMidiNotes } from '../src/util/melorix-stage-i2-group-edit.ts'

const notes=[
 {trackId:1,midi:60,name:'C4',time:1,duration:.5,velocity:.8},
 {trackId:1,midi:64,name:'E4',time:2,duration:.9,velocity:.7},
 {trackId:1,midi:67,name:'G4',time:3,duration:.1,velocity:.6},
 {trackId:2,midi:48,name:'C3',time:1,duration:2,velocity:.4}
]
const original=cloneNotes(notes)
const stretched=resizeSelectedMidiNotes(notes,[0,1],.5)
assert.deepEqual(stretched.map(n=>n.duration),[1,1.4,.1,2])
assert.deepEqual(stretched.map(n=>n.time),[1,2,3,1])
assert.deepEqual(stretched.map(n=>n.velocity),[.8,.7,.6,.4])
assert.deepEqual(notes,original,'original input must be immutable')
assert.deepEqual(resizeSelectedMidiNotes(notes,[0,2],-8).map(n=>n.duration),[.04,.9,.04,2])
assert.deepEqual(resizeSelectedMidiNotes(notes,[],1),notes)
assert.deepEqual(resizeSelectedMidiNotes(notes,[0],Infinity),notes)
assert.deepEqual(resizeSelectedMidiNotes(notes,[0,0,88],.3).map(n=>n.duration),[.8,.9,.1,2])

const copied=duplicateDraggedMidiNotes(notes,[1,0,1],2,2)
assert.equal(copied.length,2)
assert.deepEqual(copied.map(n=>n.time),[4,3])
assert.deepEqual(copied.map(n=>n.midi),[66,62])
assert.deepEqual(copied.map(n=>n.trackId),[1,1])
assert.deepEqual(copied.map(n=>n.velocity),[.7,.8])
assert.notEqual(copied[0],notes[1])
assert.deepEqual(notes,original)
assert.deepEqual(duplicateDraggedMidiNotes(notes,[],1,1),[])
assert.deepEqual(duplicateDraggedMidiNotes(notes,[0,1],-999,-999).map(n=>n.time),[0,1])
assert.deepEqual(duplicateDraggedMidiNotes(notes,[0,1],-999,-999).map(n=>n.midi),[21,25])

const nudged=nudgeSelectedMidiNotes(notes,[0,1],'right',.125)
assert.deepEqual(nudged.map(n=>n.time),[1.125,2.125,3,1])
assert.deepEqual(nudgeSelectedMidiNotes(notes,[0,1],'left',.125).map(n=>n.time),[.875,1.875,3,1])
assert.deepEqual(nudgeSelectedMidiNotes(notes,[0,1],'up',.125).map(n=>n.midi),[61,65,67,48])
assert.deepEqual(nudgeSelectedMidiNotes(notes,[0,1],'down',.125).map(n=>n.midi),[59,63,67,48])
assert.deepEqual(nudgeSelectedMidiNotes(notes,[0,1],'right',0).map(n=>n.time),[1.05,2.05,3,1])
assert.deepEqual(notes,original)
assert.ok(!sameNotes(nudged,notes))
console.log('PASS MELORIX I.2 group editing: resize, Alt-drag duplicate, nudge, immutability and track isolation')
