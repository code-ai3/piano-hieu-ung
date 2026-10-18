import type { MidiPart } from './midi-tracks'
import { TRACK_COLORS } from './midi-tracks'

export const INSTRUMENT_PRESETS = [
 { id:'piano', label:'Acoustic Grand Piano', program:0 },
 { id:'organ', label:'Organ (Web Synth)', program:19 },
 { id:'synth-bass', label:'Synth Bass', program:38 },
 { id:'synth-lead', label:'Synth Lead', program:80 },
 { id:'synth-pad', label:'Synth Pad', program:88 },
 { id:'music-box', label:'Music Box (Web Synth)', program:10 },
] as const
export type InstrumentPreset=typeof INSTRUMENT_PRESETS[number]['id']
export function isInstrumentPreset(value:string):value is InstrumentPreset{
 return INSTRUMENT_PRESETS.some(item=>item.id===value)
}
export function instrumentPreset(id:InstrumentPreset){
 return INSTRUMENT_PRESETS.find(p=>p.id===id)??INSTRUMENT_PRESETS[0]
}
export function makeInstrumentTrack(parts:readonly MidiPart[],preset:InstrumentPreset,name?:string):MidiPart{
 const id=parts.reduce((m,p)=>Math.max(m,p.id),-1)+1
 const occupied=new Set(parts.map(p=>p.channel))
 const channel=Array.from({length:16},(_,i)=>i+1).filter(v=>v!==10).find(v=>!occupied.has(v))??1
 return {id,name:name?.trim().slice(0,60)||`Nhạc cụ ${parts.length+1}`,
  instrument:instrumentPreset(preset).label,channel,noteCount:0,enabled:true,
  color:TRACK_COLORS[parts.length%TRACK_COLORS.length]}
}
// One authoritative voice plan for WebAudio and unit tests. These are
// synthesized timbres, not recorded acoustic Kontakt/VST instruments.
export function synthVoicePlan(preset:InstrumentPreset,midi:number,velocity:number,duration:number){
 const freq=440*Math.pow(2,(Math.max(0,Math.min(127,Math.round(midi)))-69)/12)
 const strength=Math.max(.001,Math.min(1,Number.isFinite(velocity)?velocity:95))
 const length=Math.max(.05,Number.isFinite(duration)?duration:0.5)
 switch(preset){
  case 'organ': return {freq,strength,length,wave:'sine' as OscillatorType,second:'triangle' as OscillatorType,blend:.28,attack:.018,decay:.06,sustain:.8,release:.15}
  case 'synth-bass':return {freq,strength,length,wave:'sawtooth' as OscillatorType,second:'sine' as OscillatorType,blend:.35,attack:.012,decay:.10,sustain:.43,release:.14}
  case 'synth-lead':return {freq,strength,length,wave:'sawtooth' as OscillatorType,second:'square' as OscillatorType,blend:.15,attack:.012,decay:.11,sustain:.58,release:.14}
  case 'synth-pad':return {freq,strength,length,wave:'triangle' as OscillatorType,second:'sine' as OscillatorType,blend:.32,attack:.24,decay:.25,sustain:.62,release:.55}
  case 'music-box':return {freq,strength,length,wave:'sine' as OscillatorType,second:'triangle' as OscillatorType,blend:.17,attack:.005,decay:.18,sustain:.10,release:.22}
  default:return {freq,strength,length,wave:'sine' as OscillatorType,second:'sine' as OscillatorType,blend:0,attack:.02,decay:.1,sustain:.5,release:.15}
 }
}
export interface SynthVoice {stop:()=>void}
export function playSynthVoice(ctx:AudioContext,midi:number,velocity:number,when:number,duration:number,preset:InstrumentPreset):SynthVoice {
 const p=synthVoicePlan(preset,midi,velocity,duration)
 const t=Math.max(ctx.currentTime+.002,when)
 const end=t+p.length
 const amp=ctx.createGain()
 const peak=.095*p.strength
 amp.gain.setValueAtTime(.0001,t)
 amp.gain.linearRampToValueAtTime(peak,t+Math.min(p.attack,p.length*.45))
 amp.gain.exponentialRampToValueAtTime(Math.max(.0001,peak*p.sustain),t+Math.min(p.attack+p.decay,p.length*.85))
 amp.gain.setValueAtTime(Math.max(.0001,peak*p.sustain),end)
 amp.gain.exponentialRampToValueAtTime(.0001,end+p.release)
 amp.connect(ctx.destination)
 const sources:OscillatorNode[]=[]
 let remaining=p.blend>0?2:1
 let disposed=false
 const create=(wave:OscillatorType,mix:number)=>{
  const osc=ctx.createOscillator(),gain=ctx.createGain()
  osc.type=wave
  osc.frequency.setValueAtTime(p.freq,t)
  gain.gain.value=mix
  osc.connect(gain);gain.connect(amp)
  osc.onended=()=>{
   try{osc.disconnect();gain.disconnect()}catch{}
   if(--remaining<=0){try{amp.disconnect()}catch{};disposed=true}
  }
  osc.start(t);osc.stop(end+p.release+.02)
  sources.push(osc)
 }
 create(p.wave,1-p.blend)
 if(p.blend>0)create(p.second,p.blend)
 return {stop:()=>{
  if(disposed)return
  const stopAt=Math.max(ctx.currentTime+.002,t+.0005)
  for(const osc of sources){try{osc.stop(stopAt)}catch{}}
 }}
}
