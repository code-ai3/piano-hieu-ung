import {chromium} from 'playwright-core'
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
  window.__audioQA={taps,peak:()=>Math.max(0,...taps.map(({analyser})=>{
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
 await page.locator('.mx-transport button:has(i.fa-pause)').first().waitFor({timeout:9000})
 assert.deepEqual(errors,[], 'Unexpected browser page errors')
 console.log('PASS Chromium MELORIX Stage A: actual nonzero WebAudio PCM; speaker, MIDI Play, Pause, Stop, restart and Next')
}finally{await browser?.close();server.kill('SIGTERM')}
