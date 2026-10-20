import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {midiDrawRange} from '../src/util/melorix-note-draw.ts'

const approx=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`)
// One click must make one visible cell-sized note (not a zero-length note).
assert.deepEqual(midiDrawRange(1.14,1.14,.25),{time:1,duration:.25})
assert.deepEqual(midiDrawRange(0,0,.125),{time:0,duration:.125})
// Dragging either direction keeps a positive MIDI duration and follows Snap.
assert.deepEqual(midiDrawRange(1.14,1.84,.25,true),{time:1,duration:1})
assert.deepEqual(midiDrawRange(1.84,1.14,.25,true),{time:1,duration:1})
assert.deepEqual(midiDrawRange(0.12,0.12,.5,true),{time:0,duration:.5})
assert.deepEqual(midiDrawRange(3.02,2.52,.25,true),{time:2.5,duration:.75})
// Without snap, clicks are still audible and drag release respects minimum duration.
assert.deepEqual(midiDrawRange(2.2,2.2,0),{time:2.2,duration:.25})
assert.deepEqual(midiDrawRange(2.2,2.8,0,true),{time:2.2,duration:.6})
assert.deepEqual(midiDrawRange(2.8,2.2,0,true),{time:2.2,duration:.6})
assert.deepEqual(midiDrawRange(2.2,2.201,0,true),{time:2.2,duration:.04})
assert.deepEqual(midiDrawRange(-5,-3,.25),{time:0,duration:.25})
assert.deepEqual(midiDrawRange(NaN,NaN,.25),{time:0,duration:.25})
// Triplet note lengths must remain stable after floating point arithmetic.
const triplet=midiDrawRange(.37,.61,1/6,true)
approx(triplet.time,1/3)
approx(triplet.duration,1/3)

const view=readFileSync(new URL('../src/components/MelorixPianoRoll.vue',import.meta.url),'utf8')
const style=readFileSync(new URL('../src/assets/melorix-roll.css',import.meta.url),'utf8')
for(const text of [
 "const tool=ref<'select'|'draw'|'erase'>('draw')",
 'function beginNoteDraw(e:PointerEvent)',
 'function moveNoteDraw(e:PointerEvent)',
 'function finishNoteDraw(e:PointerEvent)',
 'function cancelNoteDraw(e?:PointerEvent)',
 'function gridDown(e:PointerEvent)',
 "if(tool.value==='draw')beginNoteDraw(e)",
 'midiDrawRange(state.anchorSeconds,currentSeconds,snap.value,moved)',
 'draft.value.push({',
 'setSelection([index])',
 'commit(state.before)',
 'clearNoteDrawListeners()',
 'window.addEventListener(\'pointercancel\',cancelNoteDraw)',
 'cancelNoteDraw();if(painting)',
 'function removeSelected()',
 'function undoEdit()',
 "e.key==='Delete'||e.key==='Backspace'",
 "@pointerdown=\"gridDown\"",
 "@contextmenu.prevent.stop=\"removeNote(i)\"",
 '@click="removeSelected"',
 "@click=\"tool='draw'\"",
 "@click=\"tool='select'\"",
 "@click=\"tool='erase'\"",
])assert.ok(view.includes(text),'Missing painting, undo or deletion UI: '+text)
assert.match(style,/\.mx-roll-editbar \.mx-roll-tool\[aria-pressed="true"\]/)
assert.match(style,/\.mx-roll-grid\.mx-roll-grid-draw\{cursor:crosshair/)
assert.match(view,/trackId:props\.part\.id,midi:pitch,name:midiNoteName\(pitch\)/)
assert.match(view,/if\(tool\.value==='erase'\)\{e\.preventDefault\(\);removeNote\(index\);return\}/)
console.log('PASS: drag-to-draw snapped/free MIDI notes, both drag directions, selected-note delete, undo and UI tools')
