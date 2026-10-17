<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import type { MidiNoteEvent, MidiPart } from '@/util/midi-tracks'
import { midiNoteName, snapMidiTime } from '@/util/midi-edit'
import { playheadLeft, rulerSeekTime } from '@/util/piano-roll-playhead'
import { cloneNotes, sameNotes, copyMidiNotes, pasteMidiNotes, moveMidiNotes, selectMidiInBox } from '@/util/piano-roll-selection'
import { midiGridStep, quantizeMidiNotes } from '@/util/piano-roll-quantize'
import { setMidiVelocities, shiftMidiVelocities, rampMidiVelocities, humanizeMidiVelocities, drawMidiVelocityLine, velocityNumber } from '@/util/piano-roll-velocity'
import { isPitchInScale, isScaleRoot, snapPitchToScale, correctMidiNotesToScale } from '@/util/piano-roll-scale'
import type { ScaleMode } from '@/util/piano-roll-scale'
const props=defineProps<{part:MidiPart; notes:MidiNoteEvent[]; duration:number; bpm:number; disabled:boolean; currentTime:number; playing:boolean}>()
const emit=defineEmits<{(e:'change',notes:MidiNoteEvent[]):void;(e:'close'):void;(e:'seek',time:number):void;(e:'audition-start',midi:number):void;(e:'audition-stop'):void}>()
const ROW=19, KEY_W=54, HIGH=108, LOW=21
const scroll=ref<HTMLElement|null>(null)
const gridScrollLeft=ref(0)
const followPlayback=ref(true)
const playheadX=computed(()=>playheadLeft(props.currentTime,pixelsPerSecond.value,KEY_W))
function followPlayhead(force=false){
 const el=scroll.value;if(!el||!followPlayback.value)return
 const x=playheadX.value,w=el.clientWidth
 if(force||(props.playing&&(x>el.scrollLeft+w*.78||x<el.scrollLeft+w*.1)))el.scrollLeft=Math.max(0,x-w*.3)
 else if(!props.playing&&props.currentTime<.03)el.scrollLeft=0
}
const pixelsPerSecond=ref(40)
const snapDivision=ref(16)
const quantDivision=ref(16)
const quantStrength=ref(100)
const quantSwing=ref(0)
const advancedPanel=ref<'none'|'quantize'|'velocity'|'scale'>('none')
const scaleRoot=ref(0)
const scaleMode=ref<ScaleMode>('major')
const scaleHighlight=ref(true)
const scaleSnap=ref(false)
const scaleRootNames=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']
const velocitySet=ref(95)
const velocityFrom=ref(45)
const velocityTo=ref(115)
const humanizeAmount=ref(12)
const velocityDrawing=ref(false)
const velocityWindow=ref<HTMLElement|null>(null)
let humanizeSeed=0
const tool=ref<'select'|'draw'|'erase'>('select')
const draft=ref<MidiNoteEvent[]>([])
const selected=ref(-1)
const selectedIndices=ref<number[]>([])
const clipboard=ref<MidiNoteEvent[]>([])
const undoHistory=ref<MidiNoteEvent[][]>([])
const redoHistory=ref<MidiNoteEvent[][]>([])
const marquee=ref<{x1:number;y1:number;x2:number;y2:number;additive:boolean}|null>(null)
const rollRoot=ref<HTMLElement|null>(null)
const selectionCount=computed(()=>selectedIndices.value.length)
const auditionPitch=ref<number|null>(null)
let auditionPointerId:number|null=null

