/** Render-only response to MIDI velocity. Never changes the note's audio or MIDI data. */
export type VelocityVisualMode = 'off' | 'natural' | 'expressive'
const clamp01 = (n: number): number => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5
/**
 * Returns [0, 1]. Zero sensitivity / mode 'off' make every note visually equal.
 * Natural reflects note velocity; expressive increases the contrast without
 * altering MIDI note timings or audio velocity.
 */
export function velocityVisualStrength(velocity: number, mode: VelocityVisualMode, sensitivity: number): number {
  if (mode === 'off') return 1
  const v = clamp01(velocity)
  const depth = clamp01(sensitivity / 100)
  const curve = mode === 'expressive' ? (0.12 + 0.88 * v ** 2) : (0.22 + 0.78 * v)
  return clamp01(1 - (1 - curve) * depth)
}
/** Deterministic particle budget for both live previews and offline exports. */
export function velocityParticleCount(baseCount: number, strength: number): number {
  const base = Math.max(0, Math.floor(Number.isFinite(baseCount) ? baseCount : 0))
  return Math.min(base, Math.max(0, Math.round(base * (0.18 + 0.82 * clamp01(strength)))))
}
