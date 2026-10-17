import assert from 'node:assert/strict'
import {midiNoteName,clampMidiVelocity} from '../src/util/midi-edit.ts'
assert.equal(midiNoteName(60),'C4')
assert.equal(clampMidiVelocity(140),127)
console.log('PASS MIDI note helpers')
