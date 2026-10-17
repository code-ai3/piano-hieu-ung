export function clampMidiVelocity(n: number): number { return Math.max(1, Math.min(127, Math.round(n))) }
export function midiNoteName(m: number): string { const notes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; return notes[m%12]+(Math.floor(m/12)-1) }
export function snapMidiTime(t: number, step: number): number { return step > 0 ? Math.max(0,Math.round(t/step)*step) : Math.max(0,t) }
