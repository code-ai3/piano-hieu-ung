import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync)
assert.ok(executablePath,'Chromium required')
const base='http://127.0.0.1:4184/'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4184'],{stdio:'ignore'})
let browser
try{
 let available=false
 for(let i=0;i<110;i++){
  try{if((await fetch(base)).ok){available=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,300))
 }
 assert.ok(available,'Vite dev startup')
 browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']})
 const page=await browser.newPage({viewport:{width:1400,height:900}})
 page.setDefaultTimeout(90000)
 const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base,{waitUntil:'domcontentloaded'})
 const report=await page.evaluate(async()=>{
  const {GmWebAudio}=await import('/src/util/melorix-gm-audio.ts')
  const {gmSampleLoader}=await import('/src/util/melorix-gm-sample-cache.ts')
  const {renderMultiTrackAudio}=await import('/src/util/melorix-offline-mix.ts')
  const {audioFingerprint,compareAudioFingerprints}=await import('/src/util/melorix-g2-parity-metrics.ts')
  const ctx=new AudioContext({sampleRate:44100})
  await ctx.resume()
  const bus=ctx.createGain()
  const processor=ctx.createScriptProcessor(1024,1,1)
  let chunks=[]
  processor.onaudioprocess=(event)=>{
   chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
   event.outputBuffer.getChannelData(0).fill(0)
  }
  bus.connect(processor);processor.connect(ctx.destination)
  const engine=new GmWebAudio(ctx,()=>bus)
  const matrix=[['Bright Piano',1,'bright_acoustic_piano',60],['Steel Guitar',25,'acoustic_guitar_steel',60],['Finger Bass',33,'electric_bass_finger',48],['Violin',40,'violin',60],['String Ensemble',48,'string_ensemble_1',60]]
  const reports=[]
  try{
   for(const [name,program,key,midi] of matrix){
   const voice={key,program,percussion:false}
   await Promise.race([engine.whenReady(voice,3),new Promise((_,reject)=>
    setTimeout(()=>reject(Error('Timeout loading actual FluidR3 GM violin')),60000))])
   chunks=[]
   const start=ctx.currentTime+.17
   engine.play(voice,midi,92,start,.7,3)
   await new Promise(resolve=>setTimeout(resolve,1520))
   const pcm=new Float32Array(chunks.reduce((sum,x)=>sum+x.length,0))
   let offset=0
   for(const block of chunks){pcm.set(block,offset);offset+=block.length}
   const rendered=await renderMultiTrackAudio({
    notes:[{trackId:3,midi,name:'C4',time:.17,duration:.7,velocity:92/127}],
    parts:[{id:3,name,instrument:name,channel:1,enabled:true,color:'#42abcd',noteCount:1}],
    programs:{3:program},presets:{},volumes:{3:100},pans:{3:0},fx:{},fxBypass:{},
    wavSamples:new Map(),erhuSamples:new Map(),seconds:1.5,tempo:120,
    expression:'original',requireExactInstrument:true,
    gmLiveLoader:gmSampleLoader(ctx)
   })
   const live=audioFingerprint(pcm,ctx.sampleRate)
   // Compare downmixed audio consistently: live processor captures mono.
   // Offline's equal-power center panner distributes that mono signal across L/R.
   const buffer=rendered.audioBuffer
   const left=buffer.getChannelData(0),right=buffer.getChannelData(1)
   const mono=new Float32Array(buffer.length)
   for(let i=0;i<mono.length;i++)mono[i]=(left[i]+right[i])/2
   const offline=audioFingerprint(mono,buffer.sampleRate)
   const comparison=compareAudioFingerprints(live,offline)
   reports.push({name,key,program,live,offline,comparison,fallbacks:rendered.fallbacks})
   }
   return reports
  }finally{engine.stop();processor.disconnect();bus.disconnect();await ctx.close()}
 })
 assert.deepEqual(errors,[])
 assert.equal(report.length,5,'Test Bright Piano, Guitar, Bass, Violin and Strings')
 for(const voice of report){
  assert.deepEqual(voice.fallbacks,[],'No GM substitute: '+voice.name)
  assert.ok(voice.live.peak>.001&&voice.offline.peak>.001,'Sampled voice not silent: '+voice.name)
  assert.ok(voice.comparison.centroidRatio>.85,'Very different timbre: '+voice.name)
  assert.ok(voice.comparison.attackRatio>.82,'Different attack: '+voice.name)
  assert.ok(voice.comparison.lowBandDifference<.5,'Low-frequency mismatch: '+voice.name)
  assert.ok(voice.comparison.midBandDifference<.5,'Mid-frequency mismatch: '+voice.name)
 }
 console.log('PASS Chromium MELORIX G.3: five FluidR3 GM voices real live/offline PCM parity',JSON.stringify(report))
}finally{
 try{await browser?.close()}catch{}
 server.kill('SIGTERM')
}
