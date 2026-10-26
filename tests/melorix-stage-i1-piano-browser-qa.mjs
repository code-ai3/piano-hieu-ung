// MELORIX Stage I.1 – real Chromium interaction for docked Piano Roll navigation.
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync)
assert.ok(chrome,'Chrome required for browser UI QA')
const host='http://127.0.0.1:4189'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4189'],{stdio:'ignore'})
let browser
try{
 let ready=false
 for(let n=0;n<110;n++){
  try{if((await fetch(host)).ok){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,350))
 }
 assert.ok(ready,'I.1 Vite preview unavailable')
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']})
 const page=await browser.newPage({viewport:{width:1366,height:840}})
 const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(host,{waitUntil:'domcontentloaded'})
 await page.locator('.mx-track-side-item').first().waitFor({timeout:30000})
 const project={
  format:'melorix-project',version:1,name:'I1 navigation QA',tempo:120,
  parts:[
   {id:3,name:'I1 Piano RH',instrument:'Piano',channel:1,enabled:true,color:'#ff954d',noteCount:0},
   {id:4,name:'I1 Piano LH',instrument:'Piano',channel:2,enabled:true,color:'#41add1',noteCount:0}
  ],
  notes:[
   {trackId:3,midi:60,name:'C4',time:1,duration:.5,velocity:.9},
   {trackId:3,midi:72,name:'C5',time:96,duration:1,velocity:.8},
   {trackId:3,midi:76,name:'E5',time:179,duration:.5,velocity:.7},
   {trackId:4,midi:48,name:'C3',time:1,duration:1,velocity:.6}
  ],
  programs:{3:0,4:0},presets:{3:'piano',4:'piano'},
  volumes:{3:85,4:80},pans:{3:0,4:0},pedal:{3:[],4:[]},
  fx:{},performance:{},pianoFeel:{},expression:'original'
 }
 await page.locator('input[accept=".melorix,application/json"]').setInputFiles({
  name:'i1-navigation.melorix',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))
 })
 await page.waitForFunction(()=>document.body.innerText.includes('Đã mở dự án MELORIX'),null,{timeout:15000})
 await page.getByRole('button',{name:'Chọn track I1 Piano RH'}).dblclick()
 await page.locator('.mx-roll').waitFor()
 const slider=page.getByRole('slider',{name:'Zoom Piano Roll'})
 const initial=Number(await slider.inputValue())
 assert.equal(initial,40,'I1 must preserve established zoom default')
 const count=await page.locator('.mx-roll-note').count()
 assert.equal(count,3,'right-hand track must show its three notes only')
 await page.getByRole('button',{name:'Vừa toàn bài'}).click()
 const whole=Number(await slider.inputValue())
 assert.ok(whole>=1&&whole<10,'180-second track should fit in overview')
 const scroll=page.locator('.mx-roll-scroll')
 assert.equal(await scroll.evaluate(el=>el.scrollLeft),0,'fit song must start at the beginning')
 await page.getByRole('button',{name:'Phóng to Piano Roll'}).click()
 const zoomIn=Number(await slider.inputValue())
 assert.ok(zoomIn>whole,'zoom in must increase px/s')
 await page.getByRole('button',{name:'Thu nhỏ Piano Roll'}).click()
 assert.ok(Number(await slider.inputValue())<=zoomIn,'zoom out should not increase zoom')
 await page.locator('.mx-roll-note').first().click()
 await page.getByRole('button',{name:'Vừa vùng chọn'}).click()
 assert.ok(Number(await slider.inputValue())>40,'short selected MIDI note must zoom to editable range')
 const trackNotes=await page.locator('.mx-roll-note').count()
 assert.equal(trackNotes,count,'navigation must not add/remove MIDI notes')
 await page.getByRole('button',{name:'Tới Playhead'}).click()
 assert.equal(await page.getByRole('button',{name:'Theo Playhead'}).getAttribute('aria-pressed'),'true')
 await page.getByRole('button',{name:'Theo Playhead'}).click()
 assert.equal(await page.getByRole('button',{name:'Theo Playhead'}).getAttribute('aria-pressed'),'false')
 await page.getByRole('button',{name:'Chọn track I1 Piano LH'}).dblclick()
 assert.equal(await page.locator('.mx-roll-note').count(),1,'other track must not be modified')
 assert.deepEqual(errors,[],'No JavaScript errors during Piano Roll navigation')
 console.log('PASS Chromium MELORIX Stage I.1: whole-song fit, selection fit, zoom, playhead and per-track isolation')
} finally {
 try{await browser?.close()}catch{}
 server.kill('SIGTERM')
}
