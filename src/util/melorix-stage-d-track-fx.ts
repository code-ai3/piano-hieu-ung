// Per-track WEB AUDIO FX only. This does not replace Kontakt/VST3 or encode audio FX into MIDI.
export type TrackFxSettings={
 enabled:boolean
 bassDb:number
 midDb:number
 trebleDb:number
 reverbWet:number // 0–70% wet
 roomMs:number // impulse length, 350–2200 ms
}
export const DEFAULT_TRACK_FX:Readonly<TrackFxSettings>=Object.freeze({
 enabled:false,bassDb:0,midDb:0,trebleDb:0,reverbWet:0,roomMs:1100
})
export function normalizeTrackFx(input:Partial<TrackFxSettings>):TrackFxSettings{
 const finite=(v:unknown,min:number,max:number,fallback:number)=>{
  const n=Number(v)
  return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback
 }
 return {
  enabled:input.enabled===true,
  bassDb:finite(input.bassDb,-12,12,0),
  midDb:finite(input.midDb,-12,12,0),
  trebleDb:finite(input.trebleDb,-12,12,0),
  reverbWet:finite(input.reverbWet,0,70,0),
  roomMs:finite(input.roomMs,350,2200,1100)
 }
}
export function trackFxEqual(a:TrackFxSettings,b:TrackFxSettings):boolean{
 return Object.keys(DEFAULT_TRACK_FX).every(k=>a[k as keyof TrackFxSettings]===b[k as keyof TrackFxSettings])
}
export function trackFxMix(settings:TrackFxSettings,bypass=false):{dry:number;wet:number}{
 const s=normalizeTrackFx(settings)
 if(bypass||!s.enabled)return {dry:1,wet:0}
 const v=s.reverbWet/100
 return {dry:Math.cos(v*Math.PI/2),wet:Math.sin(v*Math.PI/2)}
}
function roomImpulse(ctx:BaseAudioContext,lengthMs:number):AudioBuffer{
 const ms=Math.max(350,Math.min(2200,Math.round(lengthMs)))
 const count=Math.max(1,Math.round(ctx.sampleRate*ms/1000))
 const buffer=ctx.createBuffer(2,count,ctx.sampleRate)
 let seed=0x712fac31
 const amplitude=.9/Math.sqrt(Math.max(1,count))
 for(let channel=0;channel<2;channel++){
  const data=buffer.getChannelData(channel)
  for(let i=0;i<count;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0
   const t=i/count
   data[i]=((seed/0xffffffff)*2-1)*Math.pow(1-t,1.65)*amplitude
  }
  for(const [ms,level] of [[31,.12],[67,.075],[121,.045]]){
   const i=Math.round(ctx.sampleRate*ms/1000)
   if(i<count)data[i]+=level*(channel===0?1:-1)
  }
 }
 return buffer
}
export class TrackFxRack {
 readonly input:GainNode
 readonly bass:BiquadFilterNode
 readonly mid:BiquadFilterNode
 readonly treble:BiquadFilterNode
 readonly verb:ConvolverNode
 readonly dry:GainNode
 readonly wet:GainNode
 readonly output:GainNode
 private ctx:AudioContext
 private lastRoom=-1
 constructor(ctx:AudioContext,destination:AudioNode,settings:TrackFxSettings=DEFAULT_TRACK_FX){
  this.ctx=ctx
  this.input=ctx.createGain()
  this.bass=ctx.createBiquadFilter()
  this.bass.type='lowshelf';this.bass.frequency.value=180
  this.mid=ctx.createBiquadFilter()
  this.mid.type='peaking';this.mid.frequency.value=1050;this.mid.Q.value=.8
  this.treble=ctx.createBiquadFilter()
  this.treble.type='highshelf';this.treble.frequency.value=4500
  this.verb=ctx.createConvolver();this.verb.normalize=false
  this.dry=ctx.createGain();this.wet=ctx.createGain()
  this.output=ctx.createGain()
  this.input.connect(this.bass);this.bass.connect(this.mid);this.mid.connect(this.treble)
  this.treble.connect(this.dry);this.dry.connect(this.output)
  this.treble.connect(this.verb);this.verb.connect(this.wet);this.wet.connect(this.output)
  this.output.connect(destination)
  this.set(settings,false)
 }
 set(input:TrackFxSettings,bypass=false){
  const s=normalizeTrackFx(input),t=this.ctx.currentTime
  const ramp=(a:AudioParam,v:number)=>a.setTargetAtTime(v,t,.018)
  const active=s.enabled&&!bypass
  ramp(this.bass.gain,active?s.bassDb:0)
  ramp(this.mid.gain,active?s.midDb:0)
  ramp(this.treble.gain,active?s.trebleDb:0)
  const mix=trackFxMix(s,bypass)
  ramp(this.dry.gain,mix.dry)
  ramp(this.wet.gain,mix.wet)
  // Regenerate only if room size actually changes. UI updates on change, not every drag.
  if(this.lastRoom!==s.roomMs){
   this.verb.buffer=roomImpulse(this.ctx,s.roomMs)
   this.lastRoom=s.roomMs
  }
 }
 disconnect(){
  for(const node of [this.input,this.bass,this.mid,this.treble,this.verb,this.dry,this.wet,this.output]){
   try{node.disconnect()}catch{}
  }
 }
}
