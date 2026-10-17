import assert from 'node:assert/strict'
import { cloneNotes, sameNotes, copyMidiNotes, pasteMidiNotes, moveMidiNotes, selectMidiInBox } from '../src/util/piano-roll-selection.ts'
const notes=[
 { trackId:1,midi:60,name:'C4',time:5,duration:1,velocity:.8 },
 { trackId:1,midi:64,name:'E4',time:6,duration:.5,velocity:.6 },
 { trackId:2,midi:67,name:'G4',time:7,duration:1,velocity:.7 }
]
const originals=cloneNotes(notes)
const clip=copyMidiNotes(notes,[0,1])
assert.deepEqual(clip.map(n=>n.time),[0,1])
assert.deepEqual(clip.map(n=>n.velocity),[.8,.6])
const pasted=pasteMidiNotes(clip,3,20)
assert.deepEqual(pasted.map(n=>n.time),[20,21])
assert.ok(pasted.every(n=>n.trackId===3))
const moved=moveMidiNotes(notes,[0,1],2,1)
assert.deepEqual(moved.map(n=>n.time),[7,8,7])
assert.deepEqual(moved.slice(0,2).map(n=>n.name),['C#4','F4'])
assert.deepEqual(moved[2],notes[2])
assert.deepEqual(moveMidiNotes(notes,[0],-100,-100)[0].midi,21)
assert.equal(moveMidiNotes(notes,[0],-100,-100)[0].time,0)
const selected=selectMidiInBox(notes,{x1:50+5*40,x2:50+7*40,y1:(108-64)*19,y2:(108-60)*19+19},40,50,108,19)
assert.deepEqual(selected,[0,1])
assert.equal(sameNotes(notes,originals),true)
assert.equal(sameNotes(notes,moved),false)
console.log('PASS 3A: copy, paste, group move, marquee, isolation, undo snapshot equality')
