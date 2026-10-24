import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {spawn,execFileSync} from 'node:child_process'
import {readFileSync,existsSync} from 'node:fs'
const seconds=Number(process.env.H2_EXPORT_SECONDS??180)
assert.ok(seconds===180||seconds===300,'Only 180s/300s fixture allowed')
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync)
assert.ok(chrome,'Chromium required for real MP4')
const host='http://127.0.0.1:4186'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4186'],{stdio:'ignore'})
let browser,monitor
try{
 let available=false
 for(let n=0;n<120;n++){
  try{if((await fetch(host)).ok){available=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,400))
 }
 assert.ok(available,'H2 Vite production preview unavailable')
 browser=await chromium.launch({executablePath:chrome,headless:true,
  args:['--no-sandbox','--enable-precise-memory-info','--autoplay-policy=no-user-gesture-required']})
 const page=await browser.newPage({viewport:{width:1600,height:950},acceptDownloads:true})
 page.setDefaultTimeout(25000)
 const errors=[]
 page.on('pageerror',err=>errors.push(err.message))
 await page.addInitScript(()=>{try{delete window.showSaveFilePicker}catch{}})
 await page.goto(host,{waitUntil:'domcontentloaded'})
 await page.locator('.mx-track-side-item').first().waitFor({timeout:35000})
 const notes=[
  ...Array.from({length:Math.floor(seconds/1.7)},(_,i)=>({trackId:3,midi:43+i%7,name:'G2',time:.1+i*1.7,duration:.56,velocity:.66+(i%4)*.07})),
  ...Array.from({length:Math.floor(seconds/2.2)},(_,i)=>({trackId:9,midi:67+i%9,name:'G4',time:.4+i*2.2,duration:.3,velocity:.62+(i%5)*.05})),
  {trackId:3,midi:43,name:'G2',time:seconds-1,duration:.7,velocity:.8}
 ]
 const project={
  format:'melorix-project',version:1,name:'Stage H2 1080p long MP4',tempo:120,
  parts:[{id:3,name:'H2 Synth Bass',instrument:'Synth Bass',channel:1,enabled:true,color:'#22aacc',noteCount:0},
    {id:9,name:'H2 Music Box',instrument:'Music Box',channel:2,enabled:true,color:'#cc8822',noteCount:0}],
  notes,programs:{3:38,9:10},presets:{3:'synth-bass',9:'music-box'},
  volumes:{3:84,9:75},pans:{3:-18,9:16},pedal:{3:[],9:[]},
  fx:{3:{enabled:true,bassDb:5,midDb:-2,trebleDb:2,reverbWet:26,roomMs:1050},
      9:{enabled:false,bassDb:0,midDb:0,trebleDb:0,reverbWet:0,roomMs:1100}},
  performance:{},pianoFeel:{},expression:'original'
 }
 await page.locator('input[accept=".melorix,application/json"]').setInputFiles({
  name:'h2-long.melorix',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))
 })
 await page.waitForFunction(()=>document.body.innerText.includes('Đã mở dự án MELORIX'),null,{timeout:20000})
 const menu=page.locator('.mx-menu details').first()
 await menu.evaluate(el=>el.open=true)
 await page.getByRole('button',{name:'Xuất video MP4'}).click()
 const modal=page.locator('.modal-open')
 await modal.waitFor()
 await modal.locator('select:has(option[value="full"])').selectOption('full')
 await page.evaluate(()=>{try{Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:8})}catch{}})
 let peakRssMiB=0,peakJsHeapMiB=0,peakCpuPct=0
 function sampleProcesses(){
  try{
   const listing=execFileSync('ps',['-eo','comm=,rss=,pcpu='],{encoding:'utf8',timeout:3000})
   let rss=0,cpu=0
   for(const line of listing.split('\n')){
    const m=line.trim().match(/^(chrome|chromium|chrome-headless)\S*\s+(\d+)\s+([\d.]+)$/i)
    if(m){rss+=Number(m[2]);cpu+=Number(m[3])}
   }
   peakRssMiB=Math.max(peakRssMiB,Math.round(rss/1024))
   peakCpuPct=Math.max(peakCpuPct,Math.round(cpu))
  }catch{}
 }
 monitor=setInterval(()=>{
  sampleProcesses()
  void page.evaluate(()=>Math.round((performance.memory?.usedJSHeapSize??0)/1048576))
   .then(x=>peakJsHeapMiB=Math.max(peakJsHeapMiB,x)).catch(()=>{})
 },1000)
 sampleProcesses()
 const beginning=Date.now()
 const downloadPromise=page.waitForEvent('download',{timeout:25*60*1000})
 await modal.locator('button:has(i.fa-download)').click()
 const download=await downloadPromise
 const exportElapsedSeconds=Math.round((Date.now()-beginning)/1000)
 clearInterval(monitor);monitor=null
 const path=await download.path()
 const bytes=readFileSync(path)
 assert.equal(bytes.toString('ascii',4,8),'ftyp','Must be genuine MP4')
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],
  {encoding:'utf8',timeout:60000}))
 const video=probe.streams.find(s=>s.codec_type==='video')
 const audio=probe.streams.find(s=>s.codec_type==='audio')
 assert.ok(video&&audio,'Long MP4 must contain video and audio')
 assert.equal(video.codec_name,'h264')
 assert.equal(audio.codec_name,'aac')
 assert.equal(video.width,1920);assert.equal(video.height,1080)
 const vd=Number(video.duration??probe.format.duration)
 const ad=Number(audio.duration??probe.format.duration)
 assert.ok(vd>=seconds-4&&vd<=seconds+4,'Video must really last 3/5 minutes')
 assert.ok(ad>=seconds-4&&ad<=seconds+4,'AAC must really last 3/5 minutes')
 assert.ok(Math.abs(vd-ad)<.26,'Long video/audio drift exceeds 260ms')
 const pcm=execFileSync('ffmpeg',['-v','error','-i',path,'-map','0:a:0','-t','3','-ar','8000','-ac','1','-f','s16le','-'],
  {timeout:60000,maxBuffer:200000})
 let signal=0
 for(let i=0;i+2<=pcm.length;i+=2)signal=Math.max(signal,Math.abs(pcm.readInt16LE(i)))
 assert.ok(signal>30,'Long MP4 audio must be audible')
 assert.ok(peakRssMiB>0&&peakRssMiB<3800,'Chromium aggregate RSS over 3.8 GiB on Linux runner')
 assert.ok(peakJsHeapMiB<1024,'JS heap exceeded 1GiB on Linux runner')
 assert.deepEqual(errors,[],'Browser JS errors during long MP4')
 const result={secondsRequested:seconds,videoSeconds:vd,audioSeconds:ad,
  audioVideoDriftSeconds:Math.abs(vd-ad),durationToEncodeSeconds:exportElapsedSeconds,
  peakChromiumRssMiB:peakRssMiB,peakJsHeapMiB,peakChromeCpuPercentSum:peakCpuPct,
  outputMiB:Math.round(bytes.length/1048576),codecVideo:video.codec_name,codecAudio:audio.codec_name,
  width:video.width,height:video.height,fps:video.avg_frame_rate,noteCount:notes.length,audioPeakSample:signal}
 console.log('PASS Chromium MELORIX Stage H.2 REAL long MP4 1080p',JSON.stringify(result))
}finally{
 if(monitor)clearInterval(monitor)
 try{await browser?.close()}catch{}
 server.kill('SIGTERM')
}
