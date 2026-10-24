// MELORIX H.3 — real MP4/WAV parity and falling-note frame QA (Linux Chromium).
// This runs on a 14-second fixture; H.2 separately covers full 3/5-minute exports.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync)
assert.ok(chrome,'Chromium is required for real MP4 QA')
assert.ok(existsSync('/usr/bin/ffmpeg')||existsSync('/bin/ffmpeg'),'FFmpeg is required')
const host='http://127.0.0.1:4187'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4187'],{stdio:'ignore'})
let browser
const rate=16000
const fixtureNotes=[
  {trackId:3,midi:43,name:'G2',time:.45,duration:.48,velocity:.76},
  {trackId:3,midi:47,name:'B2',time:1.80,duration:.40,velocity:.9},
  {trackId:3,midi:50,name:'D3',time:3.2,duration:.35,velocity:.63},
  {trackId:9,midi:72,name:'C5',time:7.2,duration:.56,velocity:.73},
  {trackId:9,midi:76,name:'E5',time:9.5,duration:.5,velocity:.82},
  {trackId:9,midi:79,name:'G5',time:12.5,duration:.8,velocity:.67}
]
const project={
 format:'melorix-project',version:1,name:'H3 MP4 WAV visual + A/V parity',tempo:120,
 parts:[
  {id:3,name:'H3 Left Bass',instrument:'Synth Bass',channel:1,enabled:true,color:'#22aacc',noteCount:0},
  {id:9,name:'H3 Right Bell',instrument:'Music Box',channel:2,enabled:true,color:'#cc8822',noteCount:0}
 ],
 notes:fixtureNotes,programs:{3:38,9:10},presets:{3:'synth-bass',9:'music-box'},
 volumes:{3:84,9:82},pans:{3:-65,9:65},
 pedal:{3:[],9:[{time:7.1,value:127},{time:10.3,value:0}]},
 fx:{3:{enabled:true,bassDb:5,midDb:-2,trebleDb:2,reverbWet:20,roomMs:900},
     9:{enabled:true,bassDb:0,midDb:1,trebleDb:2,reverbWet:17,roomMs:750}},
 performance:{},pianoFeel:{},expression:'original'
}
function ffprobe(path,extra=[]){
 return JSON.parse(execFileSync('ffprobe',['-v','error',...extra,'-of','json',path],{encoding:'utf8',timeout:60000}))
}
function decodeStereo(path){
 const seconds=14
 const bytes=execFileSync('ffmpeg',['-v','error','-i',path,'-t',String(seconds),
  '-ar',String(rate),'-ac','2','-f','s16le','-'],{timeout:60000,maxBuffer:4*1024*1024})
 const data=new Int16Array(bytes.length/2)
 for(let i=0;i<data.length;i++)data[i]=bytes.readInt16LE(i*2)
 return data
}
function rmsWindow(data,start,duration,channel=-1){
 const startFrame=Math.max(0,Math.round(start*rate)),endFrame=Math.min(data.length/2,Math.round((start+duration)*rate))
 let sum=0,count=0
 for(let f=startFrame;f<endFrame;f++){
  const l=data[f*2]/32768, r=data[f*2+1]/32768
  const v=channel===0?l:channel===1?r:(l+r)*.5
  sum+=v*v;count++
 }
 return Math.sqrt(sum/Math.max(1,count))
}
function correlation(a,b){
 const n=Math.min(a.length,b.length)
 let ma=0,mb=0
 for(let i=0;i<n;i++){ma+=a[i];mb+=b[i]}
 ma/=n;mb/=n
 let num=0,da=0,db=0
 for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;num+=x*y;da+=x*x;db+=y*y}
 return num/Math.sqrt(Math.max(1e-20,da*db))
}
function envelope(data){
 const buckets=[]
 for(let t=0.1;t<13.2;t+=.1)buckets.push(rmsWindow(data,t,.1))
 return buckets
}
function frameAt(path,second){
 const image=execFileSync('ffmpeg',['-v','error','-i',path,'-ss',String(second),'-frames:v','1',
   '-vf','scale=96:54,format=gray','-f','rawvideo','-'],{timeout:60000,maxBuffer:1024*1024})
 assert.equal(image.length,96*54,'Decoded frame dimensions must match')
 return image
}
function pixelDifference(a,b){
 let sum=0,count=0
 for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);sum+=delta;if(delta>=8)count++}
 return {mean:sum/a.length,changedPixels:count}
}
try{
 let ready=false
 for(let i=0;i<120;i++){
  try{if((await fetch(host)).ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,400))
 }
 assert.ok(ready,'Vite preview did not start')
 browser=await chromium.launch({executablePath:chrome,headless:true,
  args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']})
 const page=await browser.newPage({viewport:{width:1600,height:950},acceptDownloads:true})
 page.setDefaultTimeout(30000)
 const errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.addInitScript(()=>{try{delete window.showSaveFilePicker}catch{}})
 await page.goto(host,{waitUntil:'domcontentloaded'})
 await page.locator('.mx-track-side-item').first().waitFor({timeout:35000})
 await page.locator('input[accept=".melorix,application/json"]').setInputFiles({
  name:'h3-av-visual.melorix',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))
 })
 await page.waitForFunction(()=>document.body.innerText.includes('Đã mở dự án MELORIX'),null,{timeout:20000})
 const menu=page.locator('.mx-menu details').first()
 await menu.evaluate(element=>element.open=true)
 const wavPromise=page.waitForEvent('download',{timeout:120000})
 await page.getByRole('button',{name:'Xuất WAV bản phối (FX)'}).click()
 const wavDownload=await wavPromise
 const wavPath=await wavDownload.path()
 assert.equal(readFileSync(wavPath).toString('ascii',0,4),'RIFF','WAV export must be a real WAV')

 await menu.evaluate(element=>element.open=true)
 await page.getByRole('button',{name:'Xuất video MP4'}).click()
 const modal=page.locator('.modal-open')
 await modal.waitFor()
 await modal.locator('button').filter({hasText:'1920 × 1080'}).click()
 await modal.locator('select:has(option[value="full"])').selectOption('full')
 await page.evaluate(()=>{try{Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:4})}catch{}})
 const mp4Promise=page.waitForEvent('download',{timeout:12*60*1000})
 await modal.locator('button:has(i.fa-download)').click()
 const mp4Download=await mp4Promise
 const mp4Path=await mp4Download.path()
 const mp4Bytes=readFileSync(mp4Path)
 assert.equal(mp4Bytes.toString('ascii',4,8),'ftyp','MP4 export must be a real MP4')

 const media=ffprobe(mp4Path,['-show_streams','-show_format'])
 const video=media.streams.find(stream=>stream.codec_type==='video')
 const audio=media.streams.find(stream=>stream.codec_type==='audio')
 assert.ok(video&&audio,'MP4 must contain both video and audio')
 assert.equal(video.codec_name,'h264');assert.equal(audio.codec_name,'aac')
 assert.equal(video.width,1920);assert.equal(video.height,1080)
 const fps=Number(video.avg_frame_rate.split('/')[0])/Number(video.avg_frame_rate.split('/')[1])
 assert.equal(fps,30,'MP4 must retain 30fps')
 const videoSeconds=Number(video.duration??media.format.duration)
 const audioSeconds=Number(audio.duration??media.format.duration)
 assert.ok(videoSeconds>13&&videoSeconds<14.5,'Fixture MP4 must contain the entire song')
 assert.ok(Math.abs(videoSeconds-audioSeconds)<.26,'A/V media duration drift > 260ms')
 const framesRead=ffprobe(mp4Path,['-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames'])
 const actualFrameCount=Number(framesRead.streams?.[0]?.nb_read_frames)
 assert.ok(actualFrameCount>=380,'MP4 video is truncated or has missing frames')

 const times=[.25,1.25,3.6,7.65,10.0,12.9]
 const frames=times.map(second=>frameAt(mp4Path,second))
 const visualPairs=frames.slice(1).map((frame,i)=>pixelDifference(frames[i],frame))
 assert.ok(visualPairs.filter(x=>x.mean>.35&&x.changedPixels>15).length>=3,
   'Decoded MP4 frames appear frozen, or falling notes/keyboard are missing')

 const wavPcm=decodeStereo(wavPath),mp4Pcm=decodeStereo(mp4Path)
 const wavEnvelope=envelope(wavPcm),mp4Envelope=envelope(mp4Pcm)
 const shifts=[-2,-1,0,1,2].map(shift=>{
  const pairs=wavEnvelope.map((x,i)=>({x,y:mp4Envelope[i+shift]}))
   .filter(p=>p.y!==undefined)
  return {shift,corr:correlation(pairs.map(p=>p.x),pairs.map(p=>p.y))}
 }).sort((x,y)=>y.corr-x.corr)
 assert.ok(shifts[0].corr>.85,'MP4 AAC envelope disagrees with WAV mix (velocity/pedal/track FX regression)')
 assert.ok(Math.abs(shifts[0].shift)<=2,'Encoded MP4 offset >200ms relative to WAV')
 const baselinePeak=Math.max(...wavEnvelope)
 const mp4Peak=Math.max(...mp4Envelope)
 assert.ok(baselinePeak>.004&&mp4Peak>.004,'Audio is silent or almost silent')
 const leftBass=rmsWindow(mp4Pcm,.5,.35,0),rightBass=rmsWindow(mp4Pcm,.5,.35,1)
 const leftBell=rmsWindow(mp4Pcm,7.25,.4,0),rightBell=rmsWindow(mp4Pcm,7.25,.4,1)
 assert.ok(leftBass>rightBass*1.05,'Bass track pan-left lost in MP4')
 assert.ok(rightBell>leftBell*1.05,'Bell track pan-right lost in MP4')
 const firstLoud=mp4Envelope.findIndex(x=>x>mp4Peak*.06)
 const onsetSeconds=firstLoud<0?-1:.1+firstLoud*.1
 assert.ok(onsetSeconds>=.2&&onsetSeconds<1.0,'AAC first note onset differs from MIDI timing')

 assert.deepEqual(errors,[],'JavaScript errors during MP4/WAV export')
 console.log('PASS Chromium MELORIX Stage H.3 MP4/WAV/falling-note A/V QA',JSON.stringify({
  codecs:[video.codec_name,audio.codec_name],resolution:[video.width,video.height],fps,
  videoSeconds,audioSeconds,driftMs:Math.round(Math.abs(videoSeconds-audioSeconds)*1000),
  actualFrameCount,visualPairs,mp4WavEnvelopeCorrelation:shifts[0],
  mp4Peak,onsetSeconds,pan:{bass:[leftBass,rightBass],bell:[leftBell,rightBell]},
  mp4Bytes:mp4Bytes.length
 }))
}finally{
 try{await browser?.close()}catch{}
 server.kill('SIGTERM')
}