const totalWidth=computed(()=>Math.max(1100,(Math.max(props.duration,...draft.value.map(n=>n.time+n.duration),0)+5)*pixelsPerSecond.value))
const gridWidth=computed(()=>totalWidth.value+KEY_W)
const snap=computed(()=>midiGridStep(props.bpm,snapDivision.value))
const ticks=computed(()=>Array.from({length:Math.min(2000,Math.ceil(totalWidth.value/pixelsPerSecond.value/2)+1)},(_,i)=>i*2))
// Editor keyboard pitch list
const keyList=Array.from({length:HIGH-LOW+1},(_,i)=>HIGH-i)
let previousTrackId: number | null = null
watch(()=>[props.part.id,props.notes],()=>{
  const switched=previousTrackId!==props.part.id
  previousTrackId=props.part.id
  if(switched||!sameNotes(draft.value,props.notes))draft.value=cloneNotes(props.notes)
  if(switched){
    selectedIndices.value=[];selected.value=-1
    velocityDrawing.value=false;advancedPanel.value='none'
    undoHistory.value=[];redoHistory.value=[];clipboard.value=[]
    void nextTick(()=>{centerKeys();followPlayhead(true)})
  } else if(selectedIndices.value.some(i=>i>=draft.value.length)){
    selectedIndices.value=[];selected.value=-1
  }
},{immediate:true})
function centerKeys(){
 const e=scroll.value; if(!e)return
 const pitches=draft.value.map(n=>n.midi)
 const p=pitches.length?(Math.min(...pitches)+Math.max(...pitches))/2:60
 e.scrollTop=Math.max(0,(HIGH-p)*ROW-e.clientHeight/2)
}
watch(() => props.currentTime, () => followPlayhead())
function seekOnRuler(e:MouseEvent){
 const rect=(e.currentTarget as HTMLElement).getBoundingClientRect()
 const seconds=rulerSeekTime(e.clientX,rect.left,gridScrollLeft.value,pixelsPerSecond.value,KEY_W,props.duration)
 if(seconds!==null)emit('seek',seconds)
}
function syncScroll(e:Event){gridScrollLeft.value=(e.target as HTMLElement).scrollLeft}
function snapAt(x:number){return snapMidiTime((x-KEY_W)/pixelsPerSecond.value,snap.value)}
function yToMidi(y:number){return Math.min(HIGH,Math.max(LOW,HIGH-Math.floor(y/ROW)))}
function snapToCurrentScale(pitch:number){return scaleSnap.value?snapPitchToScale(pitch,scaleRoot.value,scaleMode.value,LOW,HIGH):pitch}
function setSelection(indices:number[]){
 selectedIndices.value=[...new Set(indices.filter(i=>i>=0&&i<draft.value.length))]
 selected.value=selectedIndices.value.length===1?selectedIndices.value[0]:-1
}
function commit(before?:MidiNoteEvent[]){
 if(props.disabled)return
 if(before&&sameNotes(before,draft.value))return
 if(before){
  undoHistory.value.push(cloneNotes(before))
  if(undoHistory.value.length>60)undoHistory.value.shift()
  redoHistory.value=[]
 }
 const keep=new Set(selectedIndices.value.map(i=>draft.value[i]))
 draft.value.sort((a,b)=>a.time-b.time||a.midi-b.midi)
 setSelection(draft.value.flatMap((note,i)=>keep.has(note)?[i]:[]))
 emit('change',cloneNotes(draft.value))
}
function gridPointer(e:PointerEvent){
 const el=gridRef.value
 if(!el)return {x:0,y:0}
 const rect=el.getBoundingClientRect()
 return {x:Math.max(KEY_W,e.clientX-rect.left),y:Math.max(0,e.clientY-rect.top)}
}
const gridRef=ref<HTMLElement|null>(null)
function startMarquee(e:PointerEvent){
 if(props.disabled||e.button!==0)return
 e.preventDefault()
 rollRoot.value?.focus({preventScroll:true})
 const p=gridPointer(e)
 marquee.value={x1:p.x,x2:p.x,y1:p.y,y2:p.y,additive:e.shiftKey||e.ctrlKey||e.metaKey}
 window.addEventListener('pointermove',moveMarquee)
 window.addEventListener('pointerup',stopMarquee)
}
function moveMarquee(e:PointerEvent){
 if(!marquee.value)return
 const p=gridPointer(e)
 marquee.value={...marquee.value,x2:p.x,y2:p.y}
}
function stopMarquee(e:PointerEvent){
 if(marquee.value){
  const box={...marquee.value,...gridPointer(e)}
  box.x2=gridPointer(e).x
  box.y2=gridPointer(e).y
  const found=Math.abs(box.x2-box.x1)>3||Math.abs(box.y2-box.y1)>3
   ?selectMidiInBox(draft.value,box,pixelsPerSecond.value,KEY_W,HIGH,ROW):[]
  setSelection(box.additive?[...selectedIndices.value,...found]:found)
  marquee.value=null
 }
 window.removeEventListener('pointermove',moveMarquee)
 window.removeEventListener('pointerup',stopMarquee)
}
function copySelection(){
 if(!selectionCount.value)return
 clipboard.value=copyMidiNotes(draft.value,selectedIndices.value)
}
function pasteSelection(atTime=props.currentTime){
 if(props.disabled||!clipboard.value.length)return
 const before=cloneNotes(draft.value)
 const start=draft.value.length
 let inserted=pasteMidiNotes(clipboard.value,props.part.id,snapMidiTime(atTime,snap.value))
 if(scaleSnap.value)inserted=correctMidiNotesToScale(inserted,inserted.map((_,i)=>i),scaleRoot.value,scaleMode.value,LOW,HIGH)
 draft.value.push(...inserted)
 setSelection(inserted.map((_,i)=>start+i))
 commit(before)
}
function applyQuantize(){
 if(props.disabled||!draft.value.length)return
 const before=cloneNotes(draft.value)
 const indices=selectionCount.value ? [...selectedIndices.value] : draft.value.map((_,i)=>i)
 draft.value=quantizeMidiNotes(draft.value,indices,{
  bpm:props.bpm,division:quantDivision.value,strength:quantStrength.value,swing:quantSwing.value
 })
 commit(before)
}
function togglePanel(panel:'quantize'|'velocity'|'scale'){
 advancedPanel.value=advancedPanel.value===panel?'none':panel
 if(advancedPanel.value!=='velocity')velocityDrawing.value=false
}
function correctSelectionToScale(){
 if(props.disabled||!draft.value.length)return
 const before=cloneNotes(draft.value)
 const indices=selectionCount.value?[...selectedIndices.value]:draft.value.map((_,i)=>i)
 draft.value=correctMidiNotesToScale(draft.value,indices,scaleRoot.value,scaleMode.value,LOW,HIGH)
 commit(before)
}
function velocityTargets(){return selectionCount.value?[...selectedIndices.value]:draft.value.map((_,i)=>i)}
function applyVelocitySet(){
 if(props.disabled||!draft.value.length)return
 const before=cloneNotes(draft.value)
 draft.value=setMidiVelocities(draft.value,velocityTargets(),velocitySet.value)
 commit(before)
}
function applyVelocityDelta(delta:number){
 if(props.disabled||!draft.value.length)return
 const before=cloneNotes(draft.value)
 draft.value=shiftMidiVelocities(draft.value,velocityTargets(),delta)
 commit(before)
}
function applyVelocityRamp(reverse=false){
 if(props.disabled||!draft.value.length)return
 const before=cloneNotes(draft.value)
 draft.value=rampMidiVelocities(draft.value,velocityTargets(),reverse?velocityTo.value:velocityFrom.value,reverse?velocityFrom.value:velocityTo.value)
 commit(before)
}
function applyVelocityHumanize(){
 if(props.disabled||!draft.value.length)return
 const before=cloneNotes(draft.value)
 draft.value=humanizeMidiVelocities(draft.value,velocityTargets(),humanizeAmount.value,++humanizeSeed)
 commit(before)
}
// Drawing works in the existing velocity lane, so no new panel takes vertical space.
let painting:{before:MidiNoteEvent[];indices:number[];time:number;value:number;startX:number;moved:boolean}|null=null
function velocityCoordinates(e:PointerEvent){
 const el=velocityWindow.value;if(!el)return null
 const rect=el.getBoundingClientRect()
 const x=Math.max(KEY_W,Math.min(gridWidth.value,e.clientX-rect.left+gridScrollLeft.value))
 return {time:Math.max(0,(x-KEY_W)/pixelsPerSecond.value),value:velocityNumber((rect.bottom-e.clientY)/rect.height*127)}
}
function beginVelocityDraw(e:PointerEvent){
 if(props.disabled||!velocityDrawing.value||painting||(e.pointerType==='mouse'&&e.button!==0))return
 const pos=velocityCoordinates(e);if(!pos)return
 e.preventDefault()
 rollRoot.value?.focus({preventScroll:true})
 painting={before:cloneNotes(draft.value),indices:velocityTargets(),time:pos.time,value:pos.value,startX:e.clientX,moved:false}
 window.addEventListener('pointermove',moveVelocityDraw)
 window.addEventListener('pointerup',endVelocityDraw)
 window.addEventListener('pointercancel',endVelocityDraw)
}
function moveVelocityDraw(e:PointerEvent){
 const state=painting,pos=velocityCoordinates(e)
 if(!state||!pos)return
 if(Math.abs(e.clientX-state.startX)>3)state.moved=true
 if(!state.moved)return
 draft.value=drawMidiVelocityLine(state.before,state.indices,state.time,pos.time,state.value,pos.value)
}
function endVelocityDraw(e:PointerEvent){
 if(painting){
  moveVelocityDraw(e)
  const before=painting.before
  painting=null
  commit(before)
 }
 window.removeEventListener('pointermove',moveVelocityDraw)
 window.removeEventListener('pointerup',endVelocityDraw)
 window.removeEventListener('pointercancel',endVelocityDraw)
}
function velocityBarDown(e:PointerEvent,index:number){
 if(velocityDrawing.value){e.stopPropagation();beginVelocityDraw(e)}
 else startDrag(e,index,'velocity')
}
function removeSelected(){
 if(props.disabled||!selectionCount.value)return
 const before=cloneNotes(draft.value)
 const toDelete=new Set(selectedIndices.value)
 draft.value=draft.value.filter((_,i)=>!toDelete.has(i))
 setSelection([])
 commit(before)
}
function cutSelection(){copySelection();removeSelected()}
function duplicateSelection(){
 if(!selectionCount.value)return
 copySelection()
 const chosen=selectedIndices.value.map(i=>draft.value[i])
 const end=Math.max(...chosen.map(n=>n.time+n.duration))
 pasteSelection(end+Math.max(snap.value,.125))
}
function undoEdit(){
 if(props.disabled||!undoHistory.value.length)return
 redoHistory.value.push(cloneNotes(draft.value))
 draft.value=undoHistory.value.pop()!
 setSelection([])
 emit('change',cloneNotes(draft.value))
}
function redoEdit(){
 if(props.disabled||!redoHistory.value.length)return
 undoHistory.value.push(cloneNotes(draft.value))
 draft.value=redoHistory.value.pop()!
 setSelection([])
 emit('change',cloneNotes(draft.value))
}
function onEditorKeyDown(e:KeyboardEvent){
 if(props.disabled)return
 if((e.target as HTMLElement).closest('input,select,textarea,[contenteditable="true"]'))return
 const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase()
 if(mod){
  if(key==='a'){e.preventDefault();setSelection(draft.value.map((_,i)=>i))}
  else if(key==='c'&&selectionCount.value){e.preventDefault();copySelection()}
  else if(key==='x'&&selectionCount.value){e.preventDefault();cutSelection()}
  else if(key==='v'&&clipboard.value.length){e.preventDefault();pasteSelection()}
  else if(key==='d'&&selectionCount.value){e.preventDefault();duplicateSelection()}
  else if(key==='z'){e.preventDefault();if(e.shiftKey)redoEdit();else undoEdit()}
  else if(key==='y'){e.preventDefault();redoEdit()}
 }else if(!e.altKey && !mod && key==='q'){e.preventDefault();applyQuantize()}
 else if((e.key==='Delete'||e.key==='Backspace')&&selectionCount.value){
  e.preventDefault();removeSelected()
 }
}
let dragging:{index:number;kind:'move'|'resize'|'velocity';x:number;y:number;original:MidiNoteEvent;before:MidiNoteEvent[];indices:number[]}|null=null
function stopDrag(){
 if(dragging){const snapshot=dragging.before;dragging=null;commit(snapshot)}
 window.removeEventListener('pointermove',moveDrag)
 window.removeEventListener('pointerup',stopDrag)
}
function startDrag(e:PointerEvent,index:number,kind:'move'|'resize'|'velocity'){
 if(props.disabled)return
 e.preventDefault();e.stopPropagation()
 rollRoot.value?.focus({preventScroll:true})
 if(kind==='move'&&(e.shiftKey||e.ctrlKey||e.metaKey)){
  if(selectedIndices.value.includes(index))setSelection(selectedIndices.value.filter(i=>i!==index))
  else setSelection([...selectedIndices.value,index])
  return
 }
 if(kind!=='move'||!selectedIndices.value.includes(index))setSelection([index])
 dragging={index,kind,x:e.clientX,y:e.clientY,original:{...draft.value[index]},before:cloneNotes(draft.value),indices:[...selectedIndices.value]}
 window.addEventListener('pointermove',moveDrag)
 window.addEventListener('pointerup',stopDrag)
}
function moveDrag(e:PointerEvent){
 const d=dragging;if(!d)return
 const n=d.original
 if(d.kind==='velocity'){
  const delta=Math.round((d.y-e.clientY)*1.2)
  draft.value=shiftMidiVelocities(d.before,d.indices,delta);return
 }
 const dt=(e.clientX-d.x)/pixelsPerSecond.value
 const movedX=Math.abs(e.clientX-d.x)>=2
 if(d.kind==='resize'){
  if(!movedX)return
  const desiredEnd=n.time+n.duration+dt
  const end=snap.value?snapMidiTime(desiredEnd,snap.value):desiredEnd
  draft.value[d.index]={...n,duration:Math.max(.04,end-n.time)}
  return
 }
 const shiftPitch=-Math.round((e.clientY-d.y)/ROW)
 const anchor=Math.min(...d.indices.map(i=>d.before[i].time))
 // Snap absolute group onset, preserving relative offsets between selected notes.
 const delta=movedX?(snap.value?snapMidiTime(anchor+dt,snap.value)-anchor:dt):0
 const moved=moveMidiNotes(d.before,d.indices,delta,shiftPitch)
 draft.value=scaleSnap.value&&shiftPitch!==0
  ?correctMidiNotesToScale(moved,d.indices,scaleRoot.value,scaleMode.value,LOW,HIGH)
  :moved
}
function removeNote(index:number){
 if(props.disabled)return
 const before=cloneNotes(draft.value)
 draft.value.splice(index,1)
 setSelection([])
 commit(before)
}
function onGridDouble(e:MouseEvent){
 if(props.disabled)return
 const grid=e.currentTarget as HTMLElement;const r=grid.getBoundingClientRect()
 const time=snapAt(e.clientX-r.left), pitch=snapToCurrentScale(yToMidi(e.clientY-r.top))
 const before=cloneNotes(draft.value)
 draft.value.push({time,midi:pitch,name:midiNoteName(pitch),duration:Math.max(.08,snap.value||.25),velocity:95/127,trackId:props.part.id})
 setSelection([draft.value.length-1])
 commit(before)
}
function noteDown(e:PointerEvent,index:number){if(tool.value==='erase'){removeNote(index);return}startDrag(e,index,'move')}
function noteDbl(e:MouseEvent,index:number){e.stopPropagation();removeNote(index)}
function pitchAtPointer(e:PointerEvent):number|null{
 const area=scroll.value
 if(!area)return null
 const rect=area.getBoundingClientRect()
 const x=e.clientX-rect.left, y=e.clientY-rect.top+area.scrollTop
 if(x<0||x>KEY_W||y<0||y>=ROW*(HIGH-LOW+1))return null
 return Math.max(LOW,Math.min(HIGH,HIGH-Math.floor(y/ROW)))
}
function changeAudition(pitch:number|null){
 if(auditionPitch.value===pitch)return
 if(auditionPitch.value!==null)emit('audition-stop')
 auditionPitch.value=pitch
 if(pitch!==null)emit('audition-start',pitch)
}
function onKeyPointerDown(e:PointerEvent){
 if(props.disabled||auditionPointerId!==null||(e.pointerType==='mouse'&&e.button!==0))return
 e.preventDefault()
 auditionPointerId=e.pointerId
 try{(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}catch{}
 changeAudition(pitchAtPointer(e))
}
function onKeyPointerMove(e:PointerEvent){
 if(auditionPointerId===e.pointerId)changeAudition(pitchAtPointer(e))
}
function onKeyPointerUp(e:PointerEvent){
 if(auditionPointerId!==e.pointerId)return
 stopKeyAudition()
 const key=e.currentTarget as HTMLElement
 if(key.hasPointerCapture(e.pointerId))key.releasePointerCapture(e.pointerId)
}
function stopKeyAudition(){
 if(auditionPitch.value!==null)emit('audition-stop')
 auditionPointerId=null
 auditionPitch.value=null
}
function onKeyLostCapture(e:PointerEvent){
 if(auditionPointerId===e.pointerId)stopKeyAudition()
}
function keyLabel(midi:number){return midiNoteName(midi)}
watch(()=>props.disabled,disabled=>{if(disabled){stopKeyAudition();if(painting){draft.value=painting.before;painting=null}}})
onUnmounted(()=>{stopDrag();painting=null;window.removeEventListener('pointermove',moveVelocityDraw);window.removeEventListener('pointerup',endVelocityDraw);window.removeEventListener('pointercancel',endVelocityDraw);window.removeEventListener('pointermove',moveMarquee);window.removeEventListener('pointerup',stopMarquee);stopKeyAudition()})
</script>

<template>
  <section ref="rollRoot" class="mx-roll" tabindex="0" @keydown="onEditorKeyDown" aria-label="Trình chỉnh sửa MIDI Piano Roll">
    <div class="mx-roll-top">
      <strong><i class="fas fa-keyboard"></i> Piano Roll</strong>
      <span class="mx-roll-track" :style="{ color: part.color }">{{ part.name }}</span>
      <span class="mx-roll-stats">{{ draft.length }} nốt · {{ Math.round(bpm) }} BPM</span>
      <span class="mx-roll-grow"></span>
      <label>Công cụ <select v-model="tool" :disabled="disabled">
        <option value="select">Di chuyển / Chỉnh</option><option value="erase">Xóa nốt</option>
      </select></label>
      <label>Snap <select v-model.number="snapDivision">
        <option :value="0">Tắt</option><option :value="4">1/4</option><option :value="8">1/8</option>
        <option :value="16">1/16</option><option :value="32">1/32</option>
        <option :value="64">1/64</option><option :value="12">1/8T</option><option :value="24">1/16T</option>
      </select></label>
      <label>Zoom <input v-model.number="pixelsPerSecond" type="range" min="18" max="140" step="2"></label>
      <button type="button" title="Đóng Piano Roll" @click="emit('close')"><i class="fas fa-times"></i></button>
    </div>
    <div class="mx-roll-editbar mx-roll-editbar-compact" aria-label="Công cụ soạn MIDI">
      <strong class="mx-roll-selection-count" :title="selectionCount + ' nốt được chọn'">{{ selectionCount }} chọn</strong>
      <button type="button" title="Chọn tất cả · Ctrl+A" aria-label="Chọn tất cả" :disabled="disabled || !draft.length" @click="setSelection(draft.map((_,i)=>i))"><i class="fas fa-object-group"></i></button>
      <button type="button" title="Sao chép · Ctrl+C" aria-label="Sao chép" :disabled="disabled || !selectionCount" @click="copySelection"><i class="fas fa-copy"></i></button>
      <button type="button" title="Dán · Ctrl+V" aria-label="Dán" :disabled="disabled || !clipboard.length" @click="pasteSelection()"><i class="fas fa-paste"></i></button>
      <button type="button" title="Nhân đôi · Ctrl+D" aria-label="Nhân đôi" :disabled="disabled || !selectionCount" @click="duplicateSelection"><i class="fas fa-clone"></i></button>
      <button type="button" title="Xóa · Delete" aria-label="Xóa nốt đã chọn" :disabled="disabled || !selectionCount" @click="removeSelected"><i class="fas fa-trash"></i></button>
      <span class="mx-roll-separator"></span>
      <button type="button" :class="{ 'mx-roll-panel-active': advancedPanel==='quantize' }" :aria-expanded="advancedPanel==='quantize'" title="Bật/tắt công cụ căn nhịp" @click="togglePanel('quantize')"><i class="fas fa-align-left"></i> Nhịp <i class="fas fa-angle-down"></i></button>
      <button type="button" :class="{ 'mx-roll-panel-active': advancedPanel==='velocity' }" :aria-expanded="advancedPanel==='velocity'" title="Bật/tắt công cụ Velocity nâng cao" @click="togglePanel('velocity')"><i class="fas fa-sliders-h"></i> Velocity <i class="fas fa-angle-down"></i></button>
      <button type="button" :class="{ 'mx-roll-panel-active': advancedPanel==='scale' }" :aria-expanded="advancedPanel==='scale'" title="Scale Assistant — Trợ lý âm giai" @click="togglePanel('scale')"><i class="fas fa-music"></i> Scale <i class="fas fa-angle-down"></i></button>
      <span class="mx-roll-grow"></span>
      <button type="button" title="Hoàn tác · Ctrl+Z" aria-label="Hoàn tác" :disabled="disabled || !undoHistory.length" @click="undoEdit"><i class="fas fa-undo"></i></button>
      <button type="button" title="Làm lại · Ctrl+Y" aria-label="Làm lại" :disabled="disabled || !redoHistory.length" @click="redoEdit"><i class="fas fa-redo"></i></button>
    </div>
    <div v-if="advancedPanel==='quantize'" class="mx-roll-quantbar mx-roll-compact-panel" aria-label="Căn nhịp nâng cao">
      <label>Lưới <select v-model.number="quantDivision" :disabled="disabled" aria-label="Lưới Quantize">
        <option :value="4">1/4</option><option :value="8">1/8</option><option :value="16">1/16</option>
        <option :value="32">1/32</option><option :value="64">1/64</option><option :value="12">1/8T</option><option :value="24">1/16T</option>
      </select></label>
      <label>Strength <select v-model.number="quantStrength" :disabled="disabled" aria-label="Độ mạnh Quantize">
        <option :value="25">25%</option><option :value="50">50%</option><option :value="75">75%</option><option :value="100">100%</option>
      </select></label>
      <label>Swing <input v-model.number="quantSwing" :disabled="disabled" type="range" min="0" max="100" step="5" aria-label="Độ Swing">
        <span class="mx-roll-quant-value">{{ quantSwing }}%</span>
      </label>
      <span class="mx-roll-grow"></span>
      <span class="mx-roll-quant-scope">{{ selectionCount ? selectionCount + ' nốt' : 'Cả track' }}</span>
      <button type="button" class="mx-roll-quant-apply" title="Căn nhịp · Q · Ctrl+Z để hoàn tác" :disabled="disabled || !draft.length" @click="applyQuantize">Căn nhịp (Q)</button>
    </div>
    <div v-else-if="advancedPanel==='velocity'" class="mx-roll-quantbar mx-roll-compact-panel mx-roll-velocity-tools" aria-label="Velocity nâng cao">
      <label>Mức <input v-model.number="velocitySet" :disabled="disabled" aria-label="Velocity đặt cố định" type="number" min="1" max="127" step="1"></label>
      <button type="button" title="Đặt cùng lực đánh cho các nốt được chọn" :disabled="disabled || !draft.length" @click="applyVelocitySet">Đặt</button>
      <button type="button" title="Giảm lực đánh 5 đơn vị" :disabled="disabled || !draft.length" @click="applyVelocityDelta(-5)">−5</button>
      <button type="button" title="Tăng lực đánh 5 đơn vị" :disabled="disabled || !draft.length" @click="applyVelocityDelta(5)">+5</button>
      <span class="mx-roll-separator"></span>
      <label>Từ <input v-model.number="velocityFrom" type="number" min="1" max="127" :disabled="disabled" aria-label="Velocity đầu"></label>
      <label>Đến <input v-model.number="velocityTo" type="number" min="1" max="127" :disabled="disabled" aria-label="Velocity cuối"></label>
      <button type="button" title="Tạo Velocity tăng/giảm từ trái sang phải" :disabled="disabled || !draft.length" @click="applyVelocityRamp(false)">Dốc ↗</button>
      <button type="button" title="Đảo chiều dốc Velocity" :disabled="disabled || !draft.length" @click="applyVelocityRamp(true)">↘</button>
      <span class="mx-roll-separator"></span>
      <label>± <select v-model.number="humanizeAmount" :disabled="disabled" aria-label="Biên độ Humanize"><option :value="5">5</option><option :value="10">10</option><option :value="12">12</option><option :value="20">20</option></select></label>
      <button type="button" title="Biến thiên lực đánh tự nhiên trong biên độ đã chọn" :disabled="disabled || !draft.length" @click="applyVelocityHumanize">Humanize</button>
      <button type="button" :class="{ 'mx-roll-panel-active': velocityDrawing }" :aria-pressed="velocityDrawing" title="Vẽ đường thẳng bằng cách kéo chuột trên làn Velocity" :disabled="disabled" @click="velocityDrawing=!velocityDrawing"><i class="fas fa-pencil-alt"></i> Vẽ</button>
    </div>
    <div v-if="advancedPanel==='scale'" class="mx-roll-quantbar mx-roll-compact-panel mx-roll-scale-tools" aria-label="Scale Assistant — Trợ lý âm giai">
      <label>Chủ âm <select v-model.number="scaleRoot" aria-label="Chủ âm">
        <option v-for="(name,index) in scaleRootNames" :key="index" :value="index">{{ name }}</option>
      </select></label>
      <label>Âm giai <select v-model="scaleMode" aria-label="Loại âm giai">
        <option value="major">Major (Trưởng)</option>
        <option value="naturalMinor">Natural Minor (Thứ)</option>
        <option value="harmonicMinor">Harmonic Minor</option>
        <option value="dorian">Dorian</option>
        <option value="mixolydian">Mixolydian</option>
        <option value="majorPentatonic">Pentatonic Trưởng</option>
        <option value="minorPentatonic">Pentatonic Thứ</option>
      </select></label>
      <label class="mx-roll-scale-toggle"><input v-model="scaleHighlight" type="checkbox" aria-label="Tô sáng âm giai"> Tô sáng</label>
      <label class="mx-roll-scale-toggle" title="Khi vẽ, kéo hoặc dán sẽ căn vào nốt đúng âm giai"><input v-model="scaleSnap" type="checkbox" aria-label="Hút nốt đúng âm giai"> Hút nốt</label>
      <span class="mx-roll-grow"></span>
      <span class="mx-roll-quant-scope">{{ selectionCount ? selectionCount + ' nốt' : 'Cả track' }}</span>
      <button type="button" class="mx-roll-quant-apply" title="Sửa nốt nằm ngoài âm giai; Ctrl+Z hoàn tác" :disabled="disabled || !draft.length" @click="correctSelectionToScale"><i class="fas fa-magic"></i> Sửa nốt lệch</button>
    </div>
    <div class="mx-roll-ruler" @click="seekOnRuler">
      <div :style="{ width: gridWidth + 'px', transform: 'translateX(-' + gridScrollLeft + 'px)' }">
        <span v-for="sec in ticks" :key="sec" :style="{ left: KEY_W + sec * pixelsPerSecond + 'px' }">{{ sec }}s</span>
        <span class="mx-roll-playhead mx-roll-ruler-cursor" :style="{ left: playheadX + 'px' }"></span>
      </div>
    </div>
    <div ref="scroll" class="mx-roll-scroll" @scroll="syncScroll">
      <div ref="gridRef" class="mx-roll-grid" @pointerdown.self="startMarquee" :style="{ width: gridWidth + 'px', height: ROW * (HIGH - LOW + 1) + 'px', backgroundSize: (snap ? Math.max(8, snap * pixelsPerSecond) : 60 / Math.max(20, bpm) * pixelsPerSecond) + 'px ' + ROW + 'px', backgroundPositionX: KEY_W + 'px' }" @dblclick.self="onGridDouble">
        <div class="mx-roll-keys" role="group" aria-label="Bàn phím Piano để nghe thử nốt"
          @pointerdown.stop="onKeyPointerDown" @pointermove.stop="onKeyPointerMove"
          @pointerup.stop="onKeyPointerUp" @pointercancel.stop="onKeyPointerUp"
          @lostpointercapture="onKeyLostCapture">
          <div v-for="pitch in keyList" :key="pitch" :class="['mx-roll-key', { black: keyLabel(pitch).includes('#'), auditioning: auditionPitch === pitch, 'scale-out': scaleHighlight && !isPitchInScale(pitch,scaleRoot,scaleMode), 'scale-tonic': scaleHighlight && isScaleRoot(pitch,scaleRoot) }]" :style="{ height: ROW + 'px' }">{{ pitch % 12 === 0 ? keyLabel(pitch) : '' }}</div>
        </div>
        <div v-if="scaleHighlight" class="mx-roll-scale-overlay" aria-hidden="true">
          <div v-for="pitch in keyList" :key="pitch" class="mx-roll-scale-row"
            :class="{ 'scale-row-out': !isPitchInScale(pitch,scaleRoot,scaleMode), 'scale-row-tonic': isScaleRoot(pitch,scaleRoot) }"
            :style="{ height: ROW + 'px' }"></div>
        </div>
        <div v-for="(note, i) in draft" :key="i" class="mx-roll-note" :class="{ selected: selectedIndices.includes(i), sounding: playing && currentTime >= note.time && currentTime < note.time + note.duration, 'off-scale': scaleHighlight && !isPitchInScale(note.midi,scaleRoot,scaleMode) }"
          :title="note.name + ' · ' + note.time.toFixed(2) + 's · Velocity ' + Math.round(note.velocity * 127)"
          :style="{ left: KEY_W + note.time * pixelsPerSecond + 'px', top: (HIGH - note.midi) * ROW + 1 + 'px', width: Math.max(5, note.duration * pixelsPerSecond) + 'px', height: ROW - 2 + 'px', backgroundColor: part.color }"
          @pointerdown.stop="noteDown($event, i)" @dblclick.stop="noteDbl($event, i)">
          <span class="mx-roll-note-label">{{ note.name }}</span>
          <span class="mx-roll-resize" title="Kéo để đổi độ dài" @pointerdown.stop="startDrag($event, i, 'resize')"></span>
        </div>
        <div v-if="marquee" class="mx-roll-marquee" :style="{
          left: Math.min(marquee.x1,marquee.x2)+'px', top: Math.min(marquee.y1,marquee.y2)+'px',
          width: Math.abs(marquee.x2-marquee.x1)+'px', height: Math.abs(marquee.y2-marquee.y1)+'px'
        }" aria-hidden="true"></div>
        <span class="mx-roll-grid-cursor" :style="{left:playheadX+'px'}"></span>
      </div>
    </div>
    <div class="mx-roll-velocity-title">
      <span><i class="fas fa-sliders-h"></i> Velocity — Lực đánh (1–127)</span>
      <span v-if="selected >= 0">Nốt {{ draft[selected]?.name }} · {{ Math.round((draft[selected]?.velocity || 0) * 127) }}</span>
      <span v-else>{{ velocityDrawing ? "Vẽ đường: kéo chuột trên vùng Velocity" : "Kéo cột để chỉnh lực đánh (chọn nhiều nốt để chỉnh cả nhóm)" }}</span>
    </div>
    <div ref="velocityWindow" class="mx-roll-velocity-window" :class="{ 'mx-roll-velocity-drawing': velocityDrawing }" @pointerdown="beginVelocityDraw">
      <div class="mx-roll-velocity-inner" :style="{ width: gridWidth + 'px', transform: 'translateX(-' + gridScrollLeft + 'px)' }">
        <span class="mx-roll-velocity-cursor" :style="{left:playheadX+'px'}"></span>
        <span v-for="(note, i) in draft" :key="i" class="mx-roll-velocity-bar" :class="{ selected: selectedIndices.includes(i) }"
          :title="note.name + ' · Velocity ' + Math.round(note.velocity * 127)"
          :style="{ left: KEY_W + note.time * pixelsPerSecond + 'px', height: (note.velocity * 100) + '%', backgroundColor: part.color }"
          @pointerdown.prevent="velocityBarDown($event, i)"></span>
      </div>
    </div>
    <div class="mx-roll-hint">Nhấp đúp thêm nốt · Kéo để sửa · Ctrl+Z hoàn tác · Nhịp / Velocity / Scale: mở công cụ nâng cao</div>
  </section>
</template>
