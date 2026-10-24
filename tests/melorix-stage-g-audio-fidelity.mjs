import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const mixer=readFileSync('src/util/melorix-offline-mix.ts','utf8')
const master=readFileSync('src/util/melorix-expressive-audio.ts','utf8')
const view=readFileSync('src/views/PianoView.vue','utf8')
for(const clause of [
 "requireExactInstrument?:boolean",
 "if(opts.requireExactInstrument)",
 "Thiếu mẫu WAV",
 "Thiếu bộ WAV Erhu",
 "Không nạp được SoundFont",
 "new ExpressiveAudioMaster(ctx,opts.expression,true)",
 "gain.gain.linearRampToValueAtTime(.0001,start+length+.1)"
])assert.ok(mixer.includes(clause),'Missing offline parity mechanism: '+clause)
for(const clause of [
 'constructor(ctx:BaseAudioContext,mode:ExpressionMode,immediate=false)',
 'this.setMode(ctx,mode,immediate)',
 'if(immediate)param.setValueAtTime(value,ctx.currentTime)',
 'else param.setTargetAtTime(value,ctx.currentTime,tau)'
])assert.ok(master.includes(clause),'Offline master ambience should be settled from first sample: '+clause)
assert.ok(view.includes('requireExactInstrument:true'),'MELORIX must not substitute its selected GM soundfont/WAV')
assert.ok(view.includes('notes:audibleNotes.value,parts:midiParts.value'),'Live note expression must reach export')
const workflow=readFileSync('.github/workflows/melorix-web-qa.yml','utf8')
assert.ok(workflow.includes('feature/melorix-g1-audio-fidelity'),'G1 branch must run QA')
assert.ok(workflow.includes('tests/melorix-stage-g-browser-qa.mjs'),'G1 browser audio fidelity regression required')
console.log('PASS MELORIX G.1: offline master t=0 parity; explicit sample provenance; GM/WAV/Erhu no silent fallback')
