// MELORIX web sound engine. Sample-based General MIDI previews are explicitly NOT Kontakt NKI.
// Guarantee a Web Audio voice even if remote soundfont samples cannot be fetched.
// FluidR3 GM samples: CC BY 3.0 (attribution required).
import { Soundfont } from 'smplr'
import type { SynthVoice } from './melorix-instruments'

export const GM_SOUNDFONT_NAMES = `
acoustic_grand_piano bright_acoustic_piano electric_grand_piano honkytonk_piano electric_piano_1 electric_piano_2 harpsichord clavinet
celesta glockenspiel music_box vibraphone marimba xylophone tubular_bells dulcimer
drawbar_organ percussive_organ rock_organ church_organ reed_organ accordion harmonica tango_accordion
acoustic_guitar_nylon acoustic_guitar_steel electric_guitar_jazz electric_guitar_clean electric_guitar_muted overdriven_guitar distortion_guitar guitar_harmonics
acoustic_bass electric_bass_finger electric_bass_pick fretless_bass slap_bass_1 slap_bass_2 synth_bass_1 synth_bass_2
violin viola cello contrabass tremolo_strings pizzicato_strings orchestral_harp timpani
string_ensemble_1 string_ensemble_2 synth_strings_1 synth_strings_2 choir_aahs voice_oohs synth_choir orchestra_hit
trumpet trombone tuba muted_trumpet french_horn brass_section synth_brass_1 synth_brass_2
soprano_sax alto_sax tenor_sax baritone_sax oboe english_horn bassoon clarinet
piccolo flute recorder pan_flute blown_bottle shakuhachi whistle ocarina
lead_1_square lead_2_sawtooth lead_3_calliope lead_4_chiff lead_5_charang lead_6_voice lead_7_fifths lead_8_bass__lead
pad_1_new_age pad_2_warm pad_3_polysynth pad_4_choir pad_5_bowed pad_6_metallic pad_7_halo pad_8_sweep
fx_1_rain fx_2_soundtrack fx_3_crystal fx_4_atmosphere fx_5_brightness fx_6_goblins fx_7_echoes fx_8_scifi
sitar banjo shamisen koto kalimba bagpipe fiddle shanai
tinkle_bell agogo steel_drums woodblock taiko_drum melodic_tom synth_drum reverse_cymbal
guitar_fret_noise breath_noise seashore bird_tweet telephone_ring helicopter applause gunshot
`.trim().split(/\s+/)
export type GMVoice={key:string,percussion:boolean,program:number}
export function gmProgram(program:number):number{
 return Number.isFinite(program)&&program>=0&&program<=127?Math.floor(program):0
}
export function gmVoiceForTrack(params:{
 program?:number; channel?:number; name?:string; instrument?:string; libraryId?:string; forcePiano?:boolean
}):GMVoice{
 // Explicitly choosing Piano in the track menu must win over original MIDI
 // program and channel (otherwise a Bass track can keep playing Bass).
 if(params.forcePiano)return {key:'acoustic_grand_piano',percussion:false,program:0}
 const name=(params.name??'').toLowerCase()
 const timbre=(params.instrument??'').toLowerCase()
 const id=(params.libraryId??'').toLowerCase()
 const percussion=params.channel===10||/\b(drum|percussion|snare|kick|kit|trống)\b/i.test(name+' '+timbre+' '+id)
 if(percussion)return {key:'percussion',percussion:true,program:0}
 let program=params.program??-1
 if(id){
  if(/erhu|violin|fiddle|string/.test(id))program=110
  else if(/piano|grand|s90|yamaha/.test(id))program=0
  else if(/guitar|picked|thung/.test(id))program=25
  else if(/bass/.test(id))program=33
  else if(/organ/.test(id))program=19
  else if(/sax/.test(id))program=65
  else if(/brass|trumpet/.test(id))program=61
  else if(/shak|dizi|flute/.test(id))program=73
  else if(/koto/.test(id))program=107
  else if(/drum|kick|snare/.test(id))return {key:'percussion',percussion:true,program:0}
  else program=0
 }
 const chosen=gmProgram(program)
 return {key:GM_SOUNDFONT_NAMES[chosen]||'acoustic_grand_piano',percussion:false,program:chosen}
}
function clamp(value:number,min:number,max:number){return Number.isFinite(value)?Math.max(min,Math.min(max,value)):min}
// Offline fallback is only used while recorded GM soundfont samples are unavailable.
// Two partials, velocity-controlled brightness and instrument-specific envelopes feel
// less like a flat beep while preserving exact MIDI pitch and onset.
export function fallbackTone(ctx:BaseAudioContext,note:number,velocity:number,when:number,duration:number,program:number,destination:AudioNode=ctx.destination):SynthVoice{
 const t=Math.max(ctx.currentTime+.005,when)
 const length=clamp(duration,.06,12)
 const power=clamp(velocity/127,.01,1)
 const bass=program>=32&&program<=39
 const pluck=(program>=24&&program<=31)||program===46
 const strings=(program>=40&&program<=51)||(program>=88&&program<=95)
 const wind=program>=56&&program<=79
 const attack=strings ? 0.075 : wind ? 0.027 : 0.007
 const release=strings ? 0.27 : wind ? 0.18 : pluck ? 0.09 : 0.14
 const sustain=pluck ? 0.20 : bass ? 0.46 : strings ? 0.72 : 0.62
 const peak=(bass ? 0.07 : 0.055)*Math.pow(power,.75)
 const hz=440*Math.pow(2,(clamp(note,0,127)-69)/12)
 const amp=ctx.createGain()
 const filter=ctx.createBiquadFilter()
 filter.type='lowpass'
 const cutoff=clamp((bass?650:strings?1950:pluck?2650:wind?2100:3150)+power*3100,500,10000)
 filter.frequency.setValueAtTime(cutoff,t)
 if(pluck)filter.frequency.exponentialRampToValueAtTime(Math.max(500,cutoff*.34),t+length+.06)
 amp.gain.setValueAtTime(.0001,t)
 amp.gain.linearRampToValueAtTime(peak,t+Math.min(attack,length*.3))
 amp.gain.exponentialRampToValueAtTime(Math.max(.0001,peak*sustain),t+Math.min(length*.65,attack+.22))
 amp.gain.setValueAtTime(Math.max(.0001,peak*sustain),t+length)
 amp.gain.exponentialRampToValueAtTime(.0001,t+length+release)
 filter.connect(amp);amp.connect(destination)
 const oscs:OscillatorNode[]=[]
 const make=(wave:OscillatorType,mix:number,detune=0)=>{
  const osc=ctx.createOscillator(),voiceGain=ctx.createGain()
  osc.type=wave
  osc.frequency.setValueAtTime(hz,t)
  osc.detune.value=detune
  voiceGain.gain.value=mix
  osc.connect(voiceGain);voiceGain.connect(filter)
  osc.onended=()=>{try{osc.disconnect();voiceGain.disconnect()}catch{}}
  osc.start(t);osc.stop(t+length+release+.025)
  oscs.push(osc)
 }
 make(bass?'sawtooth':strings?'sawtooth':pluck?'triangle':wind?'triangle':'sine',.78)
 make(bass?'sine':strings?'triangle':pluck?'sine':wind?'sine':'triangle',.22,strings?2.5:0)
 return {stop:()=>{
  const at=Math.max(ctx.currentTime+.002,t+.001)
  for(const osc of oscs){try{osc.stop(at)}catch{}}
 }}
}
export function fallbackDrum(ctx:BaseAudioContext,note:number,velocity:number,when:number,destination:AudioNode=ctx.destination):SynthVoice{
 const t=Math.max(ctx.currentTime+.005,when)
 const intensity=clamp(velocity/127,.05,1)
 const kick=[35,36].includes(note)
 const hat=[42,44,46,51,53,59].includes(note)
 const tom=[41,43,45,47,48,50].includes(note)
 const length=kick?.27:hat?.09:tom?.20:.17
 const gain=ctx.createGain()
 gain.gain.setValueAtTime(kick?.32*intensity:hat?.16*intensity:.21*intensity,t)
 gain.gain.exponentialRampToValueAtTime(.0001,t+length)
 gain.connect(destination)
 let source:AudioScheduledSourceNode
 if(kick||tom){
  const osc=ctx.createOscillator()
  const startHz=kick?155:220+(note-41)*18
  osc.type='sine'
  osc.frequency.setValueAtTime(startHz,t)
  osc.frequency.exponentialRampToValueAtTime(kick?45:90,t+length)
  source=osc
 }else{
  // Fresh noise only for an active drum hit; no downloads, no silent drum tracks.
  const size=Math.ceil(ctx.sampleRate*length)
  const buffer=ctx.createBuffer(1,size,ctx.sampleRate)
  const data=buffer.getChannelData(0)
  for(let i=0;i<size;i++)data[i]=Math.random()*2-1
  const noise=ctx.createBufferSource()
  noise.buffer=buffer
  const filter=ctx.createBiquadFilter()
  filter.type=hat?'highpass':'bandpass'
  filter.frequency.value=hat?7000:2100
  noise.connect(filter);filter.connect(gain)
  source=noise
 }
 if(kick||tom)source.connect(gain)
 source.start(t);source.stop(t+length+.001)
 source.onended=()=>{try{source.disconnect();gain.disconnect()}catch{}}
 return {stop:()=>{try{source.stop(Math.max(ctx.currentTime+.002,t+.001))}catch{}}}
}
type LoadedSoundfont=ReturnType<typeof Soundfont>
type Entry={instrument:LoadedSoundfont;ready:boolean;failed:boolean}
export class GmWebAudio {
 private ctx:AudioContext
 private cache=new Map<string,Entry>()
 private destinationForTrack:(trackId:number)=>AudioNode
 constructor(ctx:AudioContext,destinationForTrack?:(trackId:number)=>AudioNode){
  this.ctx=ctx
  this.destinationForTrack=destinationForTrack??(()=>ctx.destination)
 }
 private cacheKey(voice:GMVoice,trackId:number):string{return trackId+':'+voice.key}
 preload(voice:GMVoice,trackId=-1):void{
  const key=this.cacheKey(voice,trackId)
  if(this.cache.has(key))return
  const destination=this.destinationForTrack(trackId)
  try{
   const instrument=voice.percussion
    ?Soundfont(this.ctx,{instrumentUrl:'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/percussion-mp3.js',destination})
    :Soundfont(this.ctx,{instrument:voice.key,kit:'FluidR3_GM',destination})
   const entry:Entry={instrument,ready:false,failed:false}
   this.cache.set(key,entry)
   const pending=instrument.load
   void Promise.resolve(pending).then(()=>{entry.ready=true}).catch(error=>{
    entry.failed=true
    console.warn('General MIDI sample unavailable, using local sound:',voice.key,error)
   })
  }catch(error){console.warn('General MIDI preload failed:',voice.key,error)}
 }
 play(voice:GMVoice,note:number,velocity:number,when:number,duration:number,trackId=-1):SynthVoice{
  const entry=this.cache.get(this.cacheKey(voice,trackId))
  if(!entry)this.preload(voice,trackId)
  const destination=this.destinationForTrack(trackId)
  if(entry?.ready&&!entry.failed){
   try{
    const stopNote=entry.instrument.start({
     note:clamp(Math.round(note),0,127),velocity:clamp(velocity,1,127),
     time:Math.max(this.ctx.currentTime+.005,when),duration:clamp(duration,.06,15)
    })
    if(typeof stopNote==='function')return {stop:()=>{try{stopNote(this.ctx.currentTime+.002)}catch{}}}
   }catch(error){console.warn('Soundfont note fallback:',error)}
  }
  return voice.percussion
   ?fallbackDrum(this.ctx,note,velocity,when,destination)
   :fallbackTone(this.ctx,note,velocity,when,duration,voice.program,destination)
 }
 stop(){for(const item of this.cache.values()){try{item.instrument.stop()}catch{}}}
}
