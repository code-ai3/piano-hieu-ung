import type {MidiNoteEvent,MidiPart} from './midi-tracks'

// Keep stable track IDs so Kontakt channels, sound banks and piano roll note
// references never silently jump to a different instrument after deletion.
export function removeMidiTrack(
 parts:readonly MidiPart[],
 notes:readonly MidiNoteEvent[],
 removedId:number,
 selectedId:number|null
):{parts:MidiPart[];notes:MidiNoteEvent[];selectedId:number|null}{
 const index=parts.findIndex(p=>p.id===removedId)
 if(index===-1)return {parts:[...parts],notes:[...notes],selectedId}
 const remaining=parts.filter(p=>p.id!==removedId)
 const remainingNotes=notes.filter(n=>n.trackId!==removedId)
 const fallback=remaining[Math.min(index,remaining.length-1)]?.id??null
 const nextSelected=selectedId===removedId
  ?fallback
  :remaining.some(p=>p.id===selectedId)?selectedId:fallback
 return {parts:remaining,notes:remainingNotes,selectedId:nextSelected}
}

export function omitTrackSetting<T>(settings:Readonly<Record<number,T>>,id:number):Record<number,T>{
 const updated={...settings}
 delete updated[id]
 return updated
}
