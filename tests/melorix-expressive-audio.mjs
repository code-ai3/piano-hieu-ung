import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {expressedVelocity,isExpressionMode,EXPRESSION_LABELS} from '../src/util/melorix-expressive-audio.ts'

for(const mode of ['original','natural','warm']){
 assert.equal(isExpressionMode(mode),true)
 assert.equal(typeof EXPRESSION_LABELS[mode],'string')
}
assert.equal(isExpressionMode('weird'),false)
for(const velocity of [1,25,64,99,127]){
 assert.equal(expressedVelocity(velocity,0,120,'original'),velocity)
 for(const mode of ['natural','warm']){
  for(const time of [0,.25,.5,1,2.5,4,8]){
   const result=expressedVelocity(velocity,time,120,mode)
   assert.ok(Number.isInteger(result)&&result>=1&&result<=127,mode+' '+velocity)
   assert.ok(Math.abs(result-velocity)<=Math.ceil(velocity*.25)+1,'Dynamics should be subtle')
  }
 }
}
assert.notEqual(expressedVelocity(80,0,120,'warm'),expressedVelocity(80,.25,120,'warm'))
assert.equal(expressedVelocity(90,1,0,'warm'),90)
assert.equal(expressedVelocity(90,1,Number.NaN,'warm'),90)
const view=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
for(const mark of [
 "const expressionMode=ref<ExpressionMode>('natural')",
 "new ExpressiveAudioMaster(ctx,expressionMode.value)",
 "node.connect(panner)",
 "const rack=new TrackFxRack(ctx,getAudioMaster(ctx),currentTrackFx(id))",
 "panner.connect(rack.input)",
 "setExpressionMode('original')",
 "setExpressionMode('natural')",
 "setExpressionMode('warm')",
 "expressedVelocity(velocity,scoreOnset,midiTempo.value,expressionMode.value)",
 "synthScheduledVoices,undefined,n.time)",
 "ensurePianoTrackSample(ctx,trackId)",
 "baseUrl:'/samples/sfzinstruments-splendid-grand-piano/samples'",
 "destination:trackOutput(ctx,id)",
 "void sampler.load.then(()=>{entry.ready=true})",
 "stopPianoTrackSamples()",
 "audioMaster?.disconnect();audioMaster=null",
 "clearTrackAudioOutputs()"
])assert.ok(view.includes(mark), 'Missing expressive playback feature: '+mark)
const gm=readFileSync(new URL('../src/util/melorix-gm-audio.ts',import.meta.url),'utf8')
for(const mark of ['filter.type=\'lowpass\'','filter.connect(amp);amp.connect(destination)','Math.pow(power,.75)','make(bass?', 'fallbackDrum']){
 assert.ok(gm.includes(mark),'Missing warm fallback: '+mark)
}
assert.ok(view.includes('Math.max(.06,duration)'))
assert.ok(!view.includes('trackVolumeLevels.value=Object.fromEntries'))
console.log('PASS: expression modes, untouched MIDI, per-track local piano samples, gain isolation, warm offline fallback')
