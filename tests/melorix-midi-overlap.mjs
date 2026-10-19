import assert from 'node:assert/strict'
import {mergeOverlappingMidiNotes as merge} from '../src/util/melorix-midi-overlap.ts'
const e=(note,channel,start,duration,velocity=80)=>({note,channel,start,duration,velocity})
assert.deepEqual(merge([e(60,0,0,2),e(60,0,1,2)]),[e(60,0,0,3)])
assert.deepEqual(merge([e(60,0,1,2),e(60,0,0,2),e(60,0,2.5,2)]),[e(60,0,0,4.5)])
assert.deepEqual(merge([e(60,0,0,1),e(60,0,1,1)]),[e(60,0,0,1),e(60,0,1,1)])
assert.deepEqual(merge([e(60,0,0,3),e(60,1,1,2),e(62,0,2,1)]),[e(60,0,0,3),e(60,1,1,2),e(62,0,2,1)])
assert.deepEqual(merge([e(36,9,0,2,95),e(36,9,1,2,120)]),[e(36,9,0,3,120)])
assert.equal(merge([e(60,0,0,-1),e(140,0,0,2),e(60,0,Infinity,1)]).length,0)
const original=[e(60,0,0,2),e(60,0,1,1)]
merge(original)
assert.deepEqual(original,[e(60,0,0,2),e(60,0,1,1)])
console.log('PASS stage5A MIDI note overlap: same pitch/channel merged; legato boundary, drums and channels retained')
