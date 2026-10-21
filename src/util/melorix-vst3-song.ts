// GĐ3C1. Single-track VST3 MIDI playback via WASAPI, not sample-accurate.
export type SongNote={trackId:number;midi:number;velocity:number;time:number;duration:number}
export type Vst3NotePort={sendLiveVst3Note:(track:number,pitch:number,velocity:number)=>Promise<unknown>}
type Event={time:number;pitch:number;velocity:number;on:boolean}
export class Vst3SongScheduler {
 private events:Event[]=[]
 private cursor=0
 private track:number|null=null
 private active=new Set<number>()
 private pending:Promise<void>=Promise.resolve()
 private port:Vst3NotePort
 private onError:(message:string)=>void
 constructor(port:Vst3NotePort,onError:(message:string)=>void=()=>{}){this.port=port;this.onError=onError}
 private send(track:number,pitch:number,velocity:number){
  // Serialize host commands to preserve note-off before restarting.
  this.pending=this.pending.then(async()=>{await this.port.sendLiveVst3Note(track,pitch,velocity)})
   .catch(error=>{this.onError(error instanceof Error?error.message:String(error))})
 }
 isPlayingTrack(id:number){return this.track===id}
 start(notes:readonly SongNote[],id:number,position:number){
  this.stop()
  if(!Number.isInteger(id)||id<0||!Number.isFinite(position))return
  const events:Event[]=[]
  for(const n of notes){
   if(n.trackId!==id||!Number.isInteger(n.midi)||n.midi<0||n.midi>127||
     !Number.isFinite(n.time)||n.time<0||!Number.isFinite(n.duration)||n.duration<=0||
     !Number.isFinite(n.velocity))continue
   const velocity=Math.max(1,Math.min(127,Math.round(n.velocity*127)))
   events.push({time:n.time,pitch:n.midi,velocity,on:true})
   events.push({time:n.time+n.duration,pitch:n.midi,velocity:0,on:false})
  }
  events.sort((a,b)=>a.time-b.time||Number(a.on)-Number(b.on)||a.pitch-b.pitch)
  this.events=events
  this.cursor=events.findIndex(e=>e.time>=position-.01)
  if(this.cursor<0)this.cursor=events.length
  this.track=id
 }
 tick(position:number){
  if(this.track===null||!Number.isFinite(position))return
  while(this.cursor<this.events.length&&this.events[this.cursor].time<=position){
   const e=this.events[this.cursor++]
   // Do not burst-play stale NoteOns if a browser tab froze.
   if(e.on&&e.time<position-.2)continue
   if(e.on)this.active.add(e.pitch)
   else this.active.delete(e.pitch)
   this.send(this.track,e.pitch,e.velocity)
  }
 }
 stop(){
  const track=this.track
  this.track=null;this.events=[];this.cursor=0
  if(track!==null)for(const pitch of this.active)this.send(track,pitch,0)
  this.active.clear()
 }
}
