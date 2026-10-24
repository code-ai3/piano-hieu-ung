import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync)
assert.ok(executablePath,'Chromium required')
const base='http://127.0.0.1:4180/'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4180'],{stdio:'ignore'})
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
  const chunks=[]
  processor.onaudioprocess=(event)=>{
   chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
   event.outputBuffer.getChannelData(0).fill(0)
  }
  bus.connect(processor);processor.connect(ctx.destination)
  const engine=new GmWebAudio(ctx,()=>bus)
  const voice={key:'violin',program:40,percussion:false}
  try{
   await Promise.race([engine.whenReady(voice,3),new Promise((_,reject)=>
    setTimeout(()=>reject(Error('Timeout loading actual FluidR3 GM violin')),60000))])
   const start=ctx.currentTime+.17
   engine.play(voice,60,92,start,.7,3)
   await new Promise(resolve=>setTimeout(resolve,1520))
   const pcm=new Float32Array(chunks.reduce((sum,x)=>sum+x.length,0))
   let offset=0
   for(const block of chunks){pcm.set(block,offset);offset+=block.length}
   const rendered=await renderMultiTrackAudio({
    notes:[{trackId:3,midi:60,name:'C4',time:.17,duration:.7,velocity:92/127}],
    parts:[{id:3,name:'Violin GM',instrument:'Violin',channel:1,enabled:true,color:'#42abcd',noteCount:1}],
    programs:{3:40},presets:{},volumes:{3:100},pans:{3:0},fx:{},fxBypass:{},
    wavSamples:new Map(),erhuSamples:new Map(),seconds:1.5,tempo:120,
    expression:'original',requireExactInstrument:true,
    gmLiveLoader:gmSampleLoader(ctx)
   })
   const live=audioFingerprint(pcm,ctx.sampleRate)
   const offline=audioFingerprint(rendered.audioBuffer.getChannelData(0),rendered.audioBuffer.sampleRate)
   const comparison=compareAudioFingerprints(live,offline)
   return {live,offline,comparison,fallbacks:rendered.fallbacks}
  }finally{engine.stop();processor.disconnect();bus.disconnect();await ctx.close()}
 })
 assert.deepEqual(errors,[])
 assert.deepEqual(report.fallbacks,[],'No GM substitute may be used')
 assert.ok(report.live.peak>.001&&report.offline.peak>.001,'Both sources must contain decoded violin')
 assert.ok(report.comparison.centroidRatio>.65,'GM should retain comparable tone brightness')
 assert.ok(report.comparison.lowBandDifference<.34)
 assert.ok(report.comparison.midBandDifference<.34)
 assert.ok(report.comparison.highBandDifference<.34)
 assert.ok(report.comparison.attackRatio>.3,'Similar GM note attack')
 console.log('PASS Chromium MELORIX G.2: actual loaded FluidR3 GM violin, shared decoded buffers, live/offline PCM spectral/attack/tail measures',JSON.stringify(report))
}finally{
 try{await browser?.close()}catch{}
 server.kill('SIGTERM')
}
