import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {unlockWebAudio} from '../src/util/melorix-web-audio-unlock.ts'

let calls=0
const active={state:'running',resume:async()=>{calls++}}
await unlockWebAudio(active,15)
assert.equal(calls,0,'already-running context must not be resumed again')

const pending={state:'suspended',resume:()=>new Promise(()=>{})}
await assert.rejects(()=>unlockWebAudio(pending,15),/Trình duyệt chưa cho phép phát âm thanh/)
const resumed={state:'suspended',async resume(){this.state='running'}}
await unlockWebAudio(resumed,100)
assert.equal(resumed.state,'running')
await assert.rejects(()=>unlockWebAudio({state:'closed',resume:async()=>{}},10),/đã đóng/)

const view=readFileSync('src/views/PianoView.vue','utf8')
assert.ok(view.includes('await unlockWebAudio(ctx)'), 'all Web Audio entrypoints need an unblockable resume')
assert.ok(view.includes('if(hasNativeVst3Scanner)void play()'),'retain desktop auto play only')
assert.ok(view.includes('gmAudioNotice.value=\'MIDI đã sẵn sàng.'),'browser explains how to start playback')
assert.ok(view.includes('aria-label="Thử loa và bật âm thanh web"'),'show speaker check on main transport')
assert.ok(view.includes('engine.play(pianoTest,72,115,ctx.currentTime+.9,.65,id)'),'speaker test must exercise same per-track output routing')
assert.ok(view.includes('gmEngine?.stop();gmEngine=null'),'GM context cleanup must remain in Reset')
assert.ok(view.includes('preloadGmForEnabledTracks()'),'preload/fallback retained')
console.log('PASS MELORIX browser audio: no infinite autoplay hang, manual resume, transport speaker test, retain MIDI mixer')
