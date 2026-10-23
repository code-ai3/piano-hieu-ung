import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {DEFAULT_TRACK_FX,normalizeTrackFx,trackFxEqual,trackFxMix} from '../src/util/melorix-stage-d-track-fx.ts'
const original=normalizeTrackFx({})
assert.deepEqual(original,DEFAULT_TRACK_FX,'FX bypass is opt-in')
assert.deepEqual(trackFxMix(original),{dry:1,wet:0})
const full=normalizeTrackFx({enabled:true,bassDb:23,midDb:-25,trebleDb:8,reverbWet:200,roomMs:9999})
assert.deepEqual(full,{enabled:true,bassDb:12,midDb:-12,trebleDb:8,reverbWet:70,roomMs:2200})
const room=normalizeTrackFx({enabled:true,reverbWet:50,roomMs:1000})
const mix=trackFxMix(room)
assert.ok(mix.wet>.65&&mix.wet<.75&&mix.dry>.65&&mix.dry<.75,'Wet/Dry equal power')
assert.deepEqual(trackFxMix(room,true),{dry:1,wet:0},'A/B dry bypass')
assert.ok(trackFxEqual(original,normalizeTrackFx({})))
assert.ok(!trackFxEqual(room,original))
assert.deepEqual(normalizeTrackFx({enabled:false,bassDb:5,reverbWet:60}).enabled,false,'No FX when disabled')
const vue=readFileSync('src/views/PianoView.vue','utf8')
const inspector=readFileSync('src/components/MelorixAudioInspector.vue','utf8')
for(const token of ['new TrackFxRack(ctx,getAudioMaster(ctx),currentTrackFx(id))',
 'panner.connect(rack.input)','trackFxRacks.get(id)?.disconnect()',
 'function updateTrackFx(','function compareTrackFx(','function saveTrackFx(',
 'function undoTrackFx(','function redoTrackFx(','function resetTrackFx(',
 'fxSavedByTrack.value={...fxSavedByTrack.value,[id]:{...previous}}',
 'fxSavedByTrack.value={...fxSavedByTrack.value,[id]:{...next}}',
 'fxPreviewByTrack.value=omitTrackSetting(','fxSavedByTrack.value=omitTrackSetting(',
 'fxPreviewByTrack.value={};fxSavedByTrack.value={};fxBypassByTrack.value={}',
 '@fx-update="updateTrackFx"','@fx-save="saveTrackFx"'])
 assert.ok(vue.includes(token),'Stage D integration missing: '+token)
for(const token of ['EQ / Reverb riêng track','FX Bass 180 Hz','Lưu FX phiên này',
 'Undo FX','Redo FX','A/B FX: Nguyên bản','@change="fxChange(\'roomMs\',$event)"'])
 assert.ok(inspector.includes(token),'Stage D UI missing: '+token)
const packageJson=JSON.parse(readFileSync('package.json','utf8'))
assert.ok(packageJson.scripts.build.includes('test:stage-d'),'Stage D must run in build')
console.log('PASS MELORIX Stage D: FX normalization, WebAudio graph, track isolation, preview A/B and undo/redo wiring')
