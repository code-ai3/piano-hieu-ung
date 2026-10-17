import type { MidiNoteEvent } from './midi-tracks'

export function velocityNumber(value: number): number {
  return Math.max(1, Math.min(127, Math.round(Number.isFinite(value) ? value : 80)))
}
function selectedSet(indices: readonly number[]) { return new Set(indices) }
function applyValues(notes: readonly MidiNoteEvent[], indices: readonly number[], fn: (note: MidiNoteEvent, index: number) => number): MidiNoteEvent[] {
  const selected = selectedSet(indices)
  return notes.map((n, i) => selected.has(i) ? { ...n, velocity: velocityNumber(fn(n, i)) / 127 } : { ...n })
}
export function setMidiVelocities(notes: readonly MidiNoteEvent[], indices: readonly number[], value: number): MidiNoteEvent[] {
  return applyValues(notes, indices, () => value)
}
export function shiftMidiVelocities(notes: readonly MidiNoteEvent[], indices: readonly number[], delta: number): MidiNoteEvent[] {
  return applyValues(notes, indices, n => velocityNumber(n.velocity * 127) + (Number.isFinite(delta) ? Math.round(delta) : 0))
}
export function rampMidiVelocities(notes: readonly MidiNoteEvent[], indices: readonly number[], from: number, to: number): MidiNoteEvent[] {
  const times = indices.map(i => notes[i]?.time).filter((v): v is number => Number.isFinite(v))
  if (!times.length) return notes.map(n=>({ ...n }))
  const first=Math.min(...times), last=Math.max(...times), span=last-first
  return applyValues(notes, indices, n => span > 0 ? from+(to-from)*(n.time-first)/span : from)
}
// Seeded, bounded variation: reproducible for QA, a new seed on each UI click.
export function humanizeMidiVelocities(notes: readonly MidiNoteEvent[], indices: readonly number[], amount: number, seed=0): MidiNoteEvent[] {
  const strength=Math.max(0,Math.min(40,Math.round(Number.isFinite(amount)?amount:0)))
  if (!strength) return notes.map(n=>({ ...n }))
  return applyValues(notes,indices,(n,i)=>{
    let h=(Math.imul(Math.round(n.time*10000),1664525)^Math.imul(n.midi+1,1013904223)^Math.imul(n.trackId+1,69069)^Math.imul(i+1,2246822519)^Math.imul(seed+1,3266489917))>>>0
    h=Math.imul(h^(h>>>16),2246822507)>>>0
    h=Math.imul(h^(h>>>13),3266489909)>>>0
    const offset=(h%(strength*2+1))-strength
    return velocityNumber(n.velocity*127)+offset
  })
}
// Draw a straight line in the velocity lane; ONLY note onsets within its X range change.
export function drawMidiVelocityLine(notes: readonly MidiNoteEvent[], indices: readonly number[], startTime: number, endTime: number, startValue: number, endValue: number): MidiNoteEvent[] {
  if (![startTime,endTime,startValue,endValue].every(Number.isFinite)) return notes.map(n=>({ ...n }))
  const selected=selectedSet(indices)
  const left=Math.min(startTime,endTime),right=Math.max(startTime,endTime),span=endTime-startTime
  return notes.map((n,i)=>{
    if (!selected.has(i)||n.time<left-1e-9||n.time>right+1e-9) return { ...n }
    const fraction=Math.abs(span)<1e-9?0:Math.max(0,Math.min(1,(n.time-startTime)/span))
    const value=startValue+(endValue-startValue)*fraction
    return { ...n, velocity:velocityNumber(value)/127 }
  })
}
