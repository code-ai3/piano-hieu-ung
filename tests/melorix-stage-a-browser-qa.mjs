import {chromium} from 'playwright-core'
import midiModule from '@tonejs/midi'
const {Midi}=midiModule
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
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
  const createPan=AudioContext.prototype.createStereoPanner
  AudioContext.prototype.createStereoPanner=function(...args){
   const node=createPan.apply(this,args)
   panNodes.push(node)
   return node
  }
  window.__audioQA={taps,panNodes,peak:()=>Math.max(0,...taps.map(({analyser})=>{
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
 assert.ok(nextInfo.transport?.some(icon=>icon?.includes('fa-pause')),'Next should already be playing at the captured playback checkpoint')
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
 console.log('PASS Chromium MELORIX Stage B: UI track Inspector, Velocity edit, A/B, apply MIDI, Undo/Redo, CC64')
 console.log('PASS Chromium MELORIX Stage A: actual nonzero WebAudio PCM; speaker, MIDI Play, Pause, Stop, restart and Next')
}finally{await browser?.close();server.kill('SIGTERM')}
