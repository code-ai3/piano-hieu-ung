import assert from 'node:assert/strict'
import {CHORD_INTERVALS,CHORD_LABELS,chordName,chordNoteName,chordPitches,createChordNotes} from '../src/util/piano-roll-chords.ts'
const notes=(root,q,oct=4,inv=0)=>chordPitches(root,q,oct,inv)
const shift=(xs)=>xs.map(x=>x-xs[0])
assert.deepEqual(notes(0,'major'),[60,64,67])
assert.deepEqual(notes(0,'minor'),[60,63,67])
assert.deepEqual(notes(0,'dim'),[60,63,66])
assert.deepEqual(notes(0,'aug'),[60,64,68])
assert.deepEqual(notes(0,'sus2'),[60,62,67])
assert.deepEqual(notes(0,'sus4'),[60,65,67])
assert.deepEqual(notes(0,'7'),[60,64,67,70])
assert.deepEqual(notes(0,'maj7'),[60,64,67,71])
assert.deepEqual(notes(0,'m7'),[60,63,67,70])
assert.deepEqual(notes(0,'m7b5'),[60,63,66,70])
assert.deepEqual(notes(0,'dim7'),[60,63,66,69])
assert.deepEqual(notes(0,'major',4,1),[64,67,72])
assert.deepEqual(notes(0,'major',4,2),[67,72,76])
assert.deepEqual(notes(0,'maj7',4,3),[71,72,76,79])
assert.deepEqual(notes(0,'major',4,3),[])
assert.deepEqual(notes(2,'minor',4,0),[62,65,69])
assert.equal(chordName(0,'major'),'C')
assert.equal(chordName(9,'minor'),'Am')
assert.equal(chordName(2,'7'),'D7')
assert.equal(chordNoteName(60),'C4')
assert.equal(chordNoteName(71),'B4')
assert.equal(chordNoteName(21),'A0')
for(const [quality,intervals] of Object.entries(CHORD_INTERVALS)){
 assert.ok(CHORD_LABELS[quality])
 for(let root=0;root<12;root++){
  for(let inv=0;inv<intervals.length;inv++){
   for(let oct=1;oct<=7;oct++){
    const pitches=notes(root,quality,oct,inv)
    assert.equal(pitches.length,intervals.length)
    assert.ok(pitches.every(n=>n>=21&&n<=108))
    assert.ok(pitches.every((n,i)=>i===0||n>pitches[i-1]))
    const expected=intervals.map((n,i)=>root+n+(i<inv?12:0)).sort((a,b)=>a-b)
    assert.deepEqual(shift(pitches),shift(expected),'preserve voicing under range shift')
   }
  }
 }
}
const pitches=notes(7,'7',4,2)
const built=createChordNotes(pitches,2.5,.75,9,83)
assert.equal(built.length,4)
assert.deepEqual(built.map(n=>n.time),[2.5,2.5,2.5,2.5])
assert.ok(built.every(n=>n.duration===.75&&n.trackId===9&&Math.round(n.velocity*127)===83))
assert.deepEqual(built.map(n=>n.name),pitches.map(chordNoteName))
assert.deepEqual(createChordNotes(notes(0,'major'),-1,0.01,1).map(n=>n.time),[0,0,0])
assert.deepEqual(createChordNotes([],0,1,1),[])
assert.deepEqual(createChordNotes([20,21,109],0,1,1).map(n=>n.midi),[21])
assert.deepEqual(createChordNotes([60],0,0,1),[])
assert.deepEqual(chordPitches(0,'major',4,-1),[])
console.log('PASS 3E: 11 chord qualities x 12 roots x valid inversions x 7 octaves; MIDI metadata and bounds')
