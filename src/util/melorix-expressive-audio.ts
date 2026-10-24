// Playback-only expression. The source MIDI (time, notes, velocity) is never rewritten.
export type ExpressionMode='original'|'natural'|'warm'
export const EXPRESSION_LABELS:Record<ExpressionMode,string>={
 original:'Nguyên bản MIDI',natural:'Tự nhiên',warm:'Ấm và sâu'
}
export function isExpressionMode(value:string):value is ExpressionMode{
 return value==='original'||value==='natural'||value==='warm'
}
export function expressedVelocity(velocity:number,onsetSeconds:number,bpm:number,mode:ExpressionMode):number{
 const original=Math.max(1,Math.min(127,Math.round(Number.isFinite(velocity)?velocity:95)))
 if(mode==='original'||!Number.isFinite(onsetSeconds)||!Number.isFinite(bpm)||bpm<=0)return original
 // Musical accent from existing beat grid; fully deterministic and no note timing changes.
 const beat=onsetSeconds/(60/bpm)
 const bar=((beat%4)+4)%4
 const firstBeat=Math.exp(-Math.pow(Math.min(bar,4-bar)/.18,2))
 const thirdBeat=Math.exp(-Math.pow((bar-2)/.19,2))
 const offBeat=Math.exp(-Math.pow(Math.abs(beat-Math.round(beat+0.5)+0.5)/.16,2))
 const strength=mode==='warm'?.19:.11
 const multiplier=1+strength*(.55*firstBeat+.2*thirdBeat-.2*offBeat-.08)
 return Math.max(1,Math.min(127,Math.round(original*multiplier)))
}

// Per-AudioContext dry/ambience master. A short, low-pass reverberation makes
// sample instruments less sterile but retains transients and stereo separation.
export class ExpressiveAudioMaster{
 readonly input:GainNode
 private wet:GainNode
 private dryOriginal:GainNode
 private dryProcessed:GainNode
 private filter:BiquadFilterNode
 private mode:ExpressionMode
 constructor(ctx:BaseAudioContext,mode:ExpressionMode,immediate=false){
  this.mode=mode
  this.input=ctx.createGain()
  const compressor=ctx.createDynamicsCompressor()
  compressor.threshold.value=-8
  compressor.knee.value=12
  compressor.ratio.value=1.6
  compressor.attack.value=.009
  compressor.release.value=.21
  // "Nguyên bản MIDI" must bypass dynamics and reverb entirely.
  this.dryOriginal=ctx.createGain()
  this.dryProcessed=ctx.createGain()
  this.dryOriginal.gain.value=0
  this.dryProcessed.gain.value=0
  this.input.connect(this.dryOriginal)
  this.dryOriginal.connect(ctx.destination)
  this.input.connect(this.dryProcessed)
  this.dryProcessed.connect(compressor)
  compressor.connect(ctx.destination)
  const impulse=ctx.createBuffer(2,Math.round(ctx.sampleRate*1.15),ctx.sampleRate)
  let seed=0x13a73
  for(let ch=0;ch<2;ch++){
   const data=impulse.getChannelData(ch)
   for(let i=0;i<data.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0
    const t=i/data.length
    data[i]=((seed/0xffffffff)*2-1)*Math.pow(1-t,2.4)*.3
   }
  }
  const verb=ctx.createConvolver()
  verb.buffer=impulse
  this.filter=ctx.createBiquadFilter()
  this.filter.type='lowpass'
  this.filter.frequency.value=4200
  this.wet=ctx.createGain()
  this.input.connect(verb)
  verb.connect(this.filter)
  this.filter.connect(this.wet)
  this.wet.connect(compressor)
  this.setMode(ctx,mode,immediate)
 }
 setMode(ctx:BaseAudioContext,mode:ExpressionMode,immediate=false){
  this.mode=mode
  // Offline render starts at audio time zero; its first transient must not
  // lose attack energy to realtime-friendly 18–40ms ramp-up.
  const set=(param:AudioParam,value:number,tau:number)=>{
   if(immediate)param.setValueAtTime(value,ctx.currentTime)
   else param.setTargetAtTime(value,ctx.currentTime,tau)
  }
  const wet=mode==='original'?0:mode==='natural'?.18:.31
  set(this.dryOriginal.gain,mode==='original'?1:0,.018)
  set(this.dryProcessed.gain,mode==='original'?0:1,.018)
  set(this.wet.gain,wet,.04)
  set(this.filter.frequency,mode==='warm'?3000:4200,.04)
 }
 get currentMode(){return this.mode}
 disconnect(){this.input.disconnect();this.wet.disconnect();this.filter.disconnect();this.dryOriginal.disconnect();this.dryProcessed.disconnect()}
}
