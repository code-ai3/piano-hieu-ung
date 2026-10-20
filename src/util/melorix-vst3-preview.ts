// MELORIX Desktop: playback of uncompressed PCM returned from the actual
// native VST3 audio processor. Does not synthesize GM fallback and writes no
// temporary audio files to C:. Windows output uses Chromium AudioContext;
// native low-latency WASAPI/ASIO remains a separate 3C milestone.
export type Vst3AuditionResult={
 audioBase64:string;peak:number;nonzeroSamples:number;track:number
 format:'wav-f32';source:'vst3-process'
}
export type Vst3PreviewApi={
 auditionVst3Note:(track:number,pitch:number,velocity:number,durationMs:number)=>Promise<Vst3AuditionResult>
}
export class Vst3PreviewPlayer {
 private ctx:AudioContext|null=null
 private source:AudioBufferSourceNode|null=null
 private generation=0
 async warmup():Promise<void>{
  if(!this.ctx)this.ctx=new AudioContext()
  if(this.ctx.state!=='running')await this.ctx.resume()
 }
 async play(api:Vst3PreviewApi,track:number,pitch:number,velocity=100,durationMs=550):Promise<Vst3AuditionResult>{
  const request=++this.generation
  await this.warmup()
  const result=await api.auditionVst3Note(track,pitch,velocity,durationMs)
  if(result.source!=='vst3-process'||result.format!=='wav-f32')
   throw new Error('Nguồn âm thanh không phải PCM từ VST3')
  if(!result.audioBase64||result.audioBase64.length>5*1024*1024)
   throw new Error('Dữ liệu VST3 quá lớn hoặc trống')
  const bytes=Uint8Array.from(atob(result.audioBase64),c=>c.charCodeAt(0))
  if(bytes.byteLength<44||String.fromCharCode(...bytes.subarray(0,4))!=='RIFF')
   throw new Error('Âm thanh VST3 không phải WAV')
  const audio=await this.ctx!.decodeAudioData(bytes.buffer as ArrayBuffer)
  if(request!==this.generation)return result
  this.stop(false)
  const node=this.ctx!.createBufferSource()
  node.buffer=audio
  node.connect(this.ctx!.destination)
  node.onended=()=>{if(this.source===node)this.source=null;try{node.disconnect()}catch{}}
  this.source=node
  node.start()
  return result
 }
 stop(cancelPending=true){
  if(cancelPending)++this.generation
  if(this.source){
   try{this.source.stop()}catch{}
   try{this.source.disconnect()}catch{}
   this.source=null
  }
 }
 async dispose(){
  this.stop()
  const ctx=this.ctx;this.ctx=null
  if(ctx&&ctx.state!=='closed')await ctx.close()
 }
}
