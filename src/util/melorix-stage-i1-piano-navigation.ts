/**
 * MELORIX I.1 – pure Piano Roll viewport navigation.
 * No MIDI note, CC64, audio or project data is modified by these helpers.
 */
export const PIANO_ROLL_MIN_ZOOM=1
export const PIANO_ROLL_MAX_ZOOM=160
export const PIANO_ROLL_DEFAULT_ZOOM=40

export function clampPianoRollZoom(value:number):number {
 if(!Number.isFinite(value))return PIANO_ROLL_DEFAULT_ZOOM
 return Math.round(Math.max(PIANO_ROLL_MIN_ZOOM,Math.min(PIANO_ROLL_MAX_ZOOM,value))*2)/2
}

/** Fit a musical time range without dividing by zero for one short note. */
export function fitPianoRollZoom(start:number,end:number,viewportWidth:number,keyWidth=54):number {
 if(![start,end,viewportWidth,keyWidth].every(Number.isFinite))return PIANO_ROLL_DEFAULT_ZOOM
 const span=Math.max(.25,Math.max(start,end)-Math.min(start,end))
 const available=Math.max(80,viewportWidth-keyWidth-36)
 return clampPianoRollZoom(available/(span*1.08))
}

export function pianoRollRulerStep(zoom:number):number {
 const px=clampPianoRollZoom(zoom)
 for(const step of [1,2,5,10,15,20,30,60,120,300]){
  if(px*step>=68)return step
 }
 return 300
}

/** Time under viewport center before zoom, independent of draft notes. */
export function pianoRollTimeAtCenter(scrollLeft:number,viewportWidth:number,zoom:number,keyWidth=54):number {
 if(![scrollLeft,viewportWidth,zoom,keyWidth].every(Number.isFinite))return 0
 return Math.max(0,(Math.max(0,scrollLeft)+Math.max(0,viewportWidth)*.5-keyWidth)/Math.max(PIANO_ROLL_MIN_ZOOM,zoom))
}

/** Align a time in the scroll viewport; the browser handles max-scroll clamping. */
export function pianoRollScrollForTime(time:number,zoom:number,viewportWidth:number,keyWidth=54,align=.5):number {
 if(![time,zoom,viewportWidth,keyWidth,align].every(Number.isFinite))return 0
 const fraction=Math.max(0,Math.min(1,align))
 return Math.max(0,keyWidth+Math.max(0,time)*clampPianoRollZoom(zoom)-Math.max(0,viewportWidth)*fraction)
}

export function stepPianoRollZoom(current:number,direction:-1|1):number {
 const v=clampPianoRollZoom(current)
 return clampPianoRollZoom(direction>0?v*1.5:v/1.5)
}
