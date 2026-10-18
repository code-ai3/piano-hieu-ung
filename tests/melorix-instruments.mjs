import assert from 'node:assert/strict'
import {INSTRUMENT_PRESETS,isInstrumentPreset,instrumentPreset,makeInstrumentTrack,synthVoicePlan} from '../src/util/melorix-instruments.ts'
assert.equal(INSTRUMENT_PRESETS.length,6)
assert.deepEqual(new Set(INSTRUMENT_PRESETS.map(p=>p.id)).size,6)
assert.equal(isInstrumentPreset('music-box'),true)
assert.equal(isInstrumentPreset('Kontakt'),false)
assert.equal(instrumentPreset('organ').program,19)
const parts=[
 {id:0,name:'Right',instrument:'Piano',channel:1,noteCount:12,enabled:true,color:'#ffffff'},
 {id:2,name:'Left',instrument:'Piano',channel:3,noteCount:9,enabled:true,color:'#ffffff'}
]
const original=structuredClone(parts)
const added=makeInstrumentTrack(parts,'organ','  Erhu nghiên cứu  ')
assert.equal(added.id,3)
assert.equal(added.name,'Erhu nghiên cứu')
assert.equal(added.instrument,'Organ (Web Synth)')
assert.equal(added.channel,2)
assert.equal(added.noteCount,0)
assert.equal(added.enabled,true)
assert.deepEqual(parts,original)
assert.equal(makeInstrumentTrack([], 'piano').id,0)
const fullChannels=Array.from({length:15},(_,id)=>({...parts[0],id,channel:id<9?id+1:id+2}))
assert.equal(makeInstrumentTrack(fullChannels,'piano').channel,1)
for(const item of INSTRUMENT_PRESETS){
 const s=synthVoicePlan(item.id,69,1,1)
 assert.equal(s.freq,440)
 assert.ok(s.attack>0&&s.release>0&&s.length>=.05&&s.blend>=0&&s.blend<1)
 assert.ok(['sine','square','sawtooth','triangle'].includes(s.wave))
}
assert.ok(Math.abs(synthVoicePlan('organ',60,.5,2).freq-261.625565)<.001)
console.log('PASS instrument Phase 2: 6 presets, unique ids, unused channels, WebAudio plans, track immutability')
