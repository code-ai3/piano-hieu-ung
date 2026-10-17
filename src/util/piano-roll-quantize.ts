import type { MidiNoteEvent } from './midi-tracks'

// 4 = quarter, 12 = eighth triplet, 24 = sixteenth triplet.
export function midiGridStep(bpm: number, division: number): number {
  if (!Number.isFinite(bpm) || !Number.isFinite(division) || bpm <= 0 || division <= 0) return 0
  return 240 / Math.max(20, bpm) / division
}

function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
}

export function nearestSwingGridTime(time: number, step: number, swing = 0): number {
  if (!Number.isFinite(time)) return 0
  if (!Number.isFinite(step) || step <= 0) return Math.max(0, time)
  const source = Math.max(0, time)
  const base = Math.floor(source / step)
  const swingOffset = step * .5 * clampPercent(swing) / 100
  let best = 0, distance = Infinity
  // Compare adjacent straight AND delayed offbeat grid lines.
  for (let index = Math.max(0, base - 2); index <= base + 3; index++) {
    const target = index * step + (index % 2 ? swingOffset : 0)
    const diff = Math.abs(source - target)
    if (diff < distance) { best = target; distance = diff }
  }
  return best
}

export interface MidiQuantizeOptions {
  bpm: number
  division: number
  strength: number
  swing: number
}

// Quantize note ONSETS only. Duration, velocity, pitch, name and track remain intact.
export function quantizeMidiNotes(
  notes: readonly MidiNoteEvent[],
  indices: readonly number[],
  options: MidiQuantizeOptions
): MidiNoteEvent[] {
  const step = midiGridStep(options.bpm, options.division)
  const selected = new Set(indices)
  const strength = clampPercent(options.strength) / 100
  if (!step || !strength || !selected.size) return notes.map(note => ({ ...note }))
  return notes.map((note, i) => {
    if (!selected.has(i) || !Number.isFinite(note.time)) return { ...note }
    const target = nearestSwingGridTime(note.time, step, options.swing)
    // Keep high-resolution MIDI timing stable across repeated quantizations.
    const time = Math.max(0, Math.round((note.time + (target - note.time) * strength) * 1e9) / 1e9)
    return { ...note, time }
  })
}
