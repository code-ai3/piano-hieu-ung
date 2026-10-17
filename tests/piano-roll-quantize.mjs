import assert from 'node:assert/strict'
import { midiGridStep, nearestSwingGridTime, quantizeMidiNotes } from '../src/util/piano-roll-quantize.ts'

const notes = [
  { trackId: 4, midi: 60, name: 'C4', time: .13, duration: .45, velocity: .6 },
  { trackId: 4, midi: 64, name: 'E4', time: .37, duration: .25, velocity: .8 },
  { trackId: 7, midi: 67, name: 'G4', time: 1.01, duration: .75, velocity: .7 }
]
const original = structuredClone(notes)
assert.equal(midiGridStep(120, 16), .125)
assert.equal(midiGridStep(120, 0), 0)
assert.ok(Math.abs(midiGridStep(120, 12) - 1/6) < 1e-9)
assert.ok(Math.abs(midiGridStep(120, 24) - 1/12) < 1e-9)
assert.equal(nearestSwingGridTime(.13, .125), .125)
assert.equal(nearestSwingGridTime(.17, .125, 100), .1875)
assert.equal(nearestSwingGridTime(0, .125, 100), 0)
assert.equal(nearestSwingGridTime(-1, .125, 0), 0)
assert.equal(nearestSwingGridTime(.27, 0), .27)
const options = { bpm: 120, division: 16, strength: 100, swing: 0 }
const selected = quantizeMidiNotes(notes, [0, 2], options)
assert.deepEqual(selected.map(n => n.time), [.125, .37, 1])
assert.deepEqual(notes, original, 'No mutation of original notes')
assert.deepEqual(selected[1], notes[1], 'Unselected note unchanged')
assert.equal(selected[2].trackId, 7)
assert.equal(selected[0].duration, .45)
assert.equal(selected[0].velocity, .6)
assert.equal(selected[0].midi, 60)
const all = quantizeMidiNotes(notes, [0, 1, 2], options)
assert.deepEqual(all.map(n => n.time), [.125, .375, 1])
assert.deepEqual(quantizeMidiNotes(all,[0,1,2],options), all, '100% quantize is idempotent')
assert.equal(quantizeMidiNotes(notes, [0], { ...options, strength: 50 })[0].time, .1275)
assert.equal(quantizeMidiNotes(notes, [0], { ...options, strength: 25 })[0].time, .12875)
assert.deepEqual(quantizeMidiNotes(notes, [], options), notes, 'Empty selection is no-op')
assert.deepEqual(quantizeMidiNotes(notes, [0], { ...options, strength: 0 }), notes)
assert.equal(quantizeMidiNotes(notes, [0], { ...options, swing: 100 })[0].time, .1875)
assert.equal(quantizeMidiNotes([{...notes[0],time:.001}], [0], options)[0].time, 0)
assert.ok(Math.abs(quantizeMidiNotes([{...notes[0],time:.168}], [0], { ...options, division: 12 })[0].time - 1/6) < 1e-8)
console.log('PASS 3B: grid, triplets, swing, strength, selection isolation, no mutation, unchanged note properties')
