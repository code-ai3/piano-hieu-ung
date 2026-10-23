<script setup lang="ts">
import type {PerformanceKey,PerformanceSettings} from '@/util/melorix-stage-b-performance'
import type {PedalMode} from '@/util/melorix-auto-pedal'
const props=defineProps<{
 trackId:number
 trackName:string
 tracks:{id:number;name:string}[]
 pedalMode:PedalMode
 settings:PerformanceSettings
 volume:number
 active:boolean
 disabled:boolean
 canUndo:boolean
 canRedo:boolean
 nativeTrack:boolean
 originalAudio:boolean
 status:string
}>()
const emit=defineEmits<{
 (e:'track',id:number):void
 (e:'pedal-mode',mode:PedalMode):void
 (e:'update-setting',key:PerformanceKey,value:number):void
 (e:'volume',value:number):void
 (e:'compare'):void
 (e:'apply'):void
 (e:'pedal',mode:PedalMode):void
 (e:'reset'):void
 (e:'undo'):void
 (e:'redo'):void
}>()
function emitNumber(key:PerformanceKey,e:Event){
 const number=Number((e.target as HTMLInputElement).value)
 if(Number.isFinite(number))emit('update-setting',key,number)
}
function selectTrack(e:Event){
 const id=Number((e.target as HTMLSelectElement).value)
 if(Number.isInteger(id))emit('track',id)
}
function pedalModeInput(e:Event){emit('pedal-mode',(e.target as HTMLSelectElement).value as PedalMode)}
function volumeInput(e:Event){
 const number=Number((e.target as HTMLInputElement).value)
 if(Number.isFinite(number))emit('volume',number)
}
</script>

<template>
 <section class="mx-audio-inspector mx-panel" aria-label="Audio Inspector">
  <h3><i class="fas fa-sliders-h"></i> Audio Inspector</h3>
  <label class="mx-audio-track-switch">
   <span>Chọn track cần chỉnh riêng</span>
   <select aria-label="Track đang chỉnh âm thanh" :value="trackId" :disabled="disabled" @change="selectTrack">
    <option v-for="track in tracks" :key="track.id" :value="track.id">{{track.name}}</option>
   </select>
  </label>
  <div class="mx-audio-track"><strong>{{trackName}}</strong><span>Mỗi track có Velocity, Pan, A/B, Pedal và Undo/Redo độc lập.</span></div>
  <p v-if="originalAudio" class="mx-audio-note">Đang nghe bản thu gốc: chuyển sang chế độ MIDI để nghe tác dụng các nút này.</p>
  <p v-if="nativeTrack" class="mx-audio-note">Preview biểu cảm và Pan chỉ phát trên WebAudio. Muốn Kontakt nhận Velocity/Timing/Length, bấm Áp dụng vào MIDI. Mixer/Pan Kontakt riêng chưa có.</p>
  <div class="mx-audio-controls">
   <label><span><strong>Velocity</strong><output>{{settings.velocity}}%</output></span>
    <input type="range" min="30" max="180" step="1" :value="settings.velocity" :disabled="disabled" aria-label="Lực đánh MIDI" @input="emitNumber('velocity',$event)">
   </label>
   <label><span><strong>Humanize Timing</strong><output>±{{settings.humanizeMs}} ms</output></span>
    <input type="range" min="0" max="40" step="1" :value="settings.humanizeMs" :disabled="disabled" aria-label="Độ lệch thời gian nốt" @input="emitNumber('humanizeMs',$event)">
   </label>
   <label><span><strong>Độ dài nốt</strong><output>{{settings.lengthPercent}}%</output></span>
    <input type="range" min="40" max="170" step="1" :value="settings.lengthPercent" :disabled="disabled" aria-label="Trường độ MIDI" @input="emitNumber('lengthPercent',$event)">
   </label>
   <label><span><strong>Legato</strong><output>{{settings.legato}}%</output></span>
    <input type="range" min="0" max="100" step="1" :value="settings.legato" :disabled="disabled" aria-label="Độ nối nốt" @input="emitNumber('legato',$event)">
   </label>
   <label><span><strong>Volume</strong><output>{{volume}}%</output></span>
    <input type="range" min="0" max="100" step="1" :value="volume" :disabled="disabled" aria-label="Âm lượng Audio Inspector" @input="volumeInput">
   </label>
   <label><span><strong>Pan (web)</strong><output>{{settings.pan===0?'Giữa':settings.pan<0?'Trái '+Math.abs(settings.pan)+'%':'Phải '+settings.pan+'%'}}</output></span>
    <input type="range" min="-100" max="100" step="1" :value="settings.pan" :disabled="disabled" aria-label="Pan trái phải Audio Inspector" @input="emitNumber('pan',$event)">
   </label>
  </div>
  <div class="mx-audio-compare">
    <button type="button" :disabled="disabled" :aria-pressed="active" @click="emit('compare')">{{active?'A/B: Đang nghe bản chỉnh':'A/B: Nghe bản gốc'}}</button>
    <button type="button" :disabled="disabled" @click="emit('reset')"><i class="fas fa-undo"></i> Reset nút chỉnh</button>
  </div>
  <div class="mx-audio-actions">
    <button type="button" :disabled="disabled" @click="emit('apply')">Áp dụng vào MIDI</button>
    <button type="button" :disabled="disabled||!canUndo" @click="emit('undo')">Undo</button>
    <button type="button" :disabled="disabled||!canRedo" @click="emit('redo')">Redo</button>
  </div>
  <div class="mx-audio-pedal">
    <label>Auto Pedal CC64
      <select :value="pedalMode" :disabled="disabled" aria-label="Phong cách pedal" @change="pedalModeInput">
       <option value="light">Nhẹ nhàng</option>
       <option value="natural">Tự nhiên</option>
       <option value="deep">Ngân vang</option>
      </select>
    </label>
    <button type="button" :disabled="disabled" @click="emit('pedal',pedalMode)">Áp dụng pedal CC64</button>
  </div>
  <p v-if="status" class="mx-audio-status" role="status">{{status}}</p>
  <p class="mx-audio-disclaimer">Velocity, Humanize, Legato, Length và Pan nghe thử không phá nốt gốc. Khi áp dụng, thay đổi MIDI có thể hoàn tác. CC64 tác động tới độ ngân khi phát WebAudio và được xuất cùng MIDI; Reverb/EQ nằm ở giai đoạn D.</p>
 </section>
