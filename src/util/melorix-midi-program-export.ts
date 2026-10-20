/** Preserve imported General MIDI program when exporting edited tracks.
 * An explicitly chosen built-in MELORIX preset is allowed to override it.
 * Kontakt NKI/library or personal WAV choices cannot be represented in MIDI,
 * so retain the source program rather than silently resetting to piano.
 */
export function exportMidiProgram(original:unknown,explicitPresetProgram?:unknown):number{
 const valid=(value:unknown):value is number =>
  typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=127
 if(valid(explicitPresetProgram))return explicitPresetProgram
 if(valid(original))return original
 return 0 // GM Acoustic Grand Piano for genuinely unknown tracks.
}
