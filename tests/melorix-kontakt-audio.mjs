import assert from 'node:assert/strict'
import {planKontaktAudioAlignment as plan} from '../src/util/melorix-kontakt-audio.ts'
assert.deepEqual(plan(48000*10,48000,5,0),{outputFrames:240000,sourceStartFrame:0,outputStartFrame:0,copyFrames:240000})
assert.deepEqual(plan(48000*5,48000,5,1),{outputFrames:240000,sourceStartFrame:0,outputStartFrame:48000,copyFrames:192000})
assert.deepEqual(plan(48000*5,48000,5,-2),{outputFrames:240000,sourceStartFrame:96000,outputStartFrame:0,copyFrames:144000})
assert.equal(plan(48000,48000,5,-30).copyFrames,0)
assert.equal(plan(48000,48000,5,30).copyFrames,0)
assert.throws(()=>plan(100,0,10,0))
assert.throws(()=>plan(100,48000,0,0))
console.log('PASS Kontakt audio alignment (trim, delay, exact video duration and invalid timing)')
