import assert from 'node:assert/strict'
import { extractMidiParts, filterMidiParts, trackColor } from '../src/util/midi-tracks.ts'
const mock = { duration: 12, tracks: [
  { name: 'Piano', channel: 0, instrument: { name: 'piano' }, notes: [
    { midi: 60, name: 'C4', time: 0, duration: 1, velocity: 0.65 },
    { midi: 62, name: 'D4', time: 2, duration: 1, velocity: 0.8 },
  ] },
  { name: 'Bass', channel: 1, instrument: { name: 'bass' }, notes: [
    { midi: 36, name: 'C2', time: 1, duration: 2, velocity: 0.5 },
  ] },
  { name: '', channel: 9, instrument: { name: 'drums' }, notes: [] },
] }
const { parts, events } = extractMidiParts(mock)
assert.equal(parts.length, 2)
assert.deepEqual(events.map(n => n.trackId), [0, 1, 0])
assert.equal(parts[1].name, 'Bass')
assert.equal(parts[0].channel, 1)
assert.notEqual(parts[0].color, parts[1].color)
parts[0].enabled = false
assert.deepEqual(filterMidiParts(events, parts).map(n => n.midi), [36])
assert.equal(trackColor(1, parts), parts[1].color)
parts[1].enabled = false
assert.equal(filterMidiParts(events, parts).length, 0)
assert.deepEqual(extractMidiParts({ tracks: [], duration: 0 }), { parts: [], events: [] })
console.log('PASS: multi-track parsing, note ordering, mute, colors, and empty MIDI')
