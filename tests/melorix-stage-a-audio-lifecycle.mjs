import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {canContinueAudioToNextSong,shouldPauseInterruptedWebAudio} from '../src/util/melorix-stage-a-audio-lifecycle.ts'
const playing={playing:true,desktop:false,originalAudio:false,externalMidi:false,contextState:'running'}
assert.equal(canContinueAudioToNextSong(playing),true)
assert.equal(canContinueAudioToNextSong({...playing,playing:false}),false)
assert.equal(canContinueAudioToNextSong({...playing,desktop:true}),false)
assert.equal(canContinueAudioToNextSong({...playing,originalAudio:true}),false)
assert.equal(canContinueAudioToNextSong({...playing,externalMidi:true}),false)
assert.equal(canContinueAudioToNextSong({...playing,contextState:'suspended'}),false)
const ctx={desktop:false,externalMidi:false,contextState:'running'}
assert.equal(shouldPauseInterruptedWebAudio(ctx,0.016),false)
assert.equal(shouldPauseInterruptedWebAudio(ctx,1.3),true)
assert.equal(shouldPauseInterruptedWebAudio({...ctx,contextState:'suspended'},0.016),true)
assert.equal(shouldPauseInterruptedWebAudio({...ctx,desktop:true},3),false)
assert.equal(shouldPauseInterruptedWebAudio({...ctx,externalMidi:true},3),false)
const view=readFileSync('src/views/PianoView.vue','utf8')
for(const token of ['pianoGeneration++','generation===pianoGeneration&&piano===sampler','canContinueAudioToNextSong({','shouldPauseInterruptedWebAudio({','resetPiano(Boolean(canContinueWebAudio))','if(wasPlaying)void play()'])assert.ok(view.includes(token),token)
const pause=view.slice(view.indexOf('function pause() {'),view.lastIndexOf('function stop() {'))
assert.ok(!pause.includes('.suspend('),'Pause must not suspend the entire audio context')
const stop=view.slice(view.lastIndexOf('function stop() {'),view.indexOf('function togglePlay()'))
assert.ok(!stop.includes('initPiano()'),'Stop must not launch a new AudioContext')
console.log('PASS MELORIX Stage A: audio lifecycle and stop/seek/next safeguards')
