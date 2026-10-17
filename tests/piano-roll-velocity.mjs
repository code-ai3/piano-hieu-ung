import assert from 'node:assert/strict'
import { velocityNumber, setMidiVelocities, shiftMidiVelocities, rampMidiVelocities, humanizeMidiVelocities, drawMidiVelocityLine } from '../src/util/piano-roll-velocity.ts'
const notes=[
 { trackId:1,midi:60,name:'C4',time:0,duration:.2,velocity:60/127 },
 { trackId:1,midi:64,name:'E4',time:1,duration:.3,velocity:80/127 },
 { trackId:2,midi:67,name:'G4',time:2,duration:.4,velocity:100/127 },
 { trackId:2,midi:69,name:'A4',time:3,duration:.6,velocity:100/127 }
]
const orig=structuredClone(notes)
const vals=arr=>arr.map(n=>Math.round(n.velocity*127))
assert.equal(velocityNumber(0),1)
assert.equal(velocityNumber(200),127)
assert.equal(velocityNumber(NaN),80)
assert.deepEqual(vals(setMidiVelocities(notes,[0,2],110)),[110,80,110,100])
assert.deepEqual(vals(shiftMidiVelocities(notes,[0,2],-20)),[40,80,80,100])
assert.deepEqual(vals(shiftMidiVelocities(notes,[0,2],200)),[127,80,127,100])
assert.deepEqual(vals(rampMidiVelocities(notes,[0,1,2],20,120)),[20,70,120,100])
assert.deepEqual(vals(rampMidiVelocities(notes,[0,1,2],120,20)),[120,70,20,100])
assert.deepEqual(vals(rampMidiVelocities(notes,[1],22,90)),[60,22,100,100])
assert.deepEqual(vals(drawMidiVelocityLine(notes,[0,1,2,3],.4,2.6,10,110)),[60,37,83,100])
assert.deepEqual(vals(drawMidiVelocityLine(notes,[0,1,2],2,0,10,110)),[110,60,10,100])
assert.deepEqual(vals(drawMidiVelocityLine(notes,[0,2],0,2,30,90)),[30,80,90,100])
const human=humanizeMidiVelocities(notes,[0,1,2],12,2)
assert.ok(vals(human).slice(0,3).every((v,i)=>Math.abs(v-vals(notes)[i])<=12))
assert.equal(vals(human)[3],100)
assert.deepEqual(humanizeMidiVelocities(notes,[0,1,2],12,2),human,'deterministic seed')
assert.deepEqual(humanizeMidiVelocities(notes,[0,1,2],0,2),notes)
assert.deepEqual(notes,orig,'original must not mutate')
for(const result of [human,rampMidiVelocities(notes,[0,1],10,80),setMidiVelocities(notes,[0,1],20)]) {
  result.forEach((n,i)=>{ assert.equal(n.time,notes[i].time);assert.equal(n.duration,notes[i].duration);assert.equal(n.midi,notes[i].midi);assert.equal(n.trackId,notes[i].trackId) })
}
console.log('PASS 3C velocity: set, delta, ramps, line paint, humanize, clamping, selection & immutability')
