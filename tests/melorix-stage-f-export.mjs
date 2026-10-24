import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {prepareExportAudio,verifyExportSync} from '../src/util/melorix-stage-f-export-signal.ts'
const mock=(channels,rate=48000)=>({numberOfChannels:channels.length,length:channels[0].length,sampleRate:rate,getChannelData(i){return channels[i]}})
const stereo=[Float32Array.from([0,.5,-1.2,.25,NaN]),Float32Array.from([0,-.4,.1,-.75,Infinity])]
const stats=prepareExportAudio(mock(stereo))
assert.equal(stats.invalidSamples,2)
assert.equal(stats.samplesOverFullScale,1)
assert.ok(Math.abs(stats.peakAfter-.98)<.00001)
assert.ok(stereo.every(ch=>Array.from(ch).every(v=>Number.isFinite(v)&&Math.abs(v)<=.98001)))
assert.equal(stereo[0][0],0)
const quiet=[Float32Array.from([.01,-.008])]
assert.equal(prepareExportAudio(mock(quiet)).gain,1,'Do not amplify a quiet mix')
assert.ok(Math.abs(quiet[0][0]-.01)<1e-7,'No mutation of under-headroom values')
assert.throws(()=>prepareExportAudio(mock([new Float32Array(100)])),/Không có tín hiệu/)
assert.throws(()=>prepareExportAudio(mock([Float32Array.from([.1])]),0),/headroom/)
assert.deepEqual(verifyExportSync(1.5,1.5,30),{frameCount:45,videoSeconds:1.5,driftSeconds:0})
assert.ok(verifyExportSync(1.505,1.5,30).driftSeconds<0)
assert.equal(verifyExportSync(1.45,1.433,30).frameCount,43)
assert.throws(()=>verifyExportSync(1.1,1.5,30),/Lệch thời gian/)
assert.throws(()=>verifyExportSync(1.5,0,30),/không hợp lệ/)
const view=readFileSync('src/views/PianoView.vue','utf8')
for(const token of ['const audioStats=prepareExportAudio(audioBuf)',
 'verifyExportSync(audioStats.durationSeconds,exportSeconds,fps)',
 'const wavStats=prepareExportAudio(mix.audioBuffer)',
 'if(exportSync.frameCount!==totalFrames)',
 'Không thể xuất MP4: '])assert.ok(view.includes(token),'Stage F export guard missing: '+token)
const flow=readFileSync('.github/workflows/melorix-web-qa.yml','utf8')
assert.ok(flow.includes('feature/melorix-stage-f-export-validation'),'Stage F branch must trigger CI')
console.log('PASS MELORIX Stage F: peak safety, silent detection, audio/frame sync validation, WAV/MP4 integration')
