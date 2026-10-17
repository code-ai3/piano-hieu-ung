import type { MidiNoteEvent } from './midi-tracks'
import { midiNoteName } from './midi-edit'
export function cloneNotes(notes: readonly MidiNoteEvent[]): MidiNoteEvent[] {
  return notes.map(n => ({ ...n }))
}
export function sameNotes(a: readonly MidiNoteEvent[], b: readonly MidiNoteEvent[]): boolean {
  return a.length === b.length && a.every((n, i) =>
    n.midi === b[i].midi && n.time === b[i].time && n.duration === b[i].duration &&
    n.velocity === b[i].velocity && n.trackId === b[i].trackId)
}
// Clipboard notes are relative to the first note, so paste aligns to the playhead.
export function copyMidiNotes(notes: readonly MidiNoteEvent[], indices: readonly number[]): MidiNoteEvent[] {
  const selected = indices.map(i => notes[i]).filter((n): n is MidiNoteEvent => n !== undefined)
  if (!selected.length) return []
  const start = Math.min(...selected.map(n => n.time))
  return selected.map(n => ({ ...n, time: n.time - start }))
}
export function pasteMidiNotes(clipboard: readonly MidiNoteEvent[], trackId: number, time: number): MidiNoteEvent[] {
  return clipboard.map(n => ({ ...n, trackId, time: Math.max(0, time) + n.time }))
}
export function moveMidiNotes(notes: readonly MidiNoteEvent[], indices: readonly number[], deltaTime: number, deltaPitch: number): MidiNoteEvent[] {
  const set = new Set(indices)
  const chosen = notes.filter((_, i) => set.has(i))
  if (!chosen.length) return cloneNotes(notes)
  const timeOffset = Math.max(-Math.min(...chosen.map(n => n.time)), deltaTime)
  const pitchOffset = Math.max(21 - Math.min(...chosen.map(n => n.midi)),
    Math.min(108 - Math.max(...chosen.map(n => n.midi)), deltaPitch))
  return notes.map((n, i) => {
    if (!set.has(i)) return { ...n }
    const midi = Math.round(n.midi + pitchOffset)
    return { ...n, midi, name: midiNoteName(midi), time: Math.max(0, n.time + timeOffset) }
  })
}
export interface MidiBox { x1:number; x2:number; y1:number; y2:number }
export function selectMidiInBox(notes: readonly MidiNoteEvent[], box: MidiBox, pxPerSecond: number, keyWidth: number, highPitch: number, rowHeight: number): number[] {
  const left = Math.min(box.x1,box.x2), right = Math.max(box.x1,box.x2)
  const top = Math.min(box.y1,box.y2), bottom = Math.max(box.y1,box.y2)
  return notes.flatMap((n,i) => {
    const x = keyWidth + n.time * pxPerSecond
    const end = x + Math.max(5, n.duration * pxPerSecond)
    const y = (highPitch - n.midi) * rowHeight
    return x <= right && end >= left && y <= bottom && y + rowHeight >= top ? [i] : []
  })
}
