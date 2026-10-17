import assert from 'node:assert/strict'
import {playheadLeft,rulerSeekTime,activeAtTime} from '../src/util/piano-roll-playhead.ts'
assert.equal(playheadLeft(0,40,54),54)
assert.equal(playheadLeft(2,40,54),134)
assert.equal(playheadLeft(5,80,54),454)
assert.equal(rulerSeekTime(234,100,80,40,54,200),4)
assert.equal(rulerSeekTime(100,100,0,40,54,200),null)
assert.equal(rulerSeekTime(9000,100,0,40,54,10),10)
assert.equal(activeAtTime(5.2,5,0.5),true)
assert.equal(activeAtTime(5.5,5,0.5),false)
assert.equal(activeAtTime(4.9,5,0.5),false)
console.log('PASS: Piano Roll playhead positioning, ruler seeking, active notes')
