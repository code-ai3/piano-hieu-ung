/** Pure click/drag geometry for drawing MIDI notes in the Piano Roll.
 * With Snap enabled, one click paints one entire grid cell. Dragging
 * extends the note to a cell boundary in either direction.
 */
export type DrawNoteRange={time:number;duration:number}
const round=(n:number)=>Math.round(n*1000000)/1000000
export function midiDrawRange(anchorSeconds:number,cursorSeconds:number,snapSeconds:number,moved=false):DrawNoteRange {
 const start=Math.max(0,Number.isFinite(anchorSeconds)?anchorSeconds:0)
 const end=Math.max(0,Number.isFinite(cursorSeconds)?cursorSeconds:start)
 if(Number.isFinite(snapSeconds)&&snapSeconds>0){
  const step=snapSeconds
  const snappedAnchor=round(Math.floor((start+1e-9)/step)*step)
  const snappedCursor=round(Math.floor((end+1e-9)/step)*step)
  const time=round(Math.min(snappedAnchor,snappedCursor))
  const right=round(Math.max(snappedAnchor,snappedCursor)+step)
  return {time,duration:round(Math.max(step,right-time))}
 }
 if(!moved)return {time:round(start),duration:.25}
 const time=round(Math.min(start,end))
 return {time,duration:round(Math.max(.04,Math.abs(end-start)))}
}
