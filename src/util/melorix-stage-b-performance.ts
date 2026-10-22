import type {MidiNoteEvent} from './midi-tracks'
import type {PedalPoint} from './melorix-auto-pedal'

export type PerformanceSettings={
 velocity:number // 100% preserves original MIDI velocity
 humanizeMs:number // max timing variation, deterministic across replays
 lengthPercent:number
 legato:number // 0-100%, fills short gaps to next onset in the same track
 pan:number // -100 to +100, applied to the real WebAudio panner
}
export const DEFAULT_PERFORMANCE:Readonly<PerformanceSettings>=Object.freeze({
 velocity:100,humanizeMs:0,lengthPercent:100,legato:0,pan:0
})
export type PerformanceKey=keyof PerformanceSettings
export const LIMITS:Record<PerformanceKey,[number,number]>={
 velocity:[30,180],humanizeMs:[0,40],lengthPercent:[40,170],legato:[0,100],pan:[-100,100]
}
export function normalizedPerformance(input:Partial<PerformanceSettings>):PerformanceSettings{
 const base={...DEFAULT_PERFORMANCE,...input}
 const result={...DEFAULT_PERFORMANCE}
 for(const key of Object.keys(result) as PerformanceKey[]){
  const [lo,hi]=LIMITS[key]
  const val=Number(base[key])
  result[key]=Number.isFinite(val)?Math.max(lo,Math.min(hi,Math.round(val))):DEFAULT_PERFORMANCE[key]
 }
 return result
}
export function hasNoteExpression(settings:PerformanceSettings):boolean{
 return settings.velocity!==100||settings.humanizeMs!==0||settings.lengthPercent!==100||settings.legato!==0
}
function hash(input:number):number{
 let x=Math.imul((input|0)^0x5bd1e995,0x27d4eb2d)
 x^=x>>>15
 return (x>>>0)/4294967295
}
// Pedal is down only after CC64 >= 64 and is released at the next off event.
// We extend playback duration without editing any MIDI notes; cap is deliberate
// to prevent a malformed CC lane sustaining forever.
export function sustainEnd(noteEnd:number,pedal:readonly PedalPoint[],maxTail=2.5):number{
 let down=false
 let off:number|null=null
 const sorted=[...pedal].sort((a,b)=>a.time-b.time)
 for(const event of sorted){
  if(event.time<=noteEnd+1e-6)down=event.value>=64
  else if(down&&event.value<64){off=event.time;break}
 }
 return down?Math.min(noteEnd+maxTail,off??noteEnd+maxTail):noteEnd
}
export function shapeTrackNotes(
 notes:readonly MidiNoteEvent[], trackId:number,settings:PerformanceSettings,
 pedal:readonly PedalPoint[]=[],withPedal=false
):MidiNoteEvent[]{
 const opts=normalizedPerformance(settings)
 const selected=notes.filter(n=>n.trackId===trackId)
 const onset=selected.map(n=>n.time).sort((a,b)=>a-b)
 const nextStart=(t:number):number=>{
  let l=0,r=onset.length
  while(l<r){const m=(l+r)>>1;if(onset[m]<=t+1e-5)l=m+1;else r=m}
  return onset[l]??Number.POSITIVE_INFINITY
 }
 return notes.map(n=>{
  if(n.trackId!==trackId)return {...n}
  const seed=Math.round(n.time*1000)*37+n.midi*983+Math.round(n.duration*1000)*11+trackId*7919
  const offset=(hash(seed)*2-1)*opts.humanizeMs/1000
  const time=Math.max(0,n.time+offset)
  const originalEnd=n.time+Math.max(.03,n.duration)
  const baseEnd=time+Math.max(.03,n.duration*opts.lengthPercent/100)
  const next=nextStart(n.time)
  const gap=Math.max(0,next-baseEnd)
  // Only extend into the next short musical gap; never span bars of silence.
  const legatoGap=Number.isFinite(next)&&gap<.36?gap*opts.legato/100:0
  const end=withPedal?sustainEnd(baseEnd+legatoGap,pedal):baseEnd+legatoGap
  const velocity=Math.max(1/127,Math.min(1,n.velocity*opts.velocity/100))
  // Do not move the original note list or modify any other track.
  return {...n,time,duration:Math.max(.03,end-time),velocity}
 })
}
export function audioInspectorPreview(
 notes:readonly MidiNoteEvent[],byTrack:Readonly<Record<number,PerformanceSettings>>,
 enabled:boolean,pedals:Readonly<Record<number,PedalPoint[]>>={}
):MidiNoteEvent[]{
 if(!enabled)return [...notes]
 let result=[...notes]
 for(const [id,value] of Object.entries(byTrack)){
  const trackId=Number(id)
  if(!Number.isInteger(trackId))continue
  result=shapeTrackNotes(result,trackId,value,pedals[trackId]??[],true)
 }
 return result.sort((a,b)=>a.time-b.time||a.trackId-b.trackId||a.midi-b.midi)
}
