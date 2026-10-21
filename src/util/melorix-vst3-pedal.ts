// CC64 events for the single active native VST3 track, alongside MIDI notes.
export type SustainEvent={time:number;value:number}
export type SustainPort={sendLiveVst3Pedal:(track:number,value:number)=>Promise<unknown>}
export class Vst3PedalScheduler {
 private track:number|null=null
 private events:SustainEvent[]=[]
 private index=0
 private down=false
 private queue:Promise<void>=Promise.resolve()
 private port:SustainPort
 private onError:(message:string)=>void
 constructor(port:SustainPort,onError:(message:string)=>void=()=>{}){this.port=port;this.onError=onError}
 private send(track:number,value:number){
  this.queue=this.queue.then(async()=>{await this.port.sendLiveVst3Pedal(track,value)})
   .catch(e=>this.onError(e instanceof Error?e.message:String(e)))
 }
 start(track:number,events:readonly SustainEvent[],seconds:number){
  this.stop()
  if(!Number.isSafeInteger(track)||track<0||!Number.isFinite(seconds))return
  this.track=track
  this.events=[...events].filter(e=>Number.isFinite(e.time)&&e.time>=0&&Number.isFinite(e.value))
   .sort((a,b)=>a.time-b.time)
  this.index=this.events.findIndex(e=>e.time>seconds)
  if(this.index<0)this.index=this.events.length
  const previous=this.events[this.index-1]
  if(previous?.value>=64){this.send(track,127);this.down=true}
 }
 tick(seconds:number){
  if(this.track===null||!Number.isFinite(seconds))return
  while(this.index<this.events.length&&this.events[this.index].time<=seconds){
   const value=this.events[this.index++].value>=64?127:0
   if(this.down===(value===127))continue
   this.send(this.track,value);this.down=value===127
  }
 }
 stop(){
  if(this.track!==null&&this.down)this.send(this.track,0)
  this.track=null;this.events=[];this.index=0;this.down=false
 }
}
