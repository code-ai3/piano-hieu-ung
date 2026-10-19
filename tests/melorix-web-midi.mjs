import assert from 'node:assert/strict'
import {midiByte,midiChannel,trackMidiChannel,midiNoteOn,midiNoteOff,midiPanicMessages,availableMidiOutputs,sendMidiNote,panicMidi} from '../src/util/melorix-web-midi.ts'
assert.equal(midiByte(-2),0)
assert.equal(midiByte(260),127)
assert.equal(midiByte(NaN),0)
assert.equal(midiChannel(17),15)
assert.equal(midiChannel(-4),0)
assert.equal(trackMidiChannel(1),0)
assert.equal(trackMidiChannel(10),9)
assert.equal(trackMidiChannel(16),15)
assert.deepEqual(midiNoteOn(60,95,0),[0x90,60,95])
assert.deepEqual(midiNoteOn(36,127,9),[0x99,36,127])
assert.deepEqual(midiNoteOff(60,0),[0x80,60,0])
assert.deepEqual(midiNoteOff(60,9),[0x89,60,0])
assert.equal(midiPanicMessages().length,48)
assert.deepEqual(midiPanicMessages()[0],[0xb0,64,0])
assert.deepEqual(midiPanicMessages().at(-1),[0xbf,120,0])
const sent=[]
let cleared=0
const live={id:'test',name:'loopMIDI',state:'connected',send:(data,time)=>sent.push({data,time}),clear:()=>cleared++}
const missing={id:'missing',name:'Disconnected',state:'disconnected',send:()=>{}}
assert.deepEqual(availableMidiOutputs({outputs:new Map([['a',live],['b',missing]])}),[{id:'test',label:'loopMIDI'}])
sendMidiNote(live,60,94,0,125,320)
assert.deepEqual(sent.slice(0,2),[{data:[0x90,60,94],time:125},{data:[0x80,60,0],time:445}])
panicMidi(live)
assert.equal(cleared,1)
assert.equal(sent.length,50)
assert.deepEqual(sent.at(-1).data,[0xbf,120,0])
console.log('PASS Web MIDI stage 1: channels, drum channel, bytes, timed notes, connected ports, panic')
