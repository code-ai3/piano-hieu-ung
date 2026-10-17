export function clampMidiVelocity(n: number): number { return Math.max(1, Math.min(127, Math.round(n))) }
