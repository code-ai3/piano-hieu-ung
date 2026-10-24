import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {audioFingerprint,compareAudioFingerprints} from '../src/util/melorix-g2-parity-metrics.ts'
const sine=(freq,amp=1,delay=0)=>{
 const samples=new Float32Array(44100)
 for(let n=delay;n<samples.length;n++){
  const t=(n-delay)/44100
  samples[n]=amp*Math.sin(2*Math.PI*freq*t)*Math.min(1,t/.02)*Math.exp(-3*t)
 }
 return samples
}
const a=audioFingerprint(sine(440),44100)
const b=audioFingerprint(sine(440,.5,4000),44100)
const c=audioFingerprint(sine(1760),44100)
const same=compareAudioFingerprints(a,b)
assert.ok(same.centroidRatio>.94&&same.lowBandDifference<.02)
assert.ok(same.attackRatio>.40&&same.attackRatio<.61)
assert.ok(compareAudioFingerprints(a,c).centroidRatio<.5)
assert.ok(b.onsetSeconds>.09&&b.onsetSeconds<.12)
assert.throws(()=>audioFingerprint(Float32Array.of(NaN),44100))
const gm=readFileSync('src/util/melorix-gm-audio.ts','utf8')
const mix=readFileSync('src/util/melorix-offline-mix.ts','utf8')
const view=readFileSync('src/views/PianoView.vue','utf8')
const workflow=readFileSync('.github/workflows/melorix-web-qa.yml','utf8')
for(const mark of ['loader:gmSampleLoader(this.ctx)','storage:gmSampleStorage()','async whenReady('])assert.ok(gm.includes(mark))
for(const mark of ['loader:opts.gmLiveLoader??gmSampleLoader(ctx)','storage:gmSampleStorage()'])assert.ok(mix.includes(mark))
assert.ok(view.includes('gmLiveLoader:audioCtx.value?gmSampleLoader(audioCtx.value):undefined'))
assert.ok(workflow.includes('feature/melorix-g2-gm-source-parity'))
assert.ok(workflow.includes('tests/melorix-stage-g2-browser-qa.mjs'))
console.log('PASS MELORIX G.2: GM shared sample source and audible signal comparison metrics')
