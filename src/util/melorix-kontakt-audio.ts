export interface KontaktAudioAlignment {
 outputFrames: number
 sourceStartFrame: number
 outputStartFrame: number
 copyFrames: number
}
/** Positive offset delays Kontakt audio relative to MIDI; negative offset trims its beginning. */
export function planKontaktAudioAlignment(
 sourceFrames: number,
 sampleRate: number,
 videoSeconds: number,
 offsetSeconds: number,
): KontaktAudioAlignment {
 if (![sourceFrames,sampleRate,videoSeconds,offsetSeconds].every(Number.isFinite) ||
     sourceFrames < 0 || sampleRate < 8000 || videoSeconds <= 0) {
  throw new Error('Invalid Kontakt audio timing')
 }
 const outputFrames=Math.max(1,Math.ceil(videoSeconds*sampleRate))
 const sourceStartFrame=Math.max(0,Math.round(-offsetSeconds*sampleRate))
 const outputStartFrame=Math.min(outputFrames,Math.max(0,Math.round(offsetSeconds*sampleRate)))
 const copyFrames=Math.max(0,Math.min(sourceFrames-sourceStartFrame,outputFrames-outputStartFrame))
 return {outputFrames,sourceStartFrame,outputStartFrame,copyFrames}
}
export function alignKontaktAudio(
 source: AudioBuffer,
 videoSeconds: number,
 offsetSeconds: number,
): AudioBuffer {
 const plan=planKontaktAudioAlignment(source.length,source.sampleRate,videoSeconds,offsetSeconds)
 const audio=new AudioBuffer({
  numberOfChannels:Math.min(2,Math.max(1,source.numberOfChannels)),
  length:plan.outputFrames,
  sampleRate:source.sampleRate,
 })
 for(let c=0;c<audio.numberOfChannels;c++){
  if(plan.copyFrames>0)audio.getChannelData(c).set(
   source.getChannelData(c).subarray(plan.sourceStartFrame,plan.sourceStartFrame+plan.copyFrames),
   plan.outputStartFrame,
  )
 }
 return audio
}
