// MIDI multi-track parsing and filtering shared by preview/playback/export.
export const TRACK_COLORS = [
  '#5cf6fe', '#f472b6', '#a78bfa', '#fbbf24',
  '#34d399', '#fb7185', '#60a5fa', '#c084fc',
  '#f97316', '#2dd4bf', '#e879f9', '#84cc16',
] as const

export interface MidiNoteEvent {
  midi: number
  name: string
  time: number
  duration: number
  velocity: number
  trackId: number
}
export interface MidiPart {
  id: number
  name: string
  instrument: string
  channel: number
  noteCount: number
  enabled: boolean
  color: string
}
interface MidiSourceNote {
  midi: number
  name: string
  time: number
  duration: number
  velocity: number
}
interface MidiSourceTrack {
  name?: string
  channel?: number
  instrument?: { name?: string }
  notes: MidiSourceNote[]
}
export interface MultiTrackMidi {
  tracks: MidiSourceTrack[]
  duration: number
}
export function extractMidiParts(midi: MultiTrackMidi): { parts: MidiPart[], events: MidiNoteEvent[] } {
  const parts: MidiPart[] = []
  const events: MidiNoteEvent[] = []
  midi.tracks.forEach((track, id) => {
    if (track.notes.length === 0) return
    const instrument = track.instrument?.name || ''
    const rawName = track.name?.trim() || instrument || `Track ${id + 1}`
    parts.push({
      id, name: rawName, instrument,
      channel: Number.isInteger(track.channel) ? track.channel! + 1 : 0,
      noteCount: track.notes.length,
      enabled: true,
      color: TRACK_COLORS[parts.length % TRACK_COLORS.length],
    })
    for (const note of track.notes) {
      if (!Number.isFinite(note.time) || !Number.isFinite(note.duration) || note.duration <= 0) continue
      events.push({
        midi: note.midi, name: note.name, time: note.time, duration: note.duration,
        velocity: Math.min(1, Math.max(0, note.velocity)), trackId: id,
      })
    }
  })
  events.sort((a, b) => a.time - b.time)
  return { parts, events }
}
export function filterMidiParts(events: MidiNoteEvent[], parts: MidiPart[]): MidiNoteEvent[] {
  const enabledIds = new Set(parts.filter(part => part.enabled).map(part => part.id))
  return events.filter(note => enabledIds.has(note.trackId))
}
export function trackColor(id: number, parts: MidiPart[], fallback = '#5cf6fe'): string {
  return parts.find(part => part.id === id)?.color || fallback
}
