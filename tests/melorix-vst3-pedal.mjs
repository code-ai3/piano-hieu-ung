import assert from 'node:assert/strict'
import {Vst3PedalScheduler} from '../src/util/melorix-vst3-pedal.ts'
const sent=[]
const p=new Vst3PedalScheduler({sendLiveVst3Pedal:async(id,value)=>{sent.push([id,value])}})
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve))}
p.start(0,[{time:0,value:127},{time:1,value:0}],0)
p.tick(.5);p.tick(1);await flush()
assert.deepEqual(sent,[[0,127],[0,0]])
p.start(1,[{time:0,value:127}],0);p.stop();await flush()
assert.deepEqual(sent.slice(-2),[[1,127],[1,0]])
console.log('PASS: Sustain CC64 on/off, stop and track selection')
