import assert from 'node:assert/strict'
import { exportDurationSeconds as length, exportFrameCount as frames, musicalTimeAtFrame, previewClockForMusicalTime } from '../src/util/export-timing.ts'
assert.equal(length(300,'preview15'),15)
assert.equal(length(7,'preview15'),7)
assert.equal(length(25,'preview30'),25)
assert.equal(length(300,'full'),300)
assert.equal(length(NaN,'full'),0)
assert.equal(frames(15,30),450)
assert.equal(frames(2.01,30),61)
assert.equal(frames(0,30),0)
for(const speed of [0.5,1,1.25,2]) {
  const musical=musicalTimeAtFrame(90,30)
  assert.equal(previewClockForMusicalTime(musical,speed)/speed,musical)
}
console.log('PASS: 2D export duration, FPS, and video/audio sync')
