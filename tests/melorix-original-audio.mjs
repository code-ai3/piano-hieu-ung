import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const view=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
const expression=readFileSync(new URL('../src/util/melorix-expressive-audio.ts',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/assets/melorix-roll.css',import.meta.url),'utf8')

for(const mark of [
 'originalAudioUrl?: string',
 'const originalAudioUrl=URL.createObjectURL(file)',
 'const useOriginalAudio=ref(true)',
 'const hasOriginalAudio=computed(',
 'function originalAudioActive()',
 'function ensureOriginalAudioPlayer()',
 "originalAudioPlayer=new Audio()",
 "originalAudioPlayer.preload='auto'",
 "originalAudioPlayer.playbackRate=1/Math.max(.25,speed.value)",
 "originalAudioPlayer.preservesPitch=true",
 "originalAudioPlayer.src=url",
 "await original.play()",
 "currentTime.value=originalAudioPlayer.currentTime*speed.value",
 "if(originalAudioPlayer.ended)",
 "pauseOriginalAudio()",
 "if(originalAudioActive())return",
 "if(originalAudioActive()||!ctx",
 "if(hasOriginalAudio.value)ensureOriginalAudioPlayer()",
 "else if(originalAudioActive()&&currentTrack.value?.originalAudioUrl)",
 "const original=await decodeOriginalAudio(currentTrack.value.originalAudioUrl)",
 "audioBuf=alignKontaktAudio(original,exportSeconds,0)",
 "codec: 'aac', bitrate: 256000",
 "useOriginalAudio.value=true",
 "URL.revokeObjectURL(entry.originalAudioUrl)",
 'v-if="hasOriginalAudio" class="mx-original-audio-toggle"',
 'v-model="useOriginalAudio"',
 '@change="onOriginalAudioModeChange"',
 "Bản thu gốc",
 "MIDI không chứa âm sắc",
 "function attachOriginalAudioToCurrentMidi(event:Event)",
 "Gắn bản thu gốc vào MIDI",
 "track.originalAudioUrl=URL.createObjectURL(file)",
 "if(old)URL.revokeObjectURL(old)",
 "if(wasPlaying)void play()",
])assert.ok(view.includes(mark),'Missing original recording preservation: '+mark)
assert.ok(!view.includes("codec: 'aac', bitrate: 128000"),'Do not revert the MP4 AAC bitrate')
assert.ok(view.indexOf('if(useKontaktAudio.value&&kontaktAudioBuffer.value)')<
 view.indexOf('}else if(originalAudioActive()&&currentTrack.value?.originalAudioUrl)'),
 'Explicit Kontakt recording must retain export priority')
assert.ok(view.indexOf('}else if(originalAudioActive()&&currentTrack.value?.originalAudioUrl)')<
 view.indexOf('const mix=await renderEditedMidiMix(exportSeconds)'),
 'Local source must render instead of GM when present')
for(const mark of [
 'this.input.connect(this.dryOriginal)',
 'this.dryOriginal.connect(ctx.destination)',
 'this.input.connect(this.dryProcessed)',
 'this.dryProcessed.connect(compressor)',
 "set(this.dryOriginal.gain,mode==='original'?1:0",
 "set(this.dryProcessed.gain,mode==='original'?0:1",
 "const wet=mode==='original'?0",
])assert.ok(expression.includes(mark),'Original MIDI must bypass processing: '+mark)
assert.match(css,/\.mx-original-audio-toggle/)
console.log('PASS: original local MP3/WAV retained, native playback, MP4 source priority, processing bypass and 256kbps AAC')
