import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {Midi} from '@tonejs/midi'
import {exportMidiProgram} from '../src/util/melorix-midi-program-export.ts'
for(const n of [0,1,24,25,32,33,40,64,110,127]){
 assert.equal(exportMidiProgram(n),n,'Keep imported GM program '+n)
 assert.equal(exportMidiProgram(n,0),0,'Explicit piano override must be honoured')
}
assert.equal(exportMidiProgram(33,41),41)
assert.equal(exportMidiProgram(99,undefined),99)
assert.equal(exportMidiProgram(99,NaN),99)
assert.equal(exportMidiProgram(99,-1),99)
assert.equal(exportMidiProgram(99,128),99)
assert.equal(exportMidiProgram(undefined),0)
assert.equal(exportMidiProgram('32'),0)
assert.equal(exportMidiProgram(4.5),0)
// Serialize/parse a multi-instrument Standard MIDI File to catch an actual metadata regression.
const midi=new Midi()
const source=[{name:'Piano',program:0},{name:'Guitar',program:25},{name:'Bass',program:33}]
for(const {name,program} of source){
 const track=midi.addTrack()
 track.name=name
 track.instrument.number=exportMidiProgram(program)
 track.addNote({midi:60,time:0,duration:1,velocity:.8})
}
const roundtrip=new Midi(midi.toArray())
assert.deepEqual(roundtrip.tracks.map(t=>t.instrument.number),source.map(t=>t.program))
assert.deepEqual(roundtrip.tracks.map(t=>t.name),source.map(t=>t.name))
const view=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
assert.match(view,/track\.instrument\.number=exportMidiProgram\(importedMidiPrograms\.value\[part\.id\],explicitPresetProgram\)/)
assert.match(view,/exportMidiProgram\(importedMidiPrograms\.value\[part\.id\]/)
console.log('PASS: edited MIDI retains imported GM programs and explicit preset overrides (roundtrip)')
