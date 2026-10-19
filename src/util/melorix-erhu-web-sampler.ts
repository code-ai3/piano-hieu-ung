import {nearestErhuSample,readErhuSamples,storeErhuSamples,validateErhuSamples} from './melorix-erhu-sample-cache'

type Voice={stop:()=>void}
export class ErhuWebSampler {
 private bank=new Map<number,AudioBuffer>()
 private loading:Promise<void>|null=null
 get ready(){return this.bank.size===7}
 init():Promise<void>{
  if(this.loading)return this.loading
  this.loading=(async()=>{
   try{
    const cached=await readErhuSamples()
    if(!cached)return
    const decoder=new OfflineAudioContext(1,1,44100)
    const results=new Map<number,AudioBuffer>()
    for(const sample of cached.samples){
     const buf=await decoder.decodeAudioData(sample.bytes.slice(0))
     if(!buf.length||buf.duration<.02)throw Error('Invalid WAV')
     results.set(sample.rootMidi,buf)
    }
    if(results.size!==7)throw Error('Missing Erhu WAV')
    this.bank=results
   }catch(error){console.warn('Erhu web samples cannot load:',error)}
  })()
  return this.loading
 }
 async install(list:FileList):Promise<void>{
  const files=Array.from(list).filter(file=>/\.wav$/i.test(file.name))
  const error=validateErhuSamples(files)
  if(error)throw Error(error)
  await storeErhuSamples(files)
  this.loading=null
  await this.init()
  if(!this.ready)throw Error('Không giải mã được bộ WAV Erhu')
 }
 play(ctx:AudioContext,note:number,velocity:number,when:number,duration:number,onEnd:()=>void):Voice|null{
  const root=nearestErhuSample(note,[...this.bank.keys()])
  if(root===null)return null
  const sample=this.bank.get(root)
  if(!sample)return null
  const t=Math.max(ctx.currentTime+.003,when)
  const length=Math.max(.06,Number.isFinite(duration)?duration:.5)
  const source=ctx.createBufferSource(),gain=ctx.createGain()
  source.buffer=sample
  source.playbackRate.setValueAtTime(Math.pow(2,(note-root)/12),t)
  const level=Math.min(1,Math.max(.01,velocity/127))*.7
  gain.gain.setValueAtTime(.0001,t)
  gain.gain.linearRampToValueAtTime(level,t+.012)
  gain.gain.setValueAtTime(level,t+length)
  gain.gain.linearRampToValueAtTime(.0001,t+length+.1)
  source.connect(gain);gain.connect(ctx.destination)
  source.onended=()=>{onEnd();try{source.disconnect();gain.disconnect()}catch{}}
  source.start(t)
  source.stop(t+length+.12)
  return {stop:()=>{try{source.stop(Math.max(ctx.currentTime+.002,t+.001))}catch{}}}
 }
}
