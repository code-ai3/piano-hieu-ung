import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
import {chromium} from 'playwright-core'
const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync)
assert.ok(executablePath,'Chromium required to verify sample provenance on real export')
const host='http://127.0.0.1:4178'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4178'],{stdio:'ignore'})
let browser
try{
 let started=false
 for(let k=0;k<100;k++){
  try{if((await fetch(host)).ok){started=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,350))
 }
 assert.ok(started,'Preview startup')
 browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']})
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:900}})
 await page.goto(host,{waitUntil:'domcontentloaded'})
 await page.locator('.mx-track-side-item').first().waitFor({timeout:30000})
 const input=page.locator('input[accept=".melorix,application/json"]')
 const fileMenu=page.locator('.mx-menu details').first()
 const downloads=[]
 page.on('download',d=>downloads.push(d.suggestedFilename()))
 const project=(preset,program=40)=>({
  format:'melorix-project',version:1,name:'G1 source check',tempo:120,
  parts:[{id:3,name:'Track Source',instrument:'Violin',channel:1,noteCount:1,enabled:true,color:'#aaccdd'}],
  notes:[{trackId:3,midi:60,name:'C4',time:.08,duration:.62,velocity:.78}],
  programs:{3:program},presets:{3:preset},volumes:{3:85},pans:{3:0},
  pedal:{3:[]},fx:{},performance:{},pianoFeel:{},expression:'natural'
 })
 async function load(p){
  await input.setInputFiles({name:'G1.melorix',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))})
  await page.waitForFunction(()=>document.body.innerText.includes('Đã mở dự án MELORIX'),null,{timeout:10000})
 }
 async function tryWav(message){
  await fileMenu.evaluate(el=>{el.open=true})
  await page.getByRole('button',{name:/Xuất WAV bản phối/}).click()
  await page.waitForFunction((m)=>document.body.innerText.includes(m),message,{timeout:22000})
  assert.equal(downloads.length,0,'Failure must not deliver a different-sounding WAV')
 }
 // External library sample is missing. It must not be silently replaced by GM.
 await load(project('user:not-installed'))
 await tryWav('Thiếu mẫu WAV')
 // Network-offline GM sample must not silently become an oscillator.
 await page.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(url.hostname==='127.0.0.1')return route.continue()
  return route.abort('blockedbyclient')
 })
 await load(project('library:violin'))
 await tryWav('Không nạp được SoundFont')
 console.log('PASS Chromium MELORIX G.1: missing user WAV / remote GM cannot silently become fallback export')
}finally{
 try{await browser?.close()}catch{}
 server.kill('SIGTERM')
}
