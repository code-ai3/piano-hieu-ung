// Objective diagnostics for live WebAudio vs offline GM PCM.
// Values reflect the same instrument/note with no MP4 compression.
export type AudioFingerprint={
 peak:number;rms:number;onsetSeconds:number;attackRms:number;tailRms:number;
 centroidHz:number;lowEnergy:number;midEnergy:number;highEnergy:number
}
export function audioFingerprint(samples:Float32Array,sampleRate:number):AudioFingerprint{
 if(!samples.length||sampleRate<8000||!Number.isFinite(sampleRate))
  throw Error('Invalid PCM or sample rate')
 let peak=0,sum=0
 for(const x of samples){
  if(!Number.isFinite(x))throw Error('Nonfinite PCM')
  peak=Math.max(peak,Math.abs(x));sum+=x*x
 }
 const rms=Math.sqrt(sum/samples.length)
 const threshold=Math.max(.00008,peak*.055)
 let onset=samples.findIndex(x=>Math.abs(x)>=threshold)
 if(onset<0)onset=0
 const range=(after:number,duration:number)=>{
  const from=Math.min(samples.length,Math.max(0,onset+Math.round(after*sampleRate)))
  const end=Math.min(samples.length,from+Math.round(duration*sampleRate))
  let square=0
  for(let i=from;i<end;i++)square+=samples[i]*samples[i]
  return Math.sqrt(square/Math.max(1,end-from))
 }
 const attackRms=range(.03,.35),tailRms=range(.67,.26)
 // Hann-window DFT. Spectrum derived from identical sample rate and time
 // relative to detected onset, not absolute AudioContext start time.
 const N=512
 const at=Math.min(Math.max(0,onset+Math.floor(.12*sampleRate)),Math.max(0,samples.length-N))
 let low=0,mid=0,high=0,weighted=0,energy=0
 for(let k=1;k<N/2;k++){
  let re=0,im=0
  for(let n=0;n<N;n++){
   const x=(samples[at+n]??0)*(.5-.5*Math.cos(2*Math.PI*n/(N-1)))
   const angle=2*Math.PI*k*n/N
   re+=x*Math.cos(angle);im-=x*Math.sin(angle)
  }
  const p=re*re+im*im,f=k*sampleRate/N
  if(f<500)low+=p
  else if(f<3000)mid+=p
  else high+=p
  weighted+=p*f;energy+=p
 }
 const total=energy||1
 return {peak,rms,onsetSeconds:onset/sampleRate,attackRms,tailRms,
  centroidHz:weighted/total,lowEnergy:low/total,midEnergy:mid/total,highEnergy:high/total}
}
export function compareAudioFingerprints(a:AudioFingerprint,b:AudioFingerprint){
 const ratio=(x:number,y:number)=>Math.min(x,y)/Math.max(x,y,1e-9)
 return {
  attackRatio:ratio(a.attackRms,b.attackRms),
  tailRatio:ratio(a.tailRms,b.tailRms),
  centroidRatio:ratio(a.centroidHz,b.centroidHz),
  lowBandDifference:Math.abs(a.lowEnergy-b.lowEnergy),
  midBandDifference:Math.abs(a.midEnergy-b.midEnergy),
  highBandDifference:Math.abs(a.highEnergy-b.highEnergy)
 }
}
