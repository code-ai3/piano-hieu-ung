import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseMelorixProject,serializeMelorixProject,projectTrackFx} from '../src/util/melorix-stage-e-project.ts'
import {audioBufferToWav} from '../src/util/melorix-wav-export.ts'

const source={
 format:'melorix-project',version:1,name:'Stage E Fixture',tempo:120,
 parts:[{id:3,name:'Piano RH',instrument:'Piano',channel:1,noteCount:2,enabled:true,color:'#abcdef'},
        {id:9,name:'Piano LH',instrument:'Piano',channel:2,noteCount:1,enabled:true,color:'#aabbcc'}],
 notes:[{trackId:3,name:'C4',midi:60,time:0,duration:.5,velocity:.8},
 {trackId:3,name:'E4',midi:64,time:.4,duration:.4,velocity:.64},
 {trackId:9,name:'C3',midi:48,time:0,duration:.9,velocity:.5}],
 programs:{3:0,9:1},presets:{3:'piano',9:'piano'},volumes:{3:75,9:44},pans:{3:-20,9:20},
 pedal:{3:[{time:0,value:127},{time:.8,value:0}],9:[]},
 fx:{3:{enabled:true,bassDb:6,midDb:-4,trebleDb:1,reverbWet:37,roomMs:1450},
     9:{enabled:true,bassDb:-6,midDb:4,trebleDb:-2,reverbWet:15,roomMs:900}},
 performance:{},pianoFeel:{},expression:'natural'
}
const file=serializeMelorixProject(source)
const loaded=parseMelorixProject(file)
assert.equal(loaded.parts.length,2)
assert.deepEqual(loaded.parts.map(p=>p.id),[3,9],'Track IDs retained (not array indices)')
assert.deepEqual(loaded.notes,source.notes.slice().sort((a,b)=>a.time-b.time||a.trackId-b.trackId||a.midi-b.midi),'Full-note snapshot roundtrip')
assert.equal(loaded.volumes[3],75)
assert.equal(loaded.pans[9],20)
assert.equal(loaded.pedal[3][1].value,0)
assert.deepEqual(projectTrackFx(loaded,3),source.fx[3])
assert.deepEqual(projectTrackFx(loaded,9),source.fx[9])
assert.equal(loaded.programs[9],1)
assert.equal(loaded.expression,'natural')
assert.throws(()=>parseMelorixProject('{}'),/phiên bản|Định dạng/)
assert.throws(()=>parseMelorixProject(JSON.stringify({...source,notes:[{...source.notes[0],trackId:99}]})),/nốt MIDI/)
assert.throws(()=>parseMelorixProject(JSON.stringify({...source,parts:[source.parts[0],source.parts[0]]})),/ID track/)
assert.throws(()=>parseMelorixProject(JSON.stringify({...source,notes:[{...source.notes[0],velocity:200}]})),/nốt MIDI/)
assert.throws(()=>parseMelorixProject('not JSON'),/JSON/)
const wav=audioBufferToWav({numberOfChannels:2,length:3,sampleRate:44100,
 getChannelData(ch){return ch===0?Float32Array.from([1,-1,0.5]):Float32Array.from([0.25,-0.25,0])}})
const view=new DataView(wav)
const str=(a,b)=>Array.from(new Uint8Array(wav,a,b)).map(x=>String.fromCharCode(x)).join('')
assert.equal(str(0,4),'RIFF');assert.equal(str(8,4),'WAVE');assert.equal(str(36,4),'data')
assert.equal(view.getUint16(22,true),2)
assert.equal(view.getUint32(24,true),44100)
assert.equal(view.getUint32(40,true),12)
assert.equal(view.getInt16(44,true),32767)
assert.equal(view.getInt16(48,true),-32768)
const mixer=readFileSync('src/util/melorix-offline-mix.ts','utf8')
const vue=readFileSync('src/views/PianoView.vue','utf8')
const inspector=readFileSync('src/components/MelorixAudioInspector.vue','utf8')
for(const marker of ['new TrackFxRack(ctx,master.input','gain.connect(panner);panner.connect(fx.input)',
 'fx?:Readonly<Record<number,TrackFxSettings>>','fxBypass?:Readonly<Record<number,boolean>>'])
 assert.ok(mixer.includes(marker),'Offline effect routing missing: '+marker)
for(const marker of ['function downloadMelorixProject()','async function onMelorixProjectUpload(',
 'serializeMelorixProject(captureMelorixProject())','parseMelorixProject(await file.text())',
 'fxSavedByTrack.value={...project.fx}','fxPreviewByTrack.value={...project.fx}',
 'const mix=await renderEditedMidiMix(exportSeconds)','async function exportWavMix()',
 'audioBufferToWav(mix.audioBuffer)','Lưu dự án (.melorix)','Mở dự án (.melorix)',
 'Xuất WAV bản phối (FX)'])
 assert.ok(vue.includes(marker),'Stage E integration missing: '+marker)
assert.ok(inspector.includes('Lưu dự án (.melorix)'))
console.log('PASS MELORIX Stage E: portable project roundtrip, validation, two-track FX, WAV PCM16, MP4 offline FX wiring')
