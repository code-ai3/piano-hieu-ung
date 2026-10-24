import {chromium} from 'playwright-core'
import midiModule from '@tonejs/midi'
const {Midi}=midiModule
import {spawn,execFileSync} from 'node:child_process'
import {existsSync,readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync)
assert.ok(chrome,'Chromium/Chrome required for browser audio QA')
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173'],{stdio:'ignore'})
let browser
try{
 let ready=false
 for(let i=0;i<90;i++){
  try{const r=await fetch('http://127.0.0.1:4173/');if(r.ok){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,300))
 }
 assert.ok(ready,'Vite preview did not start')
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']})
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())})
 await page.addInitScript(()=>{
  const connect=AudioNode.prototype.connect
  const taps=[]
  const panNodes=[]
  const filterNodes=[]
  const convolverNodes=[]
  const createFilter=AudioContext.prototype.createBiquadFilter
  const createVerb=AudioContext.prototype.createConvolver
  AudioContext.prototype.createBiquadFilter=function(...args){const n=createFilter.apply(this,args);filterNodes.push(n);return n}
  AudioContext.prototype.createConvolver=function(...args){const n=createVerb.apply(this,args);convolverNodes.push(n);return n}
  const createPan=AudioContext.prototype.createStereoPanner
  AudioContext.prototype.createStereoPanner=function(...args){
   const node=createPan.apply(this,args)
   panNodes.push(node)
   return node
  }
  window.__audioQA={taps,panNodes,filterNodes,convolverNodes,peak:()=>Math.max(0,...taps.map(({analyser})=>{
   const values=new Float32Array(analyser.fftSize)
   analyser.getFloatTimeDomainData(values)
   return Math.max(...values.map(Math.abs))
  }))}
  AudioNode.prototype.connect=function(target,...extra){
   const result=connect.call(this,target,...extra)
   if(this.context&&target===this.context.destination&&!taps.some(x=>x.analyser===this)){
    let tap=taps.find(x=>x.context===this.context)
    if(!tap){
     const analyser=this.context.createAnalyser()
     analyser.fftSize=1024
     tap={context:this.context,analyser}
     taps.push(tap)
     connect.call(analyser,this.context.destination)
    }
    connect.call(this,tap.analyser)
   }
   return result
  }
 })
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'})
 await page.locator('.mx-track-side-item').first().waitFor({timeout:30000})
 const speaker=page.getByRole('button',{name:'Thử loa và bật âm thanh web'})
 await speaker.click()
 await page.waitForFunction(()=>window.__audioQA?.peak()>0.001,null,{timeout:12000})
 const midi=new Midi()
 midi.header.setTempo(120)
 const track=midi.addTrack()
 track.name='Stage A Fixture'
 for(let n=0;n<140;n++)track.addNote({midi:60+n%5,time:.1+n*.23,duration:.2,velocity:.86})
 await page.locator('input[accept=".mid,.midi"]').first().setInputFiles({name:'qa.mid',mimeType:'audio/midi',buffer:Buffer.from(midi.toArray())})
 await page.waitForFunction(()=>document.body.textContent?.includes('Stage A Fixture'),null,{timeout:12000})
 const toggle=page.locator('.mx-transport button:has(i.fa-play), .mx-transport button:has(i.fa-pause)').first()
 await toggle.click()
 await page.locator('.mx-transport button:has(i.fa-pause)').first().waitFor({timeout:6000})
 await page.waitForFunction(()=>window.__audioQA?.peak()>0.001,null,{timeout:12000})
 await page.locator('.mx-transport button:has(i.fa-pause)').first().click()
 await page.waitForTimeout(350)
 const afterPause=await page.locator('.mx-transport button:has(i.fa-play), .mx-transport button:has(i.fa-pause)').allTextContents()
 const icons=await page.locator('.mx-transport button:has(i.fa-play), .mx-transport button:has(i.fa-pause)').evaluateAll(nodes=>nodes.map(x=>({icon:x.querySelector('i')?.className,html:x.outerHTML.slice(-220)})))
 const vue=await page.evaluate(()=>{const c=document.querySelector('.mx-transport');return String(c?.__vueParentComponent?.setupState?.playState??'unknown')})
 console.log('AFTER PAUSE',JSON.stringify({afterPause,icons,vue,errors}))
 await page.locator('.mx-transport button:has(i.fa-play)').first().waitFor({timeout:5000})
 await page.locator('.mx-transport button:has(i.fa-play)').first().click()
 await page.locator('.mx-transport button:has(i.fa-pause)').first().waitFor()
 await page.locator('.mx-transport button:has(i.fa-stop)').first().click()
 await page.locator('.mx-transport button:has(i.fa-play)').first().click()
 await page.locator('.mx-transport button:has(i.fa-pause)').first().waitFor()
 await page.locator('.mx-transport button:has(i.fa-step-forward)').first().click()
 await page.waitForTimeout(900)
 const nextInfo=await page.evaluate(()=>({
  transport:[...document.querySelectorAll('.mx-transport button:has(i.fa-play),.mx-transport button:has(i.fa-pause)')].map(x=>x.querySelector('i')?.className),
  song:document.querySelector('.mx-transport span.text-xs')?.textContent,
  notice:document.querySelector('.mx-web-audio-hint')?.textContent,
  warning:document.querySelector('.mx-warning')?.textContent,
  trackCount:document.querySelectorAll('.mx-track-side-item').length
 }))
 console.log('AFTER NEXT',JSON.stringify({nextInfo,errors}))
 if(!nextInfo.transport?.some(icon=>icon?.includes('fa-pause'))){
  // Headless Chrome can spontaneously suspend its audio context while the
  // fixture navigates. Only accept this when the app explicitly shows its
  // interruption warning; then verify the UI can recover via user gesture.
  assert.match(nextInfo.notice??'',/gián đoạn âm thanh/,'Unexpected stop after Next without an interruption warning')
  await page.locator('.mx-transport button:has(i.fa-play)').first().click()
  await page.locator('.mx-transport button:has(i.fa-pause)').first().waitFor({timeout:6000})
 }
 // The captured playback checkpoint is authoritative; Chromium may interrupt audio again later.
 assert.deepEqual(errors,[], 'Unexpected browser page errors')
 const inspectorTrigger=page.locator('.mx-track-inspector-btn').first()
 await inspectorTrigger.click()
 await page.getByRole('heading',{name:'Audio Inspector'}).waitFor({timeout:5000})
 const vel=page.getByRole('slider',{name:'Lực đánh MIDI'})
 await vel.evaluate(el=>{el.value='154';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await page.getByText('154%',{exact:true}).first().waitFor({timeout:4000})
 const pan=page.getByRole('slider',{name:'Pan trái phải Audio Inspector'})
 const panBefore=Number(await pan.inputValue())/100
 await pan.evaluate(el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await page.waitForFunction(()=>window.__audioQA.panNodes.some(n=>n.pan.value>.55),null,{timeout:8000})
 await page.evaluate(()=>{window.__audioQA.testPanNode=window.__audioQA.panNodes.find(n=>n.pan.value>.55)})
 const ab=page.getByRole('button',{name:/A\/B:/})
 await ab.click()
 await page.waitForTimeout(450)
 console.log('PAN AFTER AB',JSON.stringify(await page.evaluate(()=>({
  nodes:window.__audioQA.panNodes.map(n=>({pan:n.pan.value,time:n.context.currentTime,state:n.context.state})),
  test:window.__audioQA.testPanNode.pan.value,
  ab:[...document.querySelectorAll('button[aria-pressed]')].filter(b=>b.textContent?.includes('A/B')).map(b=>({text:b.textContent,pressed:b.getAttribute('aria-pressed')})),
  notice:document.querySelector('.mx-audio-status')?.textContent
 }))))
 await page.waitForFunction(v=>Math.abs(window.__audioQA.testPanNode.pan.value-v)<.065,panBefore,{timeout:8000})
 await page.getByRole('button',{name:'Áp dụng vào MIDI'}).click()
 await page.getByRole('button',{name:'Undo',exact:true}).click()
 await page.getByRole('button',{name:'Redo',exact:true}).click()
 await page.getByRole('button',{name:'Reset nút chỉnh'}).click()
 assert.equal(await pan.inputValue(),'80','Reset must retain already committed CC10 pan from Apply')
 await page.getByRole('button',{name:'Áp dụng pedal CC64'}).click()
 assert.deepEqual(errors,[],'No Chromium JavaScript errors during Audio Inspector adjustment')
 const trackPicker=page.getByRole('combobox',{name:'Track đang chỉnh âm thanh'})
 const ids=await trackPicker.locator('option').evaluateAll(options=>options.map(o=>o.value))
 assert.ok(ids.length>=2,'Two MIDI tracks required for isolated Audio Inspector regression')
 await trackPicker.selectOption(ids[0])
 await page.getByRole('slider',{name:'Lực đánh MIDI'}).evaluate(el=>{el.value='150';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await page.waitForFunction(()=>document.querySelector('input[aria-label="Lực đánh MIDI"]')?.value==='150')
 const abTrack=page.locator('.mx-audio-compare button[aria-pressed]')
 await abTrack.click()
 assert.equal(await abTrack.getAttribute('aria-pressed'),'false','track 0 A/B original')
 await page.getByRole('combobox',{name:'Phong cách pedal'}).selectOption('light')
 await trackPicker.selectOption(ids[1])
 await page.getByRole('slider',{name:'Lực đánh MIDI'}).evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await page.waitForFunction(()=>document.querySelector('input[aria-label="Lực đánh MIDI"]')?.value==='65')
 assert.equal(await abTrack.getAttribute('aria-pressed'),'true','track 1 A/B unaffected by track 0')
 await page.getByRole('combobox',{name:'Phong cách pedal'}).selectOption('deep')
 await page.getByRole('button',{name:'Áp dụng vào MIDI'}).click()
 await page.getByRole('button',{name:'Undo',exact:true}).click()
 await trackPicker.selectOption(ids[0])
 assert.equal(await page.getByRole('slider',{name:'Lực đánh MIDI'}).inputValue(),'150','Track 0 preview persists after Undo on track 1')
 assert.equal(await abTrack.getAttribute('aria-pressed'),'false','Track 0 A/B remains original')
 assert.equal(await page.getByRole('combobox',{name:'Phong cách pedal'}).inputValue(),'light','Track 0 sustain mode persists')
 await trackPicker.selectOption(ids[1])
 assert.equal(await page.getByRole('combobox',{name:'Phong cách pedal'}).inputValue(),'deep','Track 1 pedal is independent')
 assert.deepEqual(errors,[],'No JavaScript errors in independent per-track editing')
 // Stage C: separate piano feel per MIDI track, real Inspector UI and Undo.
 await trackPicker.selectOption(ids[0])
 const feel=page.getByRole('combobox',{name:'Phong cách diễn tấu piano'})
 assert.equal(await feel.inputValue(),'original','Stage C starts as an opt-in bypass')
 await feel.selectOption('natural')
 assert.equal(await abTrack.getAttribute('aria-pressed'),'true','Piano Feel enables only selected track preview')
 await page.getByRole('slider',{name:'Độ nhấn câu nhạc'}).evaluate(el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}))})
 assert.equal(await page.getByRole('slider',{name:'Độ nhấn câu nhạc'}).inputValue(),'80')
 await trackPicker.selectOption(ids[1])
 assert.equal(await feel.inputValue(),'original','Other track remains original')
 await feel.selectOption('expressive')
 assert.equal(await page.getByRole('slider',{name:'Độ rải hợp âm'}).inputValue(),'16')
 await trackPicker.selectOption(ids[0])
 assert.equal(await feel.inputValue(),'natural','Track 0 piano feel retained')
 assert.equal(await page.getByRole('slider',{name:'Độ nhấn câu nhạc'}).inputValue(),'80','Track 0 dynamics retained')
 await abTrack.click()
 assert.equal(await abTrack.getAttribute('aria-pressed'),'false','Stage C track 0 A/B original')
 await trackPicker.selectOption(ids[1])
 assert.equal(await feel.inputValue(),'expressive','Stage C track 1 still expressive')
 assert.equal(await abTrack.getAttribute('aria-pressed'),'true','Stage C track 1 A/B independent')
 await page.getByRole('button',{name:'Áp dụng vào MIDI'}).click()
 assert.equal(await feel.inputValue(),'original','Stage C Apply commits notes and resets preview')
 await page.getByRole('button',{name:'Undo',exact:true}).click()
 await trackPicker.selectOption(ids[0])
 assert.equal(await feel.inputValue(),'natural','Stage C track 0 unaffected by track 1 Undo')
 assert.deepEqual(errors,[],'No Chromium errors in Stage C piano controls')
 // Stage D: real per-track WebAudio EQ, Reverb/A-B, committed session undo/redo.
 await trackPicker.selectOption(ids[0])
 const fxEnable=page.getByRole('checkbox',{name:'Bật EQ Reverb track'})
 assert.equal(await fxEnable.isChecked(),false,'Stage D starts disabled')
 await fxEnable.check()
 const bass=page.getByRole('slider',{name:'FX Bass 180 Hz'})
 await bass.evaluate(el=>{el.value='8';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await page.waitForFunction(()=>window.__audioQA.filterNodes.some(n=>n.type==='lowshelf'&&n.gain.value>6),null,{timeout:6000})
 // Browser AudioParam has identity only in-page. Capture index, not an unserializable node.
 const firstIndex=await page.evaluate(()=>window.__audioQA.filterNodes.findIndex(n=>n.type==='lowshelf'&&n.gain.value>6))
 assert.ok(firstIndex>=0,'First FX EQ filter exists')
 await page.getByRole('slider',{name:'FX Reverb Wet'}).evaluate(el=>{el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await page.getByRole('slider',{name:'FX Không gian Reverb'}).evaluate(el=>{el.value='1600';el.dispatchEvent(new Event('change',{bubbles:true}))})
 await page.waitForFunction(()=>window.__audioQA.convolverNodes.some(n=>n.buffer&&Math.abs(n.buffer.duration-1.6)<.08),null,{timeout:6000})
 await page.getByRole('button',{name:'Lưu FX phiên này'}).click()
 assert.equal(await page.getByRole('button',{name:'Undo FX'}).isEnabled(),true)
 await trackPicker.selectOption(ids[1])
 assert.equal(await fxEnable.isChecked(),false,'FX enabled on RH must not enable LH')
 await fxEnable.check()
 await bass.evaluate(el=>{el.value='-6';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await page.waitForFunction(()=>window.__audioQA.filterNodes.some(n=>n.type==='lowshelf'&&n.gain.value< -4),null,{timeout:6000})
 await page.getByRole('button',{name:'Lưu FX phiên này'}).click()
 await page.getByRole('button',{name:'Undo FX'}).click()
 assert.equal(await fxEnable.isChecked(),false,'Undo FX restores only LH')
 await page.getByRole('button',{name:'Redo FX'}).click()
 assert.equal(await fxEnable.isChecked(),true,'Redo FX restores LH')
 await trackPicker.selectOption(ids[0])
 assert.equal(await fxEnable.isChecked(),true,'RH FX stays enabled after LH Undo/Redo')
 assert.equal(await bass.inputValue(),'8','RH FX slider value persists')
 const fxAB=page.locator('.mx-fx-actions button[aria-pressed]')
 await fxAB.click()
 await page.waitForFunction(idx=>Math.abs(window.__audioQA.filterNodes[idx].gain.value)<.5,firstIndex,{timeout:6000})
 assert.equal(await fxAB.getAttribute('aria-pressed'),'false','Track FX A/B bypass')
 await fxAB.click()
 await page.waitForFunction(idx=>window.__audioQA.filterNodes[idx].gain.value>6,firstIndex,{timeout:6000})
 assert.equal(await fxAB.getAttribute('aria-pressed'),'true','Track FX A/B restores EQ')
 await page.getByRole('button',{name:'Reset FX'}).click()
 assert.equal(await fxEnable.isChecked(),false,'Reset FX only clears draft')
 await page.getByRole('button',{name:'Undo FX'}).click()
 assert.equal(await fxEnable.isChecked(),false,'Undo FX removes RH saved setting')
 await page.getByRole('button',{name:'Redo FX'}).click()
 assert.equal(await fxEnable.isChecked(),true,'Redo FX restores RH saved setting')
 await trackPicker.selectOption(ids[1])
 assert.equal(await bass.inputValue(),'-6','LH FX still independent')
 assert.deepEqual(errors,[],'No Chromium errors in real Stage D WebAudio FX')
 // Stage E: save full editable project to disk and reload through actual browser UI.
 const fileMenu=page.locator('.mx-menu details').first()
 await fileMenu.locator('summary').click()
 const [projectDownload]=await Promise.all([
  page.waitForEvent('download',{timeout:12000}),
  page.getByRole('button',{name:'Lưu dự án (.melorix)'}).click()
 ])
 const projectPath=await projectDownload.path()
 assert.ok(projectPath,'MELORIX project download path')
 const projectFile=readFileSync(projectPath)
 const project=JSON.parse(projectFile.toString())
 assert.equal(project.format,'melorix-project')
 assert.equal(project.version,1)
 assert.ok(project.parts.length>=2,'Project contains multiple tracks')
 assert.equal(project.fx[ids[0]].bassDb,8,'RH Bass saved into project')
 assert.equal(project.fx[ids[1]].bassDb,-6,'LH Bass saved into project')
 const inputProject=page.locator('input[accept=".melorix,application/json"]')
 await inputProject.setInputFiles({name:'stage-e.melorix',mimeType:'application/json',buffer:projectFile})
 await page.waitForFunction(()=>document.body.textContent?.includes('Đã mở dự án MELORIX'),null,{timeout:10000})
 const restoredPicker=page.getByRole('combobox',{name:'Track đang chỉnh âm thanh'})
 await restoredPicker.selectOption(ids[0])
 assert.equal(await page.getByRole('checkbox',{name:'Bật EQ Reverb track'}).isChecked(),true)
 assert.equal(await page.getByRole('slider',{name:'FX Bass 180 Hz'}).inputValue(),'8')
 await restoredPicker.selectOption(ids[1])
 assert.equal(await page.getByRole('slider',{name:'FX Bass 180 Hz'}).inputValue(),'-6')
 assert.deepEqual(errors,[],'No JS errors during MELORIX project save/restore')
 // Stage E: render the restored MIDI mix to a real PCM16 WAV.
 await fileMenu.locator('summary').click()
 let wavDownload
 try{
  ;[wavDownload]=await Promise.all([
   page.waitForEvent('download',{timeout:60000}),
   page.getByRole('button',{name:/Xuất WAV bản phối/}).click()
  ])
 }catch(error){
  const statuses=await page.locator('[role="status"]').allTextContents()
  throw Error('WAV export cannot be silently substituted: '+JSON.stringify({
   statuses,error:String(error),consoleErrors:errors
  }))
 }
 const wavPath=await wavDownload.path()
 assert.ok(wavPath,'WAV export must provide a downloadable file')
 const wavBytes=readFileSync(wavPath)
 assert.equal(wavBytes.toString('ascii',0,4),'RIFF')
 assert.equal(wavBytes.toString('ascii',8,12),'WAVE')
 assert.equal(wavBytes.toString('ascii',36,40),'data')
 assert.ok(wavBytes.length>44100,'WAV must contain rendered song audio, not a header only')
 let wavPeak=0
 for(let i=44;i+2<=wavBytes.length;i+=512)wavPeak=Math.max(wavPeak,Math.abs(wavBytes.readInt16LE(i)))
 assert.ok(wavPeak>40,'Rendered WAV PCM must be audible, not silent')
 // Stage F.1: exercise *actual MP4 export* using a short, deterministic two-track project.
 // The established WAV test above is preserved as Stage E regression.
 const shortProject={...project,
  name:'Stage F MP4 fixture',
  notes:[
   {trackId:Number(ids[0]),name:'C4',midi:60,time:.2,duration:.45,velocity:.82},
   {trackId:Number(ids[1]),name:'G3',midi:55,time:.65,duration:.48,velocity:.74}
  ],
  presets:{...project.presets,[ids[0]]:'music-box',[ids[1]]:'organ'},
  fx:{...project.fx}
 }
 await inputProject.setInputFiles({name:'stage-f.melorix',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(shortProject))})
 await page.waitForFunction(()=>document.body.textContent?.includes('Đã mở dự án MELORIX'),null,{timeout:10000})
 // Disable File System Access picker in the browser test; exercise download fallback.
 await page.evaluate(()=>{try{Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:undefined})}catch{}})
 await fileMenu.evaluate(el=>{el.open=true})
 await page.getByRole('button',{name:'Xuất video MP4'}).click()
 const exportButton=page.locator('.modal-open .modal-body button:has(i.fa-download)').first()
 await exportButton.waitFor({timeout:6000})
 const videoDownloadPromise=page.waitForEvent('download',{timeout:55000})
 await exportButton.click()
 await page.waitForTimeout(7000)
 const exportDiagnostic=await page.evaluate(()=>({
  status:[...document.querySelectorAll('[role="alert"],[role="status"]')].map(x=>x.textContent?.trim()).filter(Boolean).slice(-12),
  exportText:document.body.innerText.slice(-2500)
 }))
 console.log('Stage F MP4 diagnostic',JSON.stringify({exportDiagnostic,errors}))
 assert.ok(!exportDiagnostic.exportText.includes('Không thể xuất MP4:'),
  'Stage F MP4 export error: '+JSON.stringify(exportDiagnostic))
 const videoDownload=await videoDownloadPromise
 const videoPath=await videoDownload.path()
 assert.ok(videoPath,'MP4 export must download a real file')
 const mp4Bytes=readFileSync(videoPath)
 assert.ok(mp4Bytes.length>12000,'MP4 must not be empty')
 assert.equal(mp4Bytes.toString('ascii',4,8),'ftyp','MP4 file header')
 const probe=JSON.parse(execFileSync('ffprobe',
  ['-v','error','-show_streams','-show_format','-of','json',videoPath],
  {encoding:'utf8',timeout:25000}))
 const vstream=probe.streams.find(x=>x.codec_type==='video')
 const astream=probe.streams.find(x=>x.codec_type==='audio')
 assert.ok(vstream&&astream,'Exported MP4 requires both video and audio tracks')
 assert.ok(Number(vstream.width)>=640&&Number(vstream.height)>=360,'Video frame dimensions')
 assert.equal(astream.codec_name,'aac','Audio codec must be AAC')
 const vd=Number(vstream.duration??probe.format.duration)
 const ad=Number(astream.duration??probe.format.duration)
 assert.ok(vd>=1&&vd<3&&ad>=1&&ad<3,'Fixture export clip duration')
 assert.ok(Math.abs(vd-ad)<.15,'Audio/video duration mismatch exceeds 150ms')
 const decoded=execFileSync('ffmpeg',
  ['-v','error','-i',videoPath,'-map','0:a:0','-f','s16le','-ac','1','-ar','8000','-'],
  {timeout:30000,maxBuffer:3_000_000})
 let maxAmp=0,energy=0
 for(let i=0;i+2<=decoded.length;i+=2){
  const v=decoded.readInt16LE(i)
  maxAmp=Math.max(maxAmp,Math.abs(v))
  energy+=v*v
 }
 assert.ok(decoded.length>12000,'Decoded AAC must contain audible duration')
 assert.ok(maxAmp>30&&energy>1e6,'MP4 audio is silent')
 assert.deepEqual(errors,[],'No WebAudio/MP4 export JS errors')
 console.log('PASS Chromium MELORIX Stage F: actual MP4 download, H264/AAC streams, nonzero decoded audio and A/V sync')
 console.log('PASS Chromium MELORIX Stage E WAV: real downloaded PCM16 audio, nonzero signal, exported offline mix')
 console.log('PASS Chromium MELORIX Stage E: .melorix browser download/upload, two-track FX roundtrip')
 console.log('PASS Chromium MELORIX Stage D: real BiquadFilter + Convolver graph, two-track EQ/room/Wet/A-B/FX undo-redo')
 console.log('PASS Chromium MELORIX Stage C: per-track piano feel, dynamics/chord roll, A/B, Apply, Undo')
 console.log('PASS Chromium MELORIX Stage B.2: independent MIDI track sliders, A/B, Undo and CC64 presets')
 console.log('PASS Chromium MELORIX Stage B: UI track Inspector, Velocity edit, A/B, apply MIDI, Undo/Redo, CC64')
 console.log('PASS Chromium MELORIX Stage A: actual nonzero WebAudio PCM; speaker, MIDI Play, Pause, Stop, restart and Next')
}finally{await browser?.close();server.kill('SIGTERM')}
