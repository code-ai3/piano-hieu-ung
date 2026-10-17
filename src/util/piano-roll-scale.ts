import type { MidiNoteEvent } from './midi-tracks'
export type ScaleMode='major'|'naturalMinor'|'harmonicMinor'|'dorian'|'mixolydian'|'majorPentatonic'|'minorPentatonic'
export const SCALE_TYPES:Record<ScaleMode,readonly number[]>={
 major:[0,2,4,5,7,9,11],
 naturalMinor:[0,2,3,5,7,8,10],
 harmonicMinor:[0,2,3,5,7,8,11],
 dorian:[0,2,3,5,7,9,10],
 mixolydian:[0,2,4,5,7,9,10],
 majorPentatonic:[0,2,4,7,9],
 minorPentatonic:[0,3,5,7,10]
}
const PITCH_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
export function scalePitchClass(midi:number){return ((Math.round(midi)%12)+12)%12}
export function isPitchInScale(midi:number,root:number,mode:ScaleMode):boolean{
 if(!Number.isFinite(midi)||!Number.isFinite(root))return false
 return SCALE_TYPES[mode].includes((scalePitchClass(midi)-scalePitchClass(root)+12)%12)
}
export function isScaleRoot(midi:number,root:number){return scalePitchClass(midi)===scalePitchClass(root)}
// Nearest allowed semitone, ties favor the lower pitch; never leave the 88-key range.
export function snapPitchToScale(pitch:number,root:number,mode:ScaleMode,low=21,high=108):number{
 const min=Math.ceil(low),max=Math.floor(high)
 if(!Number.isFinite(pitch)||min>max)return min
 const from=Math.max(min,Math.min(max,Math.round(pitch)))
 if(isPitchInScale(from,root,mode))return from
 for(let distance=1;distance<=12;distance++){
  if(from-distance>=min&&isPitchInScale(from-distance,root,mode))return from-distance
  if(from+distance<=max&&isPitchInScale(from+distance,root,mode))return from+distance
 }
 return from
}
function midiName(midi:number){return PITCH_NAMES[scalePitchClass(midi)]+(Math.floor(midi/12)-1)}
export function correctMidiNotesToScale(notes:readonly MidiNoteEvent[],indices:readonly number[],root:number,mode:ScaleMode,low=21,high=108):MidiNoteEvent[]{
 const selected=new Set(indices)
 return notes.map((n,i)=>{
  if(!selected.has(i))return {...n}
  const midi=snapPitchToScale(n.midi,root,mode,low,high)
  return midi===n.midi?{...n}:{...n,midi,name:midiName(midi)}
 })
}
