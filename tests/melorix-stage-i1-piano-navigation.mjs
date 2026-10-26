import assert from 'node:assert/strict'
import {
 PIANO_ROLL_MIN_ZOOM,PIANO_ROLL_MAX_ZOOM,PIANO_ROLL_DEFAULT_ZOOM,
 clampPianoRollZoom,fitPianoRollZoom,pianoRollRulerStep,
 pianoRollScrollForTime,pianoRollTimeAtCenter,stepPianoRollZoom
} from '../src/util/melorix-stage-i1-piano-navigation.ts'

assert.equal(clampPianoRollZoom(Number.NaN),PIANO_ROLL_DEFAULT_ZOOM)
assert.equal(clampPianoRollZoom(Infinity),PIANO_ROLL_DEFAULT_ZOOM)
assert.equal(clampPianoRollZoom(-5),PIANO_ROLL_MIN_ZOOM)
assert.equal(clampPianoRollZoom(200),PIANO_ROLL_MAX_ZOOM)
assert.equal(clampPianoRollZoom(4.17),4)
assert.ok(fitPianoRollZoom(0,300,950)<=3.5,'five-minute song must fit in overview')
assert.ok(fitPianoRollZoom(0,300,950)>=1,'overview zoom cannot drop below safe min')
assert.equal(fitPianoRollZoom(6,6,1000),160,'single very short note gets a usable zoom')
assert.equal(fitPianoRollZoom(NaN,12,1000),40)
assert.equal(pianoRollRulerStep(40),2,'normal 40 px/s ruler remains two seconds')
assert.ok(pianoRollRulerStep(2)>=30,'overview has readable ruler tick distance')
assert.equal(pianoRollRulerStep(140),1,'close editing shows each second')
assert.equal(stepPianoRollZoom(1,-1),1)
assert.equal(stepPianoRollZoom(160,1),160)
assert.ok(stepPianoRollZoom(40,1)>40)
assert.ok(stepPianoRollZoom(40,-1)<40)

// Viewport time stays anchored when zooming in and out without touching MIDI.
for (const [left,viewport,zoom,next] of [[480,980,40,60],[95,600,6,15],[1800,1200,80,3]]){
 const seconds=pianoRollTimeAtCenter(left,viewport,zoom)
 const newScroll=pianoRollScrollForTime(seconds,next,viewport)
 if(newScroll>0){
  assert.ok(Math.abs(pianoRollTimeAtCenter(newScroll,viewport,next)-seconds)<.001)
 }
}
assert.equal(pianoRollScrollForTime(-5,12,900),0,'negative musical time must clamp')
assert.equal(pianoRollScrollForTime(NaN,12,900),0,'invalid time must not create NaN styles')
assert.equal(pianoRollTimeAtCenter(NaN,900,40),0)
console.log('PASS MELORIX I.1: time-anchored zoom, fit whole/selection, adaptive ruler and finite scroll')
