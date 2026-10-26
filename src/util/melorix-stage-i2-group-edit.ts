import type { MidiNoteEvent } from './midi-tracks'
import { cloneNotes, moveMidiNotes } from './piano-roll-selection.ts'

/** Resize the ends of all selected MIDI notes by the same number of seconds.
 * Clamp each note separately, preserve note start, pitch, velocity and track.
 * Uses an immutable snapshot for predictable drag preview + single undo. */
export function resizeSelectedMidiNotes(
 notes:readonly MidiNoteEvent[],indices:readonly number[],seconds:number,minDuration=.04
):MidiNoteEvent[]{
 if(!Number.isFinite(seconds))return cloneNotes(notes)
 const chosen=new Set(indices.filter(i=>Number.isInteger(i)&&i>=0&&i<notes.length))
 return notes.map((n,i)=>chosen.has(i)?{...n,duration:Math.max(minDuration,n.duration+seconds)}:{...n})
}

/** Construct new notes for Alt+drag. Never mutates original notes. Keeps
 * relative spacing, MIDI pitches, velocities and track assignments intact. */
export function duplicateDraggedMidiNotes(
 notes:readonly MidiNoteEvent[],indices:readonly number[],deltaSeconds:number,deltaPitch:number
):MidiNoteEvent[]{
 const chosen=[...new Set(indices)].filter(i=>Number.isInteger(i)&&i>=0&&i<notes.length)
 if(!chosen.length)return []
 const moved=moveMidiNotes(notes,chosen,deltaSeconds,deltaPitch)
 return chosen.map(i=>({...moved[i]}))
}

/** One grid step in either direction, keeping group alignment and pitch safe. */
export function nudgeSelectedMidiNotes(
 notes:readonly MidiNoteEvent[],indices:readonly number[],
 direction:'left'|'right'|'up'|'down',gridSeconds:number
):MidiNoteEvent[]{
 const step=Number.isFinite(gridSeconds)&&gridSeconds>.0001?gridSeconds:.05
 const deltaTime=direction==='left'?-step:direction==='right'?step:0
 const deltaPitch=direction==='up'?1:direction==='down'?-1:0
 return moveMidiNotes(notes,indices,deltaTime,deltaPitch)
}
