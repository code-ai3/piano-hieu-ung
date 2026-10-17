/**
 * MP4 export timeline stays in musical seconds regardless of preview playback
 * speed. Used for a fast test clip and to avoid audio/video misalignment.
 */
export type ExportLength = 'preview15' | 'preview30' | 'full'

export function exportDurationSeconds(songDuration: number, length: ExportLength): number {
  const seconds = Number.isFinite(songDuration) ? Math.max(0, songDuration) : 0
  const maxSeconds = length === 'preview15' ? 15 : length === 'preview30' ? 30 : Infinity
  return Math.min(seconds, maxSeconds)
}
export function exportFrameCount(seconds: number, fps: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(fps) || fps <= 0) return 0
  return Math.ceil(seconds * fps)
}
export function musicalTimeAtFrame(frame: number, fps: number): number {
  return Math.max(0, frame) / fps
}
export function previewClockForMusicalTime(seconds: number, playbackSpeed: number): number {
  return seconds * (Number.isFinite(playbackSpeed) && playbackSpeed > 0 ? playbackSpeed : 1)
}
