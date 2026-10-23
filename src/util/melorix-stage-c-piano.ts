import type {MidiNoteEvent} from './midi-tracks'
export type PianoFeelPreset='original'|'natural'|'expressive'
export type PianoFeelSettings={preset:PianoFeelPreset;dynamics:number;chordRollMs:number}
export const DEFAULT_PIANO_FEEL:Readonly<PianoFeelSettings>=Object.freeze({preset:'original',dynamics:0,chordRollMs:0})
export function pianoFeelPreset(preset:PianoFeelPreset):PianoFeelSettings{
 if(preset==='natural')return {preset,dynamics:45,chordRollMs:8}
 if(preset==='expressive')return {preset,dynamics:75,chordRollMs:16}
 return {...DEFAULT_PIANO_FEEL}
}
export function normalizedPianoFeel(value:Partial<PianoFeelSettings>):PianoFeelSettings{
 const p=value.preset
 const preset:PianoFeelPreset=p==='natural'||p==='expressive'?p:'original'
 const defaults=pianoFeelPreset(preset)
 const clamp=(v:unknown,lo:number,hi:number,fallback:number)=>{
  const n=Number(v);return Number.isFinite(n)?Math.max(lo,Math.min(hi,Math.round(n))):fallback
 }
 return {preset,dynamics:clamp(value.dynamics,0,100,defaults.dynamics),chordRollMs:clamp(value.chordRollMs,0,24,defaults.chordRollMs)}
}
export function hasPianoFeel(s:PianoFeelSettings):boolean{
 return s.preset!=='original'&&(s.dynamics>0||s.chordRollMs>0)
}
export function shapePianoTrackNotes(notes:readonly MidiNoteEvent[],trackId:number,input:PianoFeelSettings,bpm=120):MidiNoteEvent[]{
 const result=notes.map(n=>({...n}))
 const settings=normalizedPianoFeel(input)
 if(!hasPianoFeel(settings))return result
 const order=result.map((note,index)=>({note,index})).filter(x=>x.note.trackId===trackId)
  .sort((a,b)=>a.note.time-b.note.time||a.note.midi-b.note.midi||a.index-b.index)
 const groups:{onset:number;ids:number[]}[]=[]
 for(const item of order){
  const last=groups[groups.length-1]
  if(last&&item.note.time-last.onset<=.024)last.ids.push(item.index)
  else groups.push({onset:item.note.time,ids:[item.index]})
 }
 const safeBpm=Number.isFinite(bpm)&&bpm>0?bpm:120
 const beat=60/Math.max(35,Math.min(240,safeBpm))
 let phraseIndex=0,lastOnset=-Infinity
 for(const group of groups){
  phraseIndex=group.onset-lastOnset>Math.max(.48,beat*1.5)?0:phraseIndex+1
  lastOnset=group.onset
  const arch=Math.sin((phraseIndex+1)*.64)
  const pulse=Math.sin((phraseIndex+1)*1.31)*.28
  const entry=phraseIndex===0?.56:0
  const delta=Math.max(-.16,Math.min(.16,(arch*.40+pulse+entry-.18)*settings.dynamics/100*.23))
  const ids=[...group.ids].sort((a,b)=>result[a].midi-result[b].midi||a-b)
  for(let i=0;i<ids.length;i++){
   const note=result[ids[i]]
   note.velocity=Math.max(1/127,Math.min(1,note.velocity*(1+delta)))
   if(ids.length>1&&settings.chordRollMs>0)note.time=Math.max(0,note.time+i/(ids.length-1)*settings.chordRollMs/1000)
  }
 }
 return result.sort((a,b)=>a.time-b.time||a.trackId-b.trackId||a.midi-b.midi)
}
export function pianoFeelPreview(notes:readonly MidiNoteEvent[],byTrack:Readonly<Record<number,PianoFeelSettings>>,enabled:Readonly<Record<number,boolean>>,bpm:number):MidiNoteEvent[]{
 let result=notes.map(n=>({...n}))
 for(const key of Object.keys(byTrack)){
  const id=Number(key)
  if(!Number.isInteger(id)||id<0||enabled[id]===false)continue
  const settings=normalizedPianoFeel(byTrack[id])
  if(hasPianoFeel(settings))result=shapePianoTrackNotes(result,id,settings,bpm)
 }
 return result.sort((a,b)=>a.time-b.time||a.trackId-b.trackId||a.midi-b.midi)
}
