/** Pixel coordinates in the Piano Roll; musical time is always seconds, not wall-clock speed. */
export function playheadLeft(seconds: number, pixelsPerSecond: number, keyboardWidth: number): number {
  return keyboardWidth + Math.max(0, seconds) * pixelsPerSecond
}
export function rulerSeekTime(pointerX: number, rulerLeft: number, horizontalScroll: number, pixelsPerSecond: number, keyboardWidth: number, duration: number): number | null {
  const x = pointerX - rulerLeft + horizontalScroll - keyboardWidth
  if (x < 0 || pixelsPerSecond <= 0) return null
  return Math.min(Math.max(0, duration), x / pixelsPerSecond)
}
export function activeAtTime(time: number, start: number, duration: number): boolean {
  return time >= start && time < start + duration
}
