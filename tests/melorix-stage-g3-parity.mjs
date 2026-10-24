import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {GM_SOUNDFONT_NAMES} from '../src/util/melorix-gm-audio.ts'
const expected=[[1,'bright_acoustic_piano'],[25,'acoustic_guitar_steel'],[33,'electric_bass_finger'],[40,'violin'],[48,'string_ensemble_1']]
for(const [program,key] of expected)assert.equal(GM_SOUNDFONT_NAMES[program],key)
const vue=readFileSync('src/views/PianoView.vue','utf8')
assert.ok(vue.includes('async function ensureGmReadyForPlayback('))
assert.ok(vue.includes('await ensureGmReadyForPlayback(ctx,request)'))
assert.ok(vue.includes('engine.whenReady(voice,part.id)'))
assert.ok(vue.includes('if(request!==playRequest)return'))
const flow=readFileSync('.github/workflows/melorix-web-qa.yml','utf8')
assert.ok(flow.includes('feature/melorix-g3-multi-instrument-parity'))
assert.ok(flow.includes('tests/melorix-stage-g3-browser-qa.mjs'))
console.log('PASS MELORIX G.3 GM sampled playback readiness and five representative program mappings')