</template>
<style scoped>
.mx-audio-inspector{padding-bottom:13px}
.mx-audio-inspector h3{display:flex;gap:8px;align-items:center}
.mx-audio-track-switch{display:grid;gap:5px;margin:7px 0 10px;font-size:11px;color:#d9e5f3}
.mx-audio-track-switch select{width:100%;background:#19293b;color:#fff;border:1px solid #6b879f;border-radius:6px;padding:8px}
.mx-audio-track{display:flex;flex-direction:column;gap:3px;font-size:12px;margin:8px 0}
.mx-audio-track span{font-size:10px;color:#9aacc0}
.mx-audio-controls{display:grid;gap:9px}
.mx-audio-controls label{display:grid;gap:5px}
.mx-audio-controls label>span{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#dce3ed}
.mx-audio-controls output{color:#eeb078}
.mx-audio-controls input{width:100%;accent-color:#ed9551}
.mx-audio-compare,.mx-audio-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
.mx-audio-inspector button{padding:7px 8px;font-size:11px;border:1px solid #5a7088;border-radius:5px;background:#25374a;color:#eff3fc;cursor:pointer}
.mx-audio-inspector button:disabled{opacity:.45;cursor:default}
.mx-audio-actions button:first-child,.mx-audio-pedal button{background:#80532c;border-color:#ad7e45}
.mx-audio-compare button[aria-pressed="true"]{border-color:#e8b375;color:#ffd199}
.mx-audio-pedal{margin-top:12px;padding-top:9px;border-top:1px solid #344a5d;display:grid;gap:7px}
.mx-audio-pedal label{display:grid;gap:5px;font-size:11px}
.mx-audio-pedal select{background:#162637;color:#fff;border:1px solid #53687f;border-radius:5px;padding:6px}
.mx-audio-status{font-size:11px;color:#fed29c;line-height:1.5}
.mx-audio-note{font-size:11px;color:#ffd5a2;border-left:2px solid #b9772d;padding-left:7px}
.mx-audio-disclaimer{font-size:10px;color:#91a4ba;line-height:1.6;margin-top:10px}
</style>
