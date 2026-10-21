import assert from 'node:assert/strict'
import {diagnoseLocalVst3} from '../src/util/melorix-vst3-diagnostics.ts'
const events=[]
const api=(opts={})=>({
 listVst3Tracks:async()=>({audioConnected:!!opts.active,liveTrack:opts.active?7:-1,
  tracks:opts.unloaded?[]:[{track:7,componentInitialized:true,editorOpened:true}]}),
 startLiveVst3Track:async()=>{events.push('start');if(opts.failStart)throw Error('No device');return {ok:true,audioConnected:true,driver:'wasapi-shared'}},
 sendLiveVst3Note:async(track,pitch,velocity)=>{events.push(velocity?'on':'off');if(opts.failOn&&velocity)throw Error('note error');return {ok:true,track,pitch,noteOn:velocity>0}},
 stopLiveVst3:async()=>{events.push('stop');return {ok:true,audioConnected:false}},
 audition:async()=>({peak:opts.noPcm?0:0.15,nonzeroSamples:opts.noPcm?0:1200})
})
const wait=async()=>{}
let port=api()
let r=await diagnoseLocalVst3(port,7,()=>port.audition(),wait)
assert.equal(r.complete,true)
assert.deepEqual(events,['start','on','off','stop'])
events.length=0
port=api({active:true})
r=await diagnoseLocalVst3(port,7,()=>port.audition(),wait)
assert.equal(r.complete,false)
assert.deepEqual(events,[],'must not disrupt existing stream')
events.length=0
port=api({unloaded:true})
r=await diagnoseLocalVst3(port,7,()=>port.audition(),wait)
assert.equal(r.loaded,false)
assert.deepEqual(events,[])
events.length=0
port=api({noPcm:true})
r=await diagnoseLocalVst3(port,7,()=>port.audition(),wait)
assert.equal(r.hasPcm,false)
assert.equal(r.complete,false)
assert.deepEqual(events,['start','on','off','stop'])
events.length=0
port=api({failOn:true})
r=await diagnoseLocalVst3(port,7,()=>port.audition(),wait)
assert.equal(r.complete,false)
assert.deepEqual(events,['start','on','stop'])
events.length=0
port=api({failStart:true})
r=await diagnoseLocalVst3(port,7,()=>port.audition(),wait)
assert.equal(r.complete,false)
assert.deepEqual(events,['start'])
console.log('PASS: MELORIX local VST3 PCM/WASAPI/NoteOn-Off QA, no stream interruption, safe cleanup')
