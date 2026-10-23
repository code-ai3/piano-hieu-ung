import type {MidiNoteEvent,MidiPart} from './midi-tracks'
import {DEFAULT_TRACK_FX,normalizeTrackFx} from './melorix-stage-d-track-fx.ts'
import type {TrackFxSettings} from './melorix-stage-d-track-fx'
import {DEFAULT_PERFORMANCE,normalizedPerformance} from './melorix-stage-b-performance.ts'
import type {PerformanceSettings} from './melorix-stage-b-performance'
import {DEFAULT_PIANO_FEEL,normalizedPianoFeel} from './melorix-stage-c-piano.ts'
import type {PianoFeelSettings} from './melorix-stage-c-piano'

export type MelorixProject={
 format:'melorix-project'
 version:1
 name:string
 tempo:number
 parts:MidiPart[]
 notes:MidiNoteEvent[]
 programs:Record<number,number>
 presets:Record<number,string>
 volumes:Record<number,number>
 pans:Record<number,number>
 pedal:Record<number,{time:number,value:number}[]>
 fx:Record<number,TrackFxSettings>
 performance:Record<number,PerformanceSettings>
 pianoFeel:Record<number,PianoFeelSettings>
 expression:'original'|'natural'|'warm'
}
const asRecord=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const finite=(v:unknown,lo:number,hi:number,fallback:number):number=>{
 const n=Number(v);return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fallback
}
const trackRecord=<T>(input:unknown,parts:MidiPart[],parse:(v:unknown)=>T):Record<number,T>=>{
 const raw=asRecord(input),output:Record<number,T>={}
 for(const part of parts)if(Object.prototype.hasOwnProperty.call(raw,part.id))output[part.id]=parse(raw[part.id])
 return output
}
export function parseMelorixProject(input:string):MelorixProject{
 if(input.length>32_000_000)throw Error('File dự án vượt giới hạn 32 MB')
 let raw:Record<string,unknown>
 try{raw=asRecord(JSON.parse(input))}catch{throw Error('Tệp .melorix không phải JSON hợp lệ')}
 if(raw.format!=='melorix-project'||raw.version!==1)throw Error('Định dạng hoặc phiên bản MELORIX không được hỗ trợ')
 if(!Array.isArray(raw.parts)||raw.parts.length>128)throw Error('Số track không hợp lệ')
 const ids=new Set<number>()
 const parts:MidiPart[]=raw.parts.map((value)=>{
  const p=asRecord(value),id=Number(p.id)
  if(!Number.isInteger(id)||id<0||id>4095||ids.has(id))throw Error('ID track trùng hoặc không hợp lệ')
  ids.add(id)
  return {id,name:String(p.name??'Track').slice(0,100),instrument:String(p.instrument??'').slice(0,128),
   channel:Math.round(finite(p.channel,0,16,1)),
   noteCount:0,enabled:p.enabled!==false,
   color:/^#[0-9a-fA-F]{6}$/.test(String(p.color))?String(p.color):'#5cf6fe'}
 })
 if(!Array.isArray(raw.notes)||raw.notes.length>200_000)throw Error('Dự án chứa quá nhiều nốt')
 const notes:MidiNoteEvent[]=raw.notes.map((value)=>{
  const n=asRecord(value)
  const trackId=Number(n.trackId),midi=Number(n.midi)
  const time=Number(n.time),duration=Number(n.duration),velocity=Number(n.velocity)
  if(!ids.has(trackId)||!Number.isInteger(midi)||midi<0||midi>127||
   !Number.isFinite(time)||time<0||time>36000||
   !Number.isFinite(duration)||duration<=0||duration>36000||
   !Number.isFinite(velocity)||velocity<0||velocity>1)
   throw Error('Dự án có nốt MIDI sai dữ liệu')
  return {trackId,midi,name:String(n.name??'').slice(0,12),time,duration,velocity}
 }).sort((a,b)=>a.time-b.time||a.trackId-b.trackId||a.midi-b.midi)
 for(const p of parts)p.noteCount=notes.filter(n=>n.trackId===p.id).length
 const expr=raw.expression
 return {
  format:'melorix-project',version:1,name:String(raw.name??'MELORIX').slice(0,100),
  tempo:finite(raw.tempo,20,300,120),parts,notes,
  programs:trackRecord(raw.programs,parts,v=>Math.round(finite(v,0,127,0))),
  presets:trackRecord(raw.presets,parts,v=>String(v??'piano').slice(0,256)),
  volumes:trackRecord(raw.volumes,parts,v=>Math.round(finite(v,0,100,100))),
  pans:trackRecord(raw.pans,parts,v=>Math.round(finite(v,-100,100,0))),
  pedal:trackRecord(raw.pedal,parts,v=>Array.isArray(v)?v.slice(0,50000).map(p=>{
   const e=asRecord(p);return {time:finite(e.time,0,36000,0),value:finite(e.value,0,127,0)}
  }).sort((a,b)=>a.time-b.time):[]),
  fx:trackRecord(raw.fx,parts,v=>normalizeTrackFx(asRecord(v) as Partial<TrackFxSettings>)),
  performance:trackRecord(raw.performance,parts,v=>normalizedPerformance(asRecord(v) as Partial<PerformanceSettings>)),
  pianoFeel:trackRecord(raw.pianoFeel,parts,v=>normalizedPianoFeel(asRecord(v) as Partial<PianoFeelSettings>)),
  expression:expr==='original'||expr==='warm'?expr:'natural'
 }
}
export function serializeMelorixProject(project:MelorixProject):string{
 const validated=parseMelorixProject(JSON.stringify(project))
 return JSON.stringify(validated,null,2)
}
export function projectTrackFx(project:MelorixProject,id:number):TrackFxSettings{
 return project.fx[id]??{...DEFAULT_TRACK_FX}
}
export function projectTrackPerformance(project:MelorixProject,id:number):PerformanceSettings{
 return project.performance[id]??{...DEFAULT_PERFORMANCE}
}
export function projectPianoFeel(project:MelorixProject,id:number):PianoFeelSettings{
 return project.pianoFeel[id]??{...DEFAULT_PIANO_FEEL}
}
