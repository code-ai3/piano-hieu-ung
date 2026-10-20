import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {removeMidiTrack,omitTrackSetting} from '../src/util/melorix-track-actions.ts'
const parts=[
 {id:0,name:'Piano RH',enabled:true,noteCount:2,channel:1,color:'#67e8f9',instrument:'Piano'},
 {id:2,name:'Piano LH',enabled:true,noteCount:1,channel:2,color:'#f472b6',instrument:'Piano'},
 {id:9,name:'Drums',enabled:true,noteCount:1,channel:10,color:'#60a5fa',instrument:'Drums'}
]
const notes=[
 {trackId:0,midi:60,time:0,duration:.5,velocity:.8},
 {trackId:0,midi:62,time:1,duration:.5,velocity:.7},
 {trackId:2,midi:48,time:0,duration:2,velocity:.6},
 {trackId:9,midi:36,time:.5,duration:.1,velocity:1}
]
const before=structuredClone({parts,notes})
const removedFirst=removeMidiTrack(parts,notes,0,0)
assert.deepEqual(removedFirst.parts.map(p=>p.id),[2,9])
assert.deepEqual(removedFirst.notes.map(n=>n.trackId),[2,9])
assert.equal(removedFirst.selectedId,2,'Prefer following track when deleting current')
const removedMiddle=removeMidiTrack(parts,notes,2,2)
assert.deepEqual(removedMiddle.parts.map(p=>p.id),[0,9])
assert.equal(removedMiddle.selectedId,9,'Keep remaining track identifiers intact')
const removedLast=removeMidiTrack(parts,notes,9,9)
assert.equal(removedLast.selectedId,2)
assert.equal(removedLast.notes.some(n=>n.trackId===9),false)
assert.equal(removeMidiTrack(parts,notes,2,0).selectedId,0,'Deleting non-selected must keep active selection')
assert.deepEqual(removeMidiTrack([parts[2]],[notes[3]],9,9),{parts:[],notes:[],selectedId:null},'Support deletion of final track')
assert.deepEqual(removeMidiTrack(parts,notes,123,2),{parts,notes,selectedId:2},'Unknown id must not edit song')
assert.deepEqual({parts,notes},before,'Operations must not mutate the source song')
const bank={0:'piano',2:'organ',9:'drums'}
assert.deepEqual(omitTrackSetting(bank,2),{0:'piano',9:'drums'})
assert.deepEqual(bank,{0:'piano',2:'organ',9:'drums'},'Keep original instrument and volume maps untouched')
const view=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
for(const marker of [
 'const selectedTrackId=ref<number|null>(null)',
 'function selectTrack(id:number)',
 'function deleteMidiTrack(id:number)',
 'window.confirm(',
 'midiParts.value=result.parts',
 'allNotes.value=result.notes',
 'selectedTrackId.value=result.selectedId',
 'assignedTrackPresets.value=omitTrackSetting(assignedTrackPresets.value,id)',
 'importedMidiPrograms.value=omitTrackSetting(importedMidiPrograms.value,id)',
 'kontaktTrackChannels.value=omitTrackSetting(kontaktTrackChannels.value,id)',
 'kontaktTrackNames.value=omitTrackSetting(kontaktTrackNames.value,id)',
 'trackVolumeLevels.value=omitTrackSetting(trackVolumeLevels.value,id)',
 'resetPiano()',
 'selectedTrackId.value=parsed.parts[0]?.id??null',
 'selectedTrackId.value=p.id',
 'mx-track-side-item-selected',
 'mx-track-row-selected',
 "selectTrack(part.id)",
 "@click.stop=\"deleteMidiTrack(part.id)\"",
 ":aria-label=\"'Xóa track '+part.name\"",
 ":aria-pressed=\"selectedTrackId===part.id\"",
]) assert.ok(view.includes(marker),'Missing UI/routing check: '+marker)
const css=readFileSync(new URL('../src/assets/melorix-roll.css',import.meta.url),'utf8')
for(const selector of ['.mx-track-side-item.mx-track-side-item-selected','.mx-track-delete','.mx-track-select:focus-visible','.mx-track-row-selected'])
 assert.ok(css.includes(selector),'Missing visible selection state: '+selector)
assert.equal((view.match(/@click\.stop="deleteMidiTrack\(part\.id\)"/g)||[]).length,1,'Exactly one trash icon per side card')
console.log('PASS: select/delete track, stable MIDI IDs, note isolation, routing cleanup, confirm and accessible UI')
