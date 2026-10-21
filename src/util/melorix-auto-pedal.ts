// MELORIX Auto Pedal: deterministic, editable CC64 suggestions.
// The inference is heuristic (not recognition of a pianist's artistic intent).
// Nothing mutates the original MIDI until the user explicitly applies changes.
export type PedalMode='light'|'natural'|'deep'
export type PedalPoint={time:number;value:0|127}
export type PianoEvent={midi:number;time:number;duration:number}

const profiles:Record<PedalMode,{maxBeats:number;gapBeats:number;changeLead:number}>={
 light:{maxBeats:1,gapBeats:.22,changeLead:.065},
 natural:{maxBeats:2,gapBeats:.42,changeLead:.04},
 deep:{maxBeats:4,gapBeats:.75,changeLead:.025}
}

export function normalizePedalPoints(points:readonly {time:number;value:number}[]):PedalPoint[]{
 const ordered=points.filter(p=>Number.isFinite(p.time)&&p.time>=0&&Number.isFinite(p.value))
  .map(p=>({time:p.time,value:(p.value>=64?127:0) as 0|127}))
  .sort((a,b)=>a.time-b.time||a.value-b.value)
 const result:PedalPoint[]=[]
 let prev:0|127=0
 for(const p of ordered){
  if(p.value===prev)continue
  result.push(p)
  prev=p.value
 }
 // Never leave an imported/generated sustain on forever.
 if(prev===127)result.push({time:result[result.length-1].time+.12,value:0})
 return result
}
export function pedalIntervals(points:readonly PedalPoint[],end:number):{start:number;end:number}[]{
 const ranges:{start:number;end:number}[]=[]
 let begin:number|null=null
 for(const p of normalizePedalPoints(points)){
  if(p.value===127)begin=p.time
  else if(begin!==null){ranges.push({start:begin,end:Math.min(Math.max(begin,p.time),end)});begin=null}
 }
 return ranges.filter(r=>r.end>r.start)
}
export function suggestAutoPedal(notes:readonly PianoEvent[],mode:PedalMode,bpm:number):PedalPoint[]{
 const profile=profiles[mode]
 if(!profile)return []
 const beat=60/(Number.isFinite(bpm)&&bpm>15&&bpm<400?bpm:120)
 const source=notes.filter(n=>Number.isInteger(n.midi)&&n.midi>=0&&n.midi<=127&&
  Number.isFinite(n.time)&&n.time>=0&&Number.isFinite(n.duration)&&n.duration>.02)
  .sort((a,b)=>a.time-b.time||a.midi-b.midi)
 if(!source.length)return []
 // Treat near-simultaneous onset notes as one chord, rather than toggling
 // pedal several times while a single hand is playing the same chord.
 const groups:{time:number;lowest:number;last:number;count:number}[]=[]
 for(const note of source){
  const group=groups[groups.length-1]
  if(group&&note.time-group.time<=.065){
   group.lowest=Math.min(group.lowest,note.midi)
   group.last=Math.max(group.last,note.time+note.duration)
   group.count++
  }else groups.push({time:note.time,lowest:note.midi,last:note.time+note.duration,count:1})
 }
 const result:PedalPoint[]=[]
 const maxOn=profile.maxBeats*beat
 let on:number|null=null
 let lastOn=-1
 const close=(time:number)=>{
  if(on===null)return
  const end=Math.max(on+.08,time)
  result.push({time:Math.round(end*1000)/1000,value:0})
  on=null
 }
 for(let i=0;i<groups.length;i++){
  const g=groups[i],next=groups[i+1]
  const desired=g.time+.025
  if(on===null){
   on=desired
   result.push({time:Math.round(on*1000)/1000,value:127})
   lastOn=on
  }
  const harmonicShift=next?g.count>=2&&next.count>=2&&
   (g.lowest%12)!==(next.lowest%12):false
  const gap=next?Math.max(0,next.time-g.last):0
  const cap=lastOn+maxOn
  if(!next){
   close(Math.min(cap,Math.max(g.last+.08,desired+.12)))
  }else if(harmonicShift||gap>profile.gapBeats*beat||next.time>=cap){
   // Release slightly BEFORE the next chord attack. Never roll across a
   // large silent gap or a change of harmonic bass, even in Deep mode.
   close(Math.min(cap,next.time-profile.changeLead))
  }
 }
 return normalizePedalPoints(result)
}
