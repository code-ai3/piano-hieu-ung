/** Canvas/export formats used by the same draw() renderer. */
export type VideoFormat = 'portrait' | 'landscape'
export type PortraitKeyboard = 'auto' | 'all' | '24' | '36' | '48' | '60'
export interface MidiPitch { midi: number }
export interface PitchRange { min: number; max: number }
export const VIDEO_FORMATS: Record<VideoFormat, { width: number; height: number; fps: number }> = {
  portrait: { width: 1080, height: 1920, fps: 30 },
  landscape: { width: 1920, height: 1080, fps: 30 },
}
/**
 * The portrait canvas is narrow, so display four octaves by default.
 * Choose the C-to-B window with most notes, using a middle-C-friendly
 * tie-break. Users can override the range or show all notes.
 */
export function portraitKeyboardRange(notes: readonly MidiPitch[], setting: PortraitKeyboard, fullRange: PitchRange): PitchRange {
  if (setting === 'all') return fullRange
  if (setting !== 'auto') {
    const min = Number(setting)
    return { min, max: min + 47 }
  }
  const starts = [24, 36, 48, 60] as const
  let bestStart: number = 48
  let bestCount = -1
  for (const start of starts) {
    let count = 0
    for (const note of notes) {
      if (note.midi >= start && note.midi < start + 48) count++
    }
    if (count > bestCount || (count === bestCount && Math.abs(start - 48) < Math.abs(bestStart - 48))) {
      bestStart = start
      bestCount = count
    }
  }
  return { min: bestStart, max: bestStart + 47 }
}
export function videoDimensions(format: VideoFormat) {
  return VIDEO_FORMATS[format]
}
