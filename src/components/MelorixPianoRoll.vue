<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { MidiNoteEvent, MidiPart } from '@/util/midi-tracks'
import { midiNoteName, snapMidiTime, clampMidiVelocity } from '@/util/midi-edit'
const props=defineProps<{part:MidiPart; notes:MidiNoteEvent[]; duration:number; bpm:number; disabled:boolean}>()
const emit=defineEmits<{(e:'change',notes:MidiNoteEvent[]):void;(e:'close'):void}>()
const ROW=19, KEY_W=54, HIGH=108, LOW=21
const scroll=ref<HTMLElement|null>(null)
const velScroll=ref<HTMLElement|null>(null)
const gridScrollLeft=ref(0)
const pixelsPerSecond=ref(40)
const snapDivision=ref(16)
const tool=ref<'select'|'draw'|'erase'>('select')
const draft=ref<MidiNoteEvent[]>([])
const selected=ref(-1)
const totalWidth=computed(()=>Math.max(1100,(Math.max(props.duration,...draft.value.map(n=>n.time+n.duration),0)+5)*pixelsPerSecond.value))
const gridWidth=computed(()=>totalWidth.value+KEY_W)
const snap=computed(()=>snapDivision.value ? 60/Math.max(20,props.bpm)*4/snapDivision.value : 0)
const ticks=computed(()=>Array.from({length:Math.min(2000,Math.ceil(totalWidth.value/pixelsPerSecond.value/2)+1)},(_,i)=>i*2))
const keyList=Array.from({length:HIGH-LOW+1},(_,i)=>HIGH-i)
watch(()=>[props.part.id,props.notes],()=>{draft.value=props.notes.map(n=>({...n}));selected.value=-1;void nextTick(centerKeys)},{immediate:true})
function centerKeys(){
 const e=scroll.value; if(!e)return
 const pitches=draft.value.map(n=>n.midi)
 const p=pitches.length?(Math.min(...pitches)+Math.max(...pitches))/2:60
 e.scrollTop=Math.max(0,(HIGH-p)*ROW-e.clientHeight/2)
}
function syncScroll(e:Event){gridScrollLeft.value=(e.target as HTMLElement).scrollLeft}
function snapAt(x:number){return snapMidiTime((x-KEY_W)/pixelsPerSecond.value,snap.value)}
function yToMidi(y:number){return Math.min(HIGH,Math.max(LOW,HIGH-Math.floor(y/ROW)))}
function commit(){if(!props.disabled)emit('change',draft.value.map(n=>({...n})))}
let dragging:{index:number;kind:'move'|'resize'|'velocity';x:number;y:number;original:MidiNoteEvent}|null=null
function stopDrag(){if(dragging){dragging=null;commit()}window.removeEventListener('pointermove',moveDrag);window.removeEventListener('pointerup',stopDrag)}
function startDrag(e:PointerEvent,index:number,kind:'move'|'resize'|'velocity'){
 if(props.disabled)return
 e.preventDefault();e.stopPropagation();selected.value=index
 dragging={index,kind,x:e.clientX,y:e.clientY,original:{...draft.value[index]}}
 window.addEventListener('pointermove',moveDrag);window.addEventListener('pointerup',stopDrag)
}
function moveDrag(e:PointerEvent){
 const d=dragging;if(!d)return
 const n=d.original
 if(d.kind==='velocity'){const v=clampMidiVelocity(Math.round(n.velocity*127)+(d.y-e.clientY)*1.2);draft.value[d.index]={...n,velocity:v/127};return}
 const dt=(e.clientX-d.x)/pixelsPerSecond.value
 if(d.kind==='resize'){draft.value[d.index]={...n,duration:Math.max(.04,snapMidiTime(n.duration+dt,snap.value))};return}
 const midi=Math.max(LOW,Math.min(HIGH,n.midi-Math.round((e.clientY-d.y)/ROW)))
 draft.value[d.index]={...n,midi,name:midiNoteName(midi),time:Math.max(0,snapMidiTime(n.time+dt,snap.value))}
}
function removeNote(index:number){if(props.disabled)return;draft.value.splice(index,1);selected.value=-1;commit()}
function onGridDouble(e:MouseEvent){
 if(props.disabled)return
 const grid=e.currentTarget as HTMLElement;const r=grid.getBoundingClientRect()
 const time=snapAt(e.clientX-r.left), pitch=yToMidi(e.clientY-r.top)
 draft.value.push({time,midi:pitch,name:midiNoteName(pitch),duration:Math.max(.08,snap.value||.25),velocity:95/127,trackId:props.part.id})
 selected.value=draft.value.length-1;commit()
}
function noteDown(e:PointerEvent,index:number){if(tool.value==='erase'){removeNote(index);return}startDrag(e,index,'move')}
function noteDbl(e:MouseEvent,index:number){e.stopPropagation();removeNote(index)}
function keyLabel(midi:number){return midiNoteName(midi)}
</script>
