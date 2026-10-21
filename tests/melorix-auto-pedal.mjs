import assert from 'node:assert/strict'
import {suggestAutoPedal,normalizePedalPoints,pedalIntervals} from '../src/util/melorix-auto-pedal.ts'
const notes=[
 {midi:48,time:0,duration:.5},{midi:60,time:0,duration:.5},{midi:64,time:0,duration:.5},
 {midi:52,time:1,duration:.55},{midi:64,time:1,duration:.55},{midi:67,time:1,duration:.55},
 {midi:55,time:2,duration:.55},{midi:67,time:2,duration:.55},{midi:71,time:2,duration:.55},
 {midi:48,time:3,duration:.8},{midi:60,time:3,duration:.8},{midi:64,time:3,duration:.8}]
assert.deepEqual(suggestAutoPedal([], 'natural',120),[])
for(const mode of ['light','natural','deep']){
 const pts=suggestAutoPedal(notes,mode,120)
 assert.ok(pts.length>0,mode+' should propose pedal')
 assert.equal(pts[0].value,127)
 assert.equal(pts.at(-1).value,0)
 assert.equal(pts.length%2,0)
 for(let i=1;i<pts.length;i++)assert.ok(pts[i].time>pts[i-1].time,mode+' times must ascend')
 for(let i=1;i<pts.length;i++)assert.notEqual(pts[i].value,pts[i-1].value)
 assert.deepEqual(normalizePedalPoints(pts),pts)
 assert.ok(pedalIntervals(pts,10).every(p=>p.end>p.start))
}
const run=Array.from({length:7},(_,i)=>({midi:60,time:i*.5,duration:.42}))
const light=suggestAutoPedal(run,'light',120)
const natural=suggestAutoPedal(run,'natural',120)
const deep=suggestAutoPedal(run,'deep',120)
assert.ok(light.length>natural.length&&natural.length>deep.length,'modes should have audible phrasing distinction')
const source=JSON.stringify(notes)
suggestAutoPedal(notes,'natural',120)
assert.equal(JSON.stringify(notes),source,'never modify original notes')
assert.deepEqual(normalizePedalPoints([{time:0,value:127},{time:.2,value:127},{time:.5,value:0}]),
 [{time:0,value:127},{time:.5,value:0}])
assert.deepEqual(normalizePedalPoints([{time:-1,value:127},{time:2,value:0}]),[])
console.log('PASS MELORIX Auto Pedal: 3 modes, stable CC64, user-controlled non-destructive changes')
