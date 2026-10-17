import assert from 'node:assert/strict'
import { portraitKeyboardRange, videoDimensions } from '../src/util/video-format.ts'
assert.deepEqual(videoDimensions('portrait'), { width: 1080, height: 1920, fps: 30 })
assert.deepEqual(videoDimensions('landscape'), { width: 1920, height: 1080, fps: 30 })
const wide = { min: 21, max: 108 }
assert.deepEqual(portraitKeyboardRange([], 'auto', wide), { min: 48, max: 95 })
assert.deepEqual(portraitKeyboardRange([{midi:36},{midi:40},{midi:48},{midi:52}], 'auto', wide), { min: 36, max: 83 })
assert.deepEqual(portraitKeyboardRange([{midi:72},{midi:74},{midi:76},{midi:84}], 'auto', wide), { min: 48, max: 95 })
assert.deepEqual(portraitKeyboardRange([{midi:70}], '36', wide), { min: 36, max: 83 })
assert.deepEqual(portraitKeyboardRange([{midi:72}], 'all', wide), wide)
console.log('PASS: 9:16 1080x1920, 16:9 1920x1080, auto/manual/all keyboard range')
