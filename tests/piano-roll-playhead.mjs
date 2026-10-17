import assert from 'node:assert/strict'
import { playheadLeft } from '../src/util/piano-roll-playhead.ts'
assert.equal(playheadLeft(2,40,54),134)
console.log('playhead math passed')
