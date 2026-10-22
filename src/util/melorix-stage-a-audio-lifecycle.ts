// Browser lifecycle decisions are kept independent of Vue, Kontakt and WASAPI
// so playback regressions can be tested without a real audio device.
export interface BrowserPlaybackEnvironment{
 playing:boolean
 desktop:boolean
 originalAudio:boolean
 externalMidi:boolean
 contextState:string|null
}
export function canContinueAudioToNextSong(env:BrowserPlaybackEnvironment):boolean{
 return env.playing&&!env.desktop&&!env.originalAudio&&!env.externalMidi&&env.contextState==='running'
}
export function shouldPauseInterruptedWebAudio(env:Pick<BrowserPlaybackEnvironment,'desktop'|'externalMidi'|'contextState'>,frameGapSeconds:number):boolean{
 return !env.desktop&&!env.externalMidi&&
  (env.contextState!=='running'||!Number.isFinite(frameGapSeconds)||frameGapSeconds>5)
}
