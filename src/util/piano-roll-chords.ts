import type { MidiNoteEvent } from './midi-tracks'
export type ChordQuality='major'|'minor'|'dim'|'aug'|'sus2'|'sus4'|'7'|'maj7'|'m7'|'m7b5'|'dim7'
export const CHORD_INTERVALS: Record<ChordQuality,readonly number[]>={
 major:[0,4,7],minor:[0,3,7],dim:[0,3,6],aug:[0,4,8],
 sus2:[0,2,7],sus4:[0,5,7],
 '7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],m7b5:[0,3,6,10],dim7:[0,3,6,9]
}
export const CHORD_LABELS:Record<ChordQuality,string>={
 major:'Trưởng',minor:'Thứ',dim:'Giảm (dim)',aug:'Tăng (aug)',sus2:'Sus2',sus4:'Sus4',
 '7':'Dominant 7',maj7:'Major 7',m7:'Minor 7',m7b5:'Half-diminished',dim7:'Diminished 7'
}
export const CHORD_SUFFIXES:Record<ChordQuality,string>={
 major:'',minor:'m',dim:'dim',aug:'aug',sus2:'sus2',sus4:'sus4',
 '7':'7',maj7:'maj7',m7:'m7',m7b5:'m7♭5',dim7:'dim7'
}
const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
function classOf(midi:number){return ((midi%12)+12)%12}
export function chordNoteName(midi:number){return NAMES[classOf(midi)]+(Math.floor(midi/12)-1)}
export function chordName(root:number,quality:ChordQuality){return NAMES[classOf(Math.round(root))]+CHORD_SUFFIXES[quality]}
// Inversions raise the lowest chord tones by octaves. Shift the WHOLE voicing
// into the keyboard range to preserve intervals, never clamp tones individually.
export function chordPitches(root:number,quality:ChordQuality,octave:number,inversion:number,low=21,high=108):number[]{
 if(![root,octave,inversion,low,high].every(Number.isFinite))return []
 const intervals=CHORD_INTERVALS[quality]
 if(!intervals || octave<0 || octave>8 || !Number.isInteger(inversion) || inversion<0 || inversion>=intervals.length)return []
 if(root<0 || root>11 || !Number.isInteger(root))return []
 let pitches=intervals.map((interval,i)=>(octave+1)*12+root+interval+(i<inversion?12:0)).sort((a,b)=>a-b)
 // A chord shape wider than the supported keyboard cannot be represented.
 if(pitches[pitches.length-1]-pitches[0]>high-low)return []
 while(pitches[pitches.length-1]>high)pitches=pitches.map(n=>n-12)
 while(pitches[0]<low)pitches=pitches.map(n=>n+12)
 return pitches[0]>=low && pitches[pitches.length-1]<=high ? pitches : []
}
export function createChordNotes(pitches:readonly number[],time:number,duration:number,trackId:number,velocity=95):MidiNoteEvent[]{
 if(!Number.isFinite(time)||!Number.isFinite(duration)||duration<=0||!Number.isInteger(trackId))return []
 const start=Math.max(0,time)
 const length=Math.max(.04,duration)
 const strength=Math.max(1,Math.min(127,Math.round(Number.isFinite(velocity)?velocity:95)))/127
 return pitches.filter(midi=>Number.isInteger(midi)&&midi>=21&&midi<=108)
  .map(midi=>({midi,name:chordNoteName(midi),time:start,duration:length,velocity:strength,trackId}))
}
