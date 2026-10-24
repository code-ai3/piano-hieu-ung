import type {MidiNoteEvent} from './midi-tracks.ts'

// H.2: Sliding time-window index for *sequential* 30 FPS MP4 export frames.
// Do not traverse the entire MIDI song for every video frame. The notes
// list and order remain unchanged; this index is only for rasterization.
type Entry={note:MidiNoteEvent;ordinal:number;start:number;visibleEnd:number}
export function makeExportNoteFrameIndex(notes:readonly MidiNoteEvent[]){
 const starts:Entry[]=notes.filter(n=>Number.isFinite(n.time)&&Number.isFinite(n.duration)&&n.duration>0)
  .map((note,ordinal)=>({
   note,ordinal,start:note.time,
   // Smoke trails may outlive the note release; never clip visual FX.
   visibleEnd:note.time+Math.max(.05,note.duration)+Math.max(.4,Math.max(.05,note.duration)*.85)
  })).sort((a,b)=>a.start-b.start||a.ordinal-b.ordinal)
 const finishes=[...starts].sort((a,b)=>a.visibleEnd-b.visibleEnd||a.ordinal-b.ordinal)
 let added=0,removed=0,pressed=0,lastTime=-Infinity
 const visible=new Set<Entry>()
 const latest=new Map<number,MidiNoteEvent>()
 function reset(){added=0;removed=0;pressed=0;lastTime=-Infinity;visible.clear();latest.clear()}
 function at(bottom:number,lookahead:number){
  if(!Number.isFinite(bottom)||!Number.isFinite(lookahead)||lookahead<0)
   throw Error('Invalid export frame window')
  if(bottom<lastTime)reset()
  lastTime=bottom
  const top=bottom+lookahead
  while(added<starts.length&&starts[added].start<=top){
   visible.add(starts[added++])
  }
  while(removed<finishes.length&&finishes[removed].visibleEnd<bottom){
   visible.delete(finishes[removed++])
  }
  while(pressed<starts.length&&starts[pressed].start<=bottom){
   const entry=starts[pressed++]
   latest.set(entry.note.midi,entry.note)
  }
  // Preserve original MIDI source order for effect layering and ties.
  return {
   visibleNotes:[...visible].sort((a,b)=>a.ordinal-b.ordinal).map(e=>e.note),
   latestPress:latest
  }
 }
 return {at,reset,noteCount:starts.length}
}
