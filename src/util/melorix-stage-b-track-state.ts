import type {MidiNoteEvent} from './midi-tracks'
import type {PedalPoint} from './melorix-auto-pedal'

// Each track owns its own Undo/Redo snapshots. Restoring a track must never
// overwrite edits, sustain or pan already committed on any other track.
export type TrackAudioSnapshot={
 notes:MidiNoteEvent[]
 pedal:PedalPoint[]
 pan:number
}
export function snapshotAudioTrack(
 notes:readonly MidiNoteEvent[],trackId:number,
 pedal:readonly PedalPoint[],pan:number
):TrackAudioSnapshot{
 return {
  notes:notes.filter(n=>n.trackId===trackId).map(n=>({...n})),
  pedal:pedal.map(p=>({...p})),
  pan
 }
}
export function restoreAudioTrack(
 notes:readonly MidiNoteEvent[],trackId:number,snapshot:TrackAudioSnapshot
):MidiNoteEvent[]{
 return [
  ...notes.filter(n=>n.trackId!==trackId),
  ...snapshot.notes.map(n=>({...n,trackId}))
 ].sort((a,b)=>a.time-b.time||a.midi-b.midi||a.trackId-b.trackId)
}
