import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {GM_SOUNDFONT_NAMES, gmProgram, gmVoiceForTrack} from '../src/util/melorix-gm-audio.ts'
assert.equal(GM_SOUNDFONT_NAMES.length,128,'All 128 General MIDI programs must be mapped')
assert.equal(GM_SOUNDFONT_NAMES[0],'acoustic_grand_piano')
assert.equal(GM_SOUNDFONT_NAMES[19],'church_organ')
assert.equal(GM_SOUNDFONT_NAMES[30],'distortion_guitar')
assert.equal(GM_SOUNDFONT_NAMES[33],'electric_bass_finger')
assert.equal(GM_SOUNDFONT_NAMES[110],'fiddle')
assert.equal(gmProgram(999),0)
assert.equal(gmVoiceForTrack({channel:10,name:'Drums'}).key,'percussion')
assert.equal(gmVoiceForTrack({channel:10,name:'untitled'}).percussion,true)
assert.equal(gmVoiceForTrack({name:'Drum Mix',channel:1}).percussion,true)
assert.equal(gmVoiceForTrack({name:'Snare Kit',libraryId:'snare-kit'}).percussion,true)
assert.equal(gmVoiceForTrack({name:'Guitar',program:30}).key,'distortion_guitar')
assert.equal(gmVoiceForTrack({program:33,channel:1,forcePiano:true}).key,'acoustic_grand_piano')
assert.equal(gmVoiceForTrack({program:0,channel:10,forcePiano:true}).percussion,false)
assert.equal(gmVoiceForTrack({program:33,channel:1,forcePiano:true}).program,0)
assert.equal(gmVoiceForTrack({program:33,channel:1}).key,'electric_bass_finger')
assert.equal(gmVoiceForTrack({libraryId:'erhu-hmoob-nplog'}).key,'fiddle')
assert.equal(gmVoiceForTrack({libraryId:'guitar-thung'}).key,'acoustic_guitar_steel')
const view=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
for(const token of [
 'importedMidiPrograms.value=Object.fromEntries','playTrackVoice(ctx,n.trackId',
 'playTrackVoice(ctx,pianoRollTrackId.value??-1',
 'getGmEngine(ctx)','engine.play(percussion','gmEngine?.stop()',
 'General MIDI thay thế','Kiểm tra loa (trống + nhạc cụ)'
])assert.ok(view.includes(token),token)
const menu=view.match(/<summary>Nhạc cụ<\/summary><div class="mx-menu-pop"[^>]*>([\s\S]*?)<\/div><\/details>/)?.[1]
assert.ok(menu)
assert.equal((menu.match(/<button /g)||[]).length,2,'Keep the two-item instrument menu unchanged')
console.log('PASS: 128 GM programs, percussion channel/name, sample fallback, track and audition routing')
