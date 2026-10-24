import {chromium} from 'playwright-core'
import {spawn,execFileSync} from 'node:child_process'
import {existsSync,readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync)
assert.ok(chrome,'Chrome needed for real Stage F.2 Audio FX QA')
const host='http://127.0.0.1:4175/'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4175'],{stdio:'ignore'})
let browser,monitor
try{
 let ready=false
 for(let attempt=0;attempt<120;attempt++){
  try{if((await fetch(host)).ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,350))
 }
 assert.ok(ready,'Preview must be available')
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--enable-precise-memory-info','--autoplay-policy=no-user-gesture-required']})
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true})
 const errors=[]
 page.on('pageerror',e=>errors.push('page:'+e.message))
 page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text())})
 await page.goto(host,{waitUntil:'domcontentloaded'})
 await page.locator('.mx-track-side-item').first().waitFor({timeout:30000})
 const projectInput=page.locator('input[accept=".melorix,application/json"]')
 const fileMenu=page.locator('.mx-menu details').first()
 const makeProject=(notes,enabled=true)=>({
  format:'melorix-project',version:1,name:'Stage F2 FX waveform',tempo:120,
  parts:[
   {id:3,name:'Bass FX',instrument:'Synth Bass',channel:1,noteCount:0,enabled:true,color:'#33aacc'},
   {id:9,name:'Music Box',instrument:'Music Box',channel:2,noteCount:0,enabled:true,color:'#dd8822'}
  ],
  notes,
  programs:{3:38,9:10},presets:{3:'synth-bass',9:'music-box'},
  volumes:{3:90,9:65},pans:{3:-20,9:25},pedal:{3:[],9:[]},
  fx:{3:{enabled,bassDb:12,midDb:-5,trebleDb:3,reverbWet:65,roomMs:1450},
      9:{enabled:false,bassDb:0,midDb:0,trebleDb:0,reverbWet:0,roomMs:1100}},
  performance:{},pianoFeel:{},expression:'original'
 })
 const smallNotes=[
  ...Array.from({length:9},(_,i)=>({trackId:3,midi:[45,48,50][i%3],name:'A2',time:.1+i*.75,duration:.46,velocity:.8})),
  ...Array.from({length:6},(_,i)=>({trackId:9,midi:72+i%4,name:'C5',time:.3+i*1.15,duration:.2,velocity:.67}))
 ]
 async function loadProject(p){
  await projectInput.setInputFiles({name:'fixture.melorix',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))})
  await page.waitForFunction(()=>document.body.textContent?.includes('Đã mở dự án MELORIX'),null,{timeout:12000})
 }
 async function exportWav(){
  await fileMenu.evaluate(el=>{el.open=true})
  const button=page.getByRole('button',{name:/Xuất WAV bản phối/})
  await button.waitFor({timeout:6000})
  const download=page.waitForEvent('download',{timeout:180000})
  await button.click()
  const item=await download
  const file=readFileSync(await item.path())
  assert.equal(file.toString('ascii',0,4),'RIFF')
  assert.equal(file.toString('ascii',8,12),'WAVE')
  assert.equal(file.toString('ascii',36,40),'data')
  const channels=file.readUInt16LE(22),sampleRate=file.readUInt32LE(24)
  assert.equal(channels,2)
  assert.equal(sampleRate,44100)
  assert.ok(file.length>10000)
  return file
 }
 function waveform(file){
  const view=new DataView(file.buffer,file.byteOffset,file.byteLength)
  const samples=(file.length-44)/2
  let sq=0,peak=0
  for(let i=0;i<samples;i++){
   const v=view.getInt16(44+2*i,true)/32768
   sq+=v*v;peak=Math.max(peak,Math.abs(v))
  }
  return {samples,peak,rms:Math.sqrt(sq/samples)}
 }
 function relativeDifference(a,b){
  assert.equal(a.length,b.length,'FX A/B WAV lengths must match')
  let delta=0,ref=0
  // Sample every ~2ms across both channels; do not compare WAV headers.
  for(let i=44;i+1<a.length;i+=176){
   const x=a.readInt16LE(i)/32768,y=b.readInt16LE(i)/32768
   delta+=(x-y)**2;ref+=x*x
  }
  return Math.sqrt(delta/Math.max(ref,1e-10))
 }
 await loadProject(makeProject(smallNotes,true))
 const wet=await exportWav()
 const inspector=page.locator('.mx-track-inspector-btn').first()
 await inspector.click()
 const picker=page.getByRole('combobox',{name:'Track đang chỉnh âm thanh'})
 await picker.selectOption('3')
 const bypassButton=page.locator('.mx-fx-actions button[aria-pressed]').first()
 assert.equal(await bypassButton.getAttribute('aria-pressed'),'true')
 await bypassButton.click()
 assert.equal(await bypassButton.getAttribute('aria-pressed'),'false','FX comparison must bypass RH only')
 const dry=await exportWav()
 const wetStats=waveform(wet),dryStats=waveform(dry)
 assert.ok(wetStats.rms>.0001&&dryStats.rms>.0001,'A/B WAV has real signal')
 assert.ok(wetStats.peak<=.981&&dryStats.peak<=.981,'Peak protection in both modes')
 const abDelta=relativeDifference(wet,dry)
 assert.ok(abDelta>.025,'FX ON/OFF must audibly alter exported PCM waveform')
 console.log('STAGE F2 WAV A/B',JSON.stringify({fxOn:wetStats,fxOff:dryStats,relativeDifference:abDelta}))
 // F.3 fidelity regression: the exported WAV must follow the same uncommitted
 // Velocity A/B currently audible in WebAudio (not the raw MIDI note list).
 await picker.selectOption('3')
 const performanceAB=page.locator('.mx-audio-compare button[aria-pressed]').first()
 assert.equal(await performanceAB.getAttribute('aria-pressed'),'true')
 const velocitySlider=page.getByRole('slider',{name:'Lực đánh MIDI'})
 await velocitySlider.evaluate(el=>{el.value='175';el.dispatchEvent(new Event('input',{bubbles:true}))})
 assert.equal(await velocitySlider.inputValue(),'175')
 const performanceLoud=await exportWav()
 const louder=waveform(performanceLoud)
 assert.ok(louder.rms>dryStats.rms*1.08,
  'Uncommitted expressive velocity must change exported audio as it does WebAudio playback')
 await performanceAB.click()
 assert.equal(await performanceAB.getAttribute('aria-pressed'),'false')
 const performanceOriginal=await exportWav()
 const originalWave=waveform(performanceOriginal)
 assert.ok(originalWave.rms<louder.rms*.95,
  'Per-track A/B off must bypass the uncommitted expression in exported audio')
 console.log('PASS Chromium MELORIX F.3: uncommitted B/C preview expression is honored by exported WAV',JSON.stringify({
  originalRms:originalWave.rms,livePreviewRms:louder.rms,relativeDifference:relativeDifference(performanceLoud,performanceOriginal)
 }))
 // A/B must preserve track 9 settings and render the same duration.
 await picker.selectOption('9')
 assert.equal(await page.getByRole('checkbox',{name:'Bật EQ Reverb track'}).isChecked(),false)
 // Stress: nearly 3-minute, two-track MIDI, no external sample downloads.
 const longNotes=[
  ...Array.from({length:90},(_,i)=>({trackId:3,midi:45+i%5,name:'A2',time:.12+i*2,duration:.57,velocity:.78})),
  ...Array.from({length:60},(_,i)=>({trackId:9,midi:72+i%5,name:'C5',time:.5+i*3,duration:.43,velocity:.61}))
 ]
 await loadProject(makeProject(longNotes,true))
 let peakChromeMiB=0,peakHeapMiB=0
 function sampleChromeRss(){
  try{
   const list=execFileSync('ps',['-eo','comm=,rss='],{encoding:'utf8',timeout:3000})
   const kib=list.split('\n').reduce((sum,line)=>{
    const match=line.trim().match(/^(chrome|chromium|chrome-headless)\S*\s+(\d+)$/i)
    return sum+(match?Number(match[2]):0)
   },0)
   peakChromeMiB=Math.max(peakChromeMiB,Math.round(kib/1024))
  }catch{}
 }
 monitor=setInterval(()=>{
  sampleChromeRss()
  void page.evaluate(()=>Math.round((performance.memory?.usedJSHeapSize??0)/1048576))
   .then(heap=>peakHeapMiB=Math.max(peakHeapMiB,heap)).catch(()=>{})
 },600)
 sampleChromeRss()
 const start=Date.now()
 const longWav=await exportWav()
 clearInterval(monitor);monitor=null
 const elapsedSeconds=Math.round((Date.now()-start)/1000)
 const stress=waveform(longWav)
 const durationSeconds=(longWav.length-44)/(44100*2*2)
 assert.ok(durationSeconds>170&&durationSeconds<190,'Stress WAV must actually contain >=170 s audio')
 assert.ok(stress.rms>.00005,'Long WAV cannot be silent')
 assert.ok(stress.peak<=.981,'Long FX export must not clip')
 assert.ok(peakChromeMiB<2800,'Chrome aggregate RSS unexpectedly exceeds 2800 MiB in 3 min fixture')
 assert.deepEqual(errors,[],'No JavaScript/browser errors in Stage F2 WAV/FX stress')
 console.log('PASS Chromium MELORIX Stage F.2: 3-minute 2-track WAV non-silent, FX ON/OFF waveform differs, bounded Chrome RSS',JSON.stringify({
  durationSeconds,elapsedSeconds,chromeProcessRssMiBPeak:peakChromeMiB,
  jsHeapMiBPeak:peakHeapMiB,outputMiB:Math.round(longWav.length/1048576),
  rms:stress.rms,peak:stress.peak,abDelta
 }))
}finally{
 if(monitor)clearInterval(monitor)
 try{await browser?.close()}catch{}
 server.kill('SIGTERM')
}
