<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import type { MidiNoteEvent, MidiPart } from '@/util/midi-tracks'
import { midiNoteName, snapMidiTime, clampMidiVelocity } from '@/util/midi-edit'
const props=defineProps<{part:MidiPart; notes:MidiNoteEvent[]; duration:number; bpm:number; disabled:boolean}>()
const emit=defineEmits<{(e:'change',notes:MidiNoteEvent[]):void;(e:'close'):void}>()
const ROW=19, KEY_W=54, HIGH=108, LOW=21
const scroll=ref<HTMLElement|null>(null)
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
let previousTrackId: number | null = null
watch(()=>[props.part.id,props.notes],()=>{
  const switched = previousTrackId !== props.part.id
  previousTrackId = props.part.id
  draft.value = props.notes.map(n=>({...n}))
  if (switched || selected.value >= draft.value.length) selected.value = -1
  if (switched) void nextTick(centerKeys)
},{immediate:true})
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
onUnmounted(stopDrag)
</script>

<template>
  <section class="mx-roll" aria-label="Trình chỉnh sửa MIDI Piano Roll">
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
      </select></label>
      <label>Zoom <input v-model.number="pixelsPerSecond" type="range" min="18" max="140" step="2"></label>
      <button type="button" title="Đóng Piano Roll" @click="emit('close')"><i class="fas fa-times"></i></button>
    </div>
    <div class="mx-roll-ruler">
      <div :style="{ width: gridWidth + 'px', transform: 'translateX(-' + gridScrollLeft + 'px)' }">
        <span v-for="sec in ticks" :key="sec" :style="{ left: KEY_W + sec * pixelsPerSecond + 'px' }">{{ sec }}s</span>
      </div>
    </div>
    <div ref="scroll" class="mx-roll-scroll" @scroll="syncScroll">
      <div class="mx-roll-grid" :style="{ width: gridWidth + 'px', height: ROW * (HIGH - LOW + 1) + 'px', backgroundSize: (60 / Math.max(20, bpm) * pixelsPerSecond) + 'px ' + ROW + 'px' }" @dblclick.self="onGridDouble">
        <div class="mx-roll-keys">
          <div v-for="pitch in keyList" :key="pitch" :class="['mx-roll-key', { black: keyLabel(pitch).includes('#') }]" :style="{ height: ROW + 'px' }">{{ pitch % 12 === 0 ? keyLabel(pitch) : '' }}</div>
        </div>
        <div v-for="(note, i) in draft" :key="i" class="mx-roll-note" :class="{ selected: selected === i }"
          :title="note.name + ' · ' + note.time.toFixed(2) + 's · Velocity ' + Math.round(note.velocity * 127)"
          :style="{ left: KEY_W + note.time * pixelsPerSecond + 'px', top: (HIGH - note.midi) * ROW + 1 + 'px', width: Math.max(5, note.duration * pixelsPerSecond) + 'px', height: ROW - 2 + 'px', backgroundColor: part.color }"
          @pointerdown.stop="noteDown($event, i)" @dblclick.stop="noteDbl($event, i)">
          <span class="mx-roll-note-label">{{ note.name }}</span>
          <span class="mx-roll-resize" title="Kéo để đổi độ dài" @pointerdown.stop="startDrag($event, i, 'resize')"></span>
        </div>
      </div>
    </div>
    <div class="mx-roll-velocity-title">
      <span><i class="fas fa-sliders-h"></i> Velocity — Lực đánh (1–127)</span>
      <span v-if="selected >= 0">Nốt {{ draft[selected]?.name }} · {{ Math.round((draft[selected]?.velocity || 0) * 127) }}</span>
      <span v-else>Kéo từng cột lên/xuống để điều chỉnh sắc thái</span>
    </div>
    <div class="mx-roll-velocity-window">
      <div class="mx-roll-velocity-inner" :style="{ width: gridWidth + 'px', transform: 'translateX(-' + gridScrollLeft + 'px)' }">
        <span v-for="(note, i) in draft" :key="i" class="mx-roll-velocity-bar" :class="{ selected: selected === i }"
          :title="note.name + ' · Velocity ' + Math.round(note.velocity * 127)"
          :style="{ left: KEY_W + note.time * pixelsPerSecond + 'px', height: (note.velocity * 100) + '%', backgroundColor: part.color }"
          @pointerdown.prevent="startDrag($event, i, 'velocity')"></span>
      </div>
    </div>
    <div class="mx-roll-hint">Nhấp đúp vùng trống: thêm nốt · Kéo nốt: đổi cao độ/thời điểm · Kéo mép phải: đổi độ dài · Nhấp đúp nốt: xóa</div>
  </section>
</template>
