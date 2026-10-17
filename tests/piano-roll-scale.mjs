import assert from 'node:assert/strict'
import {SCALE_TYPES,scalePitchClass,isPitchInScale,isScaleRoot,snapPitchToScale,correctMidiNotesToScale} from '../src/util/piano-roll-scale.ts'
for(const p of [60,62,64,65,67,69,71,72])assert.equal(isPitchInScale(p,0,'major'),true)
assert.equal(isPitchInScale(61,0,'major'),false)
assert.equal(isPitchInScale(63,0,'naturalMinor'),true)
assert.equal(isPitchInScale(68,0,'harmonicMinor'),true)
assert.equal(isPitchInScale(71,0,'harmonicMinor'),true)
assert.equal(isPitchInScale(71,0,'naturalMinor'),false)
assert.equal(isPitchInScale(66,2,'major'),true)
assert.equal(isPitchInScale(65,2,'major'),false)
assert.equal(isPitchInScale(62,0,'majorPentatonic'),true)
assert.equal(isPitchInScale(65,0,'majorPentatonic'),false)
assert.equal(isPitchInScale(63,0,'minorPentatonic'),true)
assert.equal(isPitchInScale(65,0,'mixolydian'),true)
assert.equal(isPitchInScale(70,0,'mixolydian'),true)
assert.equal(isPitchInScale(70,0,'dorian'),true)
assert.equal(scalePitchClass(-1),11)
assert.equal(isScaleRoot(72,0),true)
assert.equal(isScaleRoot(73,0),false)
assert.equal(snapPitchToScale(61,0,'major'),60)
assert.equal(snapPitchToScale(63,0,'major'),62)
assert.equal(snapPitchToScale(66,0,'major'),65)
assert.equal(snapPitchToScale(66,2,'major'),66)
assert.equal(snapPitchToScale(65,2,'major'),64)
assert.equal(snapPitchToScale(21,0,'major'),21)
assert.equal(snapPitchToScale(108,0,'major'),108)
assert.equal(snapPitchToScale(108,2,'major'),107)
for(const root of Array.from({length:12},(_,i)=>i)){
 for(const mode of Object.keys(SCALE_TYPES)){
  for(let pitch=21;pitch<=108;pitch++){
   const result=snapPitchToScale(pitch,root,mode)
   assert.ok(result>=21&&result<=108)
   assert.equal(isPitchInScale(result,root,mode),true)
   assert.equal(snapPitchToScale(result,root,mode),result)
  }
 }
}
const notes=[
 {trackId:1,midi:61,name:'C#4',time:.33,duration:.42,velocity:.7},
 {trackId:1,midi:63,name:'D#4',time:1.22,duration:.35,velocity:.8},
 {trackId:2,midi:66,name:'F#4',time:1.75,duration:.3,velocity:.65}
]
const orig=structuredClone(notes)
const updated=correctMidiNotesToScale(notes,[0,2],0,'major')
assert.deepEqual(updated.map(n=>n.midi),[60,63,65])
assert.deepEqual(updated.map(n=>n.name),['C4','D#4','F4'])
assert.deepEqual(updated[1],notes[1])
for(let i=0;i<notes.length;i++)for(const f of ['time','duration','velocity','trackId'])assert.equal(updated[i][f],notes[i][f])
assert.deepEqual(notes,orig)
assert.deepEqual(correctMidiNotesToScale(notes,[],0,'major'),notes)
assert.deepEqual(correctMidiNotesToScale(updated,[0,2],0,'major'),updated)
console.log('PASS 3D scale: seven modes / twelve roots / eighty-eight keys; snap, correction, isolation, identity')
