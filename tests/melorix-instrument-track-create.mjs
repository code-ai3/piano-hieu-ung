import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
const built=await build({entryPoints:['src/util/melorix-native-instrument-tracks.ts'],platform:'node',format:'esm',bundle:true,write:false,logLevel:'silent'})
const mod=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'))
const {prepareInstrumentTracks}=mod
const parts=[{id:0,name:'Piano RH',instrument:'Piano',channel:1,noteCount:26,enabled:true,color:'#abc'},
 {id:2,name:'Piano LH',instrument:'Piano',channel:2,noteCount:41,enabled:true,color:'#def'}]
const actions=[]
const port={
 bindVst3Track:async(id,path)=>{actions.push(['bind',id,path]);return {ok:true,componentInitialized:true}},
 unbindVst3Track:async(id)=>{actions.push(['unbind',id]);return {ok:true}}
}
const before=JSON.stringify(parts)
const result=await prepareInstrumentTracks(parts,{pluginPath:'C:/VST3/Kontakt 8.vst3',pluginName:'Kontakt 8',name:'Violin',count:3},port,[4,6])
assert.deepEqual(result.map(x=>x.part.id),[7,8,9],'do not replace existing plugin IDs')
assert.deepEqual(result.map(x=>x.part.name),['Violin 1','Violin 2','Violin 3'])
assert.deepEqual(result.map(x=>x.part.instrument),['Kontakt 8','Kontakt 8','Kontakt 8'])
assert.equal(JSON.stringify(parts),before,'preparing must not mutate original project')
assert.deepEqual(actions.map(x=>x[0]),['bind','bind','bind'])
actions.length=0
let attempts=0
const bad={bindVst3Track:async()=>{attempts++;if(attempts===2)throw Error('DLL failed');return {ok:true,componentInitialized:true}},unbindVst3Track:async(id)=>{actions.push(['unbind',id])}}
await assert.rejects(()=>prepareInstrumentTracks(parts,{pluginPath:'C:/VST3/Kontakt.vst3',pluginName:'Kontakt',name:'Strings',count:3},bad),/DLL failed/)
assert.deepEqual(actions,[['unbind',3]],'roll back the first loaded instance if later LOAD fails')
actions.length=0
await assert.rejects(()=>prepareInstrumentTracks(parts,{pluginPath:'x',pluginName:'Kontakt',name:'Test',count:5},port),/1 đến 4/)
assert.equal(actions.length,0)
const vue=readFileSync('src/views/PianoView.vue','utf8')
const modal=readFileSync('src/components/MelorixAddInstrumentTrack.vue','utf8')
for(const text of ['<MelorixAddInstrumentTrack','prepareInstrumentTracks(midiParts.value','openInstrumentEditorForTrack(part.id)','Instrument Track (VST3)','MIDI Track / nhạc cụ web'])
 assert.ok(vue.includes(text),'Missing track UI integration: '+text)
for(const text of ['scanVst3()', 'Instrument Track','WASAPI shared','@submit.prevent="submit"'])
 assert.ok(modal.includes(text),'Missing native selection UI: '+text)
console.log('PASS: MELORIX real VST3 instrument creation, separate IDs, transactional rollback and track UI')
