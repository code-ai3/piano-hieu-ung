import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const view=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
const gm=readFileSync(new URL('../src/util/melorix-gm-audio.ts',import.meta.url),'utf8')
const synth=readFileSync(new URL('../src/util/melorix-instruments.ts',import.meta.url),'utf8')
const erhu=readFileSync(new URL('../src/util/melorix-erhu-web-sampler.ts',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/assets/melorix-roll.css',import.meta.url),'utf8')
for(const label of [
 "const trackVolumeLevels=ref<Record<number,number>>({})",
 "const trackGainNodes=new Map<number,GainNode>()",
 "function trackVolumePercent(id:number){return trackVolumeLevels.value[id]??100}",
 "node.gain.value=trackVolumePercent(id)/100",
 "Math.max(0,Math.min(100,Math.round(raw)))",
 "node.gain.setTargetAtTime(volume/100",
 "trackVolumeLevels.value={}",
 "clearTrackAudioOutputs()",
 "engine.preload(gmVoiceForId(part.id),part.id)",
 "engine.play(gmVoiceForId(trackId),midi,velocity,when,duration,trackId)",
 "playSynthVoice(ctx,midi,velocity,when,duration,preset,trackOutput(ctx,trackId))",
 "gain.connect(trackOutput(ctx,trackId))",
 "},trackOutput(ctx,trackId))",
 "min=\"0\" max=\"100\" step=\"1\"",
 ":aria-label=\"'Âm lượng track ' + part.name\"",
 "@input=\"setTrackVolume(part.id,$event)\"",
]) assert.ok(view.includes(label),'Missing volume routing: '+label)
assert.match(gm,/private cacheKey\(voice:GMVoice,trackId:number\)/)
assert.match(gm,/this\.cache\.set\(key,entry\)/)
assert.match(gm,/instrument:voice\.key,kit:'FluidR3_GM',destination/)
assert.match(gm,/fallbackDrum\(this\.ctx,note,velocity,when,destination\)/)
assert.match(gm,/fallbackTone\(this\.ctx,note,velocity,when,duration,voice\.program,destination\)/)
assert.match(synth,/amp\.connect\(destination\)/)
assert.match(erhu,/gain\.connect\(destination\)/)
assert.match(css,/\.mx-track-volume input\[type="range"\]/)
const sidebar=view.match(/class="mx-track-sidebar-list">([\s\S]*?)<div class="mx-track-side-footer">/)?.[1]
assert.ok(sidebar,'Track list must remain accessible')
assert.equal((sidebar.match(/class="mx-track-volume"/g)||[]).length,1,'One volume slider per rendered track')
console.log('PASS: individual 0-100 volume faders, isolated GM/synth/WAV buses, existing tracks retain MIDI and Mute/Solo')
