import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {Vst3SongScheduler} from '../src/util/melorix-vst3-song.ts'
const sent=[],errors=[]
const s=new Vst3SongScheduler({sendLiveVst3Note:async(...a)=>{sent.push(a)}},e=>errors.push(e))
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))}
const notes=[{trackId:1,midi:60,velocity:.8,time:0,duration:1},
 {trackId:1,midi:64,velocity:.6,time:.5,duration:1},{trackId:2,midi:55,velocity:1,time:0,duration:4}]
s.start(notes,1,0);s.tick(0);s.tick(.5);s.tick(1);s.tick(1.5);await flush()
assert.deepEqual(sent.map(x=>[x[0],x[1],x[2]?1:0]),[[1,60,1],[1,64,1],[1,60,0],[1,64,0]])
s.start(notes,1,0);s.tick(0);s.stop();await flush()
assert.deepEqual(sent.slice(-2).map(x=>[x[1],x[2]?1:0]),[[60,1],[60,0]])
assert.equal(s.isPlayingTrack(1),false)
let k=sent.length
s.start(notes,1,.75);s.tick(1);s.stop();await flush()
assert.ok(sent.slice(k).every(x=>x[2]===0),'Seek must not retrigger old note')
k=sent.length
s.start(notes,1,0);s.tick(2);s.stop();await flush()
assert.ok(sent.slice(k).every(x=>x[2]===0),'Inactive tab must not burst notes')
assert.deepEqual(errors,[])
const vue=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
for(const m of ['vst3Song?.start(notes.value','vst3Song?.tick(currentTime.value/speed.value)','vst3Song?.isPlayingTrack(n.trackId)',"function pause(reason:'user'|'interruption'='user') { vst3Pedal?.stop(); vst3Song?.stop()"])assert.ok(vue.includes(m))
console.log('PASS: GĐ3C1 MIDI song playback dispatch, pause/seek, no duplicate synth')
