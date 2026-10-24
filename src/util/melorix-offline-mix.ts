import {renderOffline,Soundfont,SplendidGrandPiano} from 'smplr'
import type {MidiPart,MidiNoteEvent} from './midi-tracks'
import {gmVoiceForTrack,fallbackTone,fallbackDrum} from './melorix-gm-audio'
import {isInstrumentPreset,playSynthVoice} from './melorix-instruments'
import type {InstrumentPreset} from './melorix-instruments'
import {ExpressiveAudioMaster,expressedVelocity} from './melorix-expressive-audio'
import type {ExpressionMode} from './melorix-expressive-audio'
import {TrackFxRack,DEFAULT_TRACK_FX} from './melorix-stage-d-track-fx'
import type {TrackFxSettings} from './melorix-stage-d-track-fx'
import {samplePitchRate} from './melorix-local-wav'
import {nearestErhuSample} from './melorix-erhu-sample-cache'

export type MixConfig={
 notes:readonly MidiNoteEvent[]
 parts:readonly MidiPart[]
 programs:Readonly<Record<number,number>>
 presets:Readonly<Record<number,string>>
 volumes:Readonly<Record<number,number>>
 pans?:Readonly<Record<number,number>>
 fx?:Readonly<Record<number,TrackFxSettings>>
 fxBypass?:Readonly<Record<number,boolean>>
 wavSamples:ReadonlyMap<string,{buffer:AudioBuffer,root:number}>
 erhuSamples:ReadonlyMap<number,AudioBuffer>
 seconds:number
 tempo:number
 expression:ExpressionMode
 // MP4/WAV must never silently replace the bundled piano samples with basic oscillators.
 requireBundledPiano?:boolean
}
export type MixResult={audioBuffer:AudioBuffer;fallbacks:string[]}
const storage={fetch:(url:string)=>fetch(url.replace('#','%23'))}
const scheduler={schedule(event:any,callback:(event:any)=>void){callback(event);return ()=>{}},stop(){}}
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x))
export function mixVoiceType(preset:string|undefined,gmKey:string){
 if(preset?.startsWith('user:'))return 'wav'
 if(preset==='library:erhu-hmoob-nplog')return 'erhu'
 if(preset&&isInstrumentPreset(preset)&&preset!=='piano')return 'synth'
 return (preset===undefined||preset==='piano')&&gmKey==='acoustic_grand_piano'?'piano':'gm'
}
function playWav(ctx:OfflineAudioContext,buffer:AudioBuffer,root:number,n:MidiNoteEvent,v:number,out:AudioNode){
 const start=Math.max(.003,n.time),length=Math.max(.06,n.duration)
 const src=ctx.createBufferSource(),gain=ctx.createGain()
 src.buffer=buffer;src.playbackRate.value=samplePitchRate(n.midi,root)
 const level=Math.max(.0001,v/127*.7)
 gain.gain.setValueAtTime(.0001,start)
 gain.gain.linearRampToValueAtTime(level,start+.012)
 gain.gain.setValueAtTime(level,start+length)
 gain.gain.exponentialRampToValueAtTime(.0001,start+length+.1)
 src.connect(gain);gain.connect(out)
 src.start(start);src.stop(start+length+.12)
}
function fallback(ctx:OfflineAudioContext,n:MidiNoteEvent,v:number,voice:ReturnType<typeof gmVoiceForTrack>,out:AudioNode){
 if(voice.percussion)fallbackDrum(ctx,n.midi,v,Math.max(.005,n.time),out)
 else fallbackTone(ctx,n.midi,v,Math.max(.005,n.time),n.duration,voice.program,out)
}
async function loadWithin(p:Promise<unknown>,ms=9000){
 let timer:ReturnType<typeof setTimeout>|undefined
 try{
  return await Promise.race([p.then(()=>true),new Promise<boolean>(resolve=>{
   timer=setTimeout(()=>resolve(false),ms)
  })])
 }catch{return false}finally{if(timer!==undefined)clearTimeout(timer)}
}
export async function renderMultiTrackAudio(opts:MixConfig):Promise<MixResult>{
 if(!(opts.seconds>0&&Number.isFinite(opts.seconds)))throw Error('Invalid export duration')
 const fallbacks=new Set<string>()
 const result=await renderOffline(async ctx=>{
  const master=new ExpressiveAudioMaster(ctx,opts.expression)
  const groups=opts.parts.filter(p=>p.enabled).map(part=>({
   part,notes:opts.notes.filter(n=>n.trackId===part.id&&n.time<opts.seconds&&n.duration>0)
  })).filter(group=>group.notes.length>0)
  await Promise.all(groups.map(async ({part,notes})=>{
   const volume=clamp(opts.volumes[part.id]??100,0,100)/100
   if(volume===0)return
   const gain=ctx.createGain();gain.gain.value=volume
   // Same Stage D Biquad/Convolver rack as the realtime WebAudio track.
   // Offline context uses immediate parameters at t=0 to avoid unwanted fade-in.
   const panner=ctx.createStereoPanner()
   panner.pan.value=clamp(opts.pans?.[part.id]??0,-100,100)/100
   const fx=new TrackFxRack(ctx,master.input,opts.fx?.[part.id]??DEFAULT_TRACK_FX,true)
   fx.set(opts.fx?.[part.id]??DEFAULT_TRACK_FX,opts.fxBypass?.[part.id]===true,true)
   gain.connect(panner);panner.connect(fx.input)
   const preset=opts.presets[part.id]
   const voice=gmVoiceForTrack({name:part.name,instrument:part.instrument,
    program:opts.programs[part.id],channel:part.channel,
    libraryId:preset?.startsWith('library:')?preset.slice(8):undefined,
    forcePiano:preset==='piano'})
   const noteVelocity=(n:MidiNoteEvent)=>expressedVelocity(n.velocity*127,n.time,opts.tempo,opts.expression)
   const kind=mixVoiceType(preset,voice.key)
   if(kind==='wav'){
    const sample=opts.wavSamples.get(preset)
    if(sample){for(const n of notes)playWav(ctx,sample.buffer,sample.root,n,noteVelocity(n),gain);return}
   }
   if(kind==='erhu'&&opts.erhuSamples.size){
    const roots=[...opts.erhuSamples.keys()]
    for(const n of notes){
     const root=nearestErhuSample(n.midi,roots)
     const sample=root===null?undefined:opts.erhuSamples.get(root)
     if(root!==null&&sample)playWav(ctx,sample,root,n,noteVelocity(n),gain)
    }
    return
   }
   if(kind==='synth'){
    for(const n of notes)playSynthVoice(ctx,n.midi,noteVelocity(n),Math.max(.005,n.time),n.duration,preset as InstrumentPreset,gain)
    return
   }
   if(kind==='piano'){
    // Use the very same sample library configuration as live WebAudio playback:
    // 100% sample output, 0.65s decay time, source and per-track FX chain.
    let sampled=false
    try{
     const piano=SplendidGrandPiano(ctx,{
      volume:100,decayTime:.65,
      baseUrl:'/samples/sfzinstruments-splendid-grand-piano/samples',
      destination:gain,storage:storage as any,scheduler,
      notesToLoad:{notes:[...new Set(notes.map(n=>n.midi))]}
     } as any)
     if(await loadWithin(piano.load,20000)){
      for(const n of notes)piano.start({note:n.midi,velocity:noteVelocity(n),
       time:Math.max(.005,n.time),duration:Math.max(.06,n.duration)})
      sampled=true
     }
    }catch(error){console.warn('Piano export sample missing',error)}
    if(sampled)return
    if(opts.requireBundledPiano)
     throw Error('Không tải được mẫu Splendid Grand Piano khi xuất. MELORIX dừng xuất để tránh tự đổi sang tiếng tổng hợp kém chất lượng. Kiểm tra mạng/mẫu âm thanh rồi thử lại.')
   }
   try{
    const instrument=Soundfont(ctx,{destination:gain,scheduler,
     ...(voice.percussion
      ?{instrumentUrl:'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/percussion-mp3.js'}
      :{kit:'FluidR3_GM',instrument:voice.key})})
    if(await loadWithin(instrument.load)){
     for(const n of notes)instrument.start({note:n.midi,velocity:noteVelocity(n),
      time:Math.max(.005,n.time),duration:Math.max(.06,n.duration)})
     return
    }
   }catch(error){console.warn('GM export sample missing',voice.key,error)}
   fallbacks.add(part.name)
   for(const n of notes)fallback(ctx,n,noteVelocity(n),voice,gain)
  }))
 },{duration:opts.seconds,channels:2,sampleRate:44100})
 return {audioBuffer:result.audioBuffer,fallbacks:[...fallbacks]}
}
