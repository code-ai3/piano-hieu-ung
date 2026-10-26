// MELORIX I.2 – edit *real* notes in Chromium, not mocked Vue internals.
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync)
assert.ok(chrome,'Chromium is required for I.2 QA')
const host='http://127.0.0.1:4191'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4191'],{stdio:'ignore'})
let browser
const notes=[
 {trackId:3,midi:60,name:'C4',time:1,duration:.5,velocity:.8},
 {trackId:3,midi:64,name:'E4',time:2,duration:.5,velocity:.7},
 {trackId:3,midi:67,name:'G4',time:4,duration:.5,velocity:.65},
 {trackId:4,midi:48,name:'C3',time:1,duration:1,velocity:.6}
]
function width(l){return l.evaluate(e=>parseFloat(e.style.width))}
function left(l){return l.evaluate(e=>parseFloat(e.style.left))}
try{
 let ready=false
 for(let i=0;i<120;i++){
  try{if((await fetch(host)).ok){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,350))
 }
 assert.ok(ready,'Vite preview not reachable')
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']})
 const page=await browser.newPage({viewport:{width:1440,height:970}})
 page.setDefaultTimeout(30000)
 const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(host,{waitUntil:'domcontentloaded'})
 await page.locator('.mx-track-side-item').first().waitFor()
 const project={format:'melorix-project',version:1,name:'I2 group edits QA',tempo:120,
  parts:[
   {id:3,name:'I2 Piano RH',instrument:'Piano',channel:1,enabled:true,color:'#ff954d',noteCount:0},
   {id:4,name:'I2 Piano LH',instrument:'Piano',channel:2,enabled:true,color:'#49adc7',noteCount:0}
  ],notes,programs:{3:0,4:0},presets:{3:'piano',4:'piano'},
  volumes:{3:90,4:85},pans:{3:0,4:0},pedal:{3:[],4:[]},fx:{},
  performance:{},pianoFeel:{},expression:'original'}
 await page.locator('input[accept=".melorix,application/json"]').setInputFiles({
  name:'i2-group-edit.melorix',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))
 })
 await page.waitForFunction(()=>document.body.innerText.includes('Đã mở dự án MELORIX'))
 await page.getByRole('button',{name:'Chọn track I2 Piano RH'}).dblclick()
 await page.locator('.mx-roll').waitFor()
 const row=page.locator('.mx-roll-note')
 assert.equal(await row.count(),3)
 await page.getByRole('button',{name:'Chọn',exact:true}).click()
 const selectPair=async()=>{
  await row.first().click()
  await row.nth(1).click({modifiers:['Shift']})
  assert.equal(await page.locator('.mx-roll-note.selected').count(),2,'Shift+click must select two notes')
 }
 await selectPair()
 // Group duration: right-edge handle on SECOND selected note grows BOTH notes.
 const w0=await width(row.first()),w1=await width(row.nth(1)),w2=await width(row.nth(2))
 const box=await row.nth(1).locator('.mx-roll-resize').boundingBox()
 assert.ok(box,'second note must expose resize handle')
 const x=box.x+box.width*.5,y=box.y+box.height*.5
 await page.mouse.move(x,y);await page.mouse.down()
 await page.mouse.move(x+40,y,{steps:8});await page.mouse.up()
 const dw0=(await width(row.first()))-w0,dw1=(await width(row.nth(1)))-w1
 assert.ok(dw0>20&&dw1>20,'resize a selected edge must change BOTH durations')
 assert.ok(Math.abs(dw0-dw1)<2,'group resize must add same duration delta')
 assert.equal(await width(row.nth(2)),w2,'unselected third note must keep duration')
 await page.locator('.mx-roll').focus()
 await page.keyboard.press('Control+z')
 assert.equal(await width(row.first()),w0,'Undo group resize must restore first note')
 assert.equal(await width(row.nth(1)),w1,'Undo group resize must restore second note')
 await page.keyboard.press('Control+y')
 assert.ok(await width(row.first())>w0,'Redo group resize must restore extended duration')
 await page.keyboard.press('Control+z')
 await selectPair()
 // Alt+drag copies both selected notes, leaving original notes intact.
 const ox=await left(row.first()),oy=(await row.first().boundingBox())
 assert.ok(oy)
 await page.getByRole('button',{name:'Kéo để sao chép'}).click()
 assert.equal(await page.getByRole('button',{name:'Kéo để sao chép'}).getAttribute('aria-pressed'),'true')
 await page.mouse.move(oy.x+11,oy.y+oy.height*.5)
 await page.mouse.down()
 await page.mouse.move(oy.x+94,oy.y+oy.height*.5,{steps:12})
 await page.mouse.up()
 await page.getByRole('button',{name:'Kéo để sao chép'}).click()
 assert.equal(await page.getByRole('button',{name:'Kéo để sao chép'}).getAttribute('aria-pressed'),'false')
 assert.equal(await row.count(),5,'Copy-drag must copy exactly 2 notes')
 assert.equal(await left(row.first()),ox,'original MIDI note must remain in place')
 await page.locator('.mx-roll').focus();await page.keyboard.press('Control+z')
 assert.equal(await row.count(),3,'Undo Copy-drag must remove duplicate group')
 await page.keyboard.press('Control+y')
 assert.equal(await row.count(),5,'Redo Copy-drag must recreate two notes')
 await page.keyboard.press('Control+z')
 // Arrow navigation: selected pair moves one snap division together.
 await selectPair()
 const firstX=await left(row.first()),secondX=await left(row.nth(1)),thirdX=await left(row.nth(2))
 await page.locator('.mx-roll').focus()
 await page.keyboard.press('ArrowRight')
 assert.ok((await left(row.first()))>firstX)
 assert.equal(Math.round((await left(row.first()))-firstX),Math.round((await left(row.nth(1)))-secondX))
 assert.equal(await left(row.nth(2)),thirdX,'not-selected note must remain unmoved')
 await page.keyboard.press('Control+z')
 assert.equal(await left(row.first()),firstX)
 await page.getByRole('button',{name:'Chọn track I2 Piano LH'}).dblclick()
 assert.equal(await row.count(),1,'group editing must not touch another track')
 assert.deepEqual(errors,[],'No browser errors during editor group operations')
 console.log('PASS Chromium MELORIX I.2: multiselect, group resize, copy-drag, undo/redo, arrow nudge and track isolation')
}finally{
 try{await browser?.close()}catch{}
 server.kill('SIGTERM')
}
