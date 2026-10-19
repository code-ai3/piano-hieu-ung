export interface TimedMidiEvent {
 note: number
 channel: number
 velocity: number
 start: number
 duration: number
}
// The MIDI protocol has only per-channel pitches: an overlapping Note Off for the
// same pitch can silence a still-playing note. Coalesce only truly overlapping notes.
export function mergeOverlappingMidiNotes(events: readonly TimedMidiEvent[]): TimedMidiEvent[] {
 const candidates=events
  .filter(e=>Number.isInteger(e.note)&&e.note>=0&&e.note<=127
   &&Number.isInteger(e.channel)&&e.channel>=0&&e.channel<=15
   &&Number.isFinite(e.start)&&e.start>=0&&Number.isFinite(e.duration)&&e.duration>0)
  .map(e=>({...e}))
  .sort((a,b)=>a.channel-b.channel||a.note-b.note||a.start-b.start)
 const merged:TimedMidiEvent[]=[]
 for(const e of candidates){
  const previous=merged[merged.length-1]
  if(previous&&previous.channel===e.channel&&previous.note===e.note
     &&e.start<previous.start+previous.duration){
   previous.duration=Math.max(previous.start+previous.duration,e.start+e.duration)-previous.start
   previous.velocity=Math.max(previous.velocity,e.velocity)
  }else merged.push(e)
 }
 return merged.sort((a,b)=>a.start-b.start||a.channel-b.channel||a.note-b.note)
}
