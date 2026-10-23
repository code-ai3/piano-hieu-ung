<script setup lang="ts">
import type {PerformanceKey,PerformanceSettings} from '@/util/melorix-stage-b-performance'
import type {PedalMode} from '@/util/melorix-auto-pedal'
import {pianoFeelPreset,normalizedPianoFeel} from '@/util/melorix-stage-c-piano'
import type {PianoFeelPreset,PianoFeelSettings} from '@/util/melorix-stage-c-piano'
import {normalizeTrackFx} from '@/util/melorix-stage-d-track-fx'
import type {TrackFxSettings} from '@/util/melorix-stage-d-track-fx'
const props=defineProps<{
 trackId:number
 trackName:string
 tracks:{id:number;name:string}[]
 pedalMode:PedalMode
 settings:PerformanceSettings
 pianoFeel:PianoFeelSettings
 fxSettings:TrackFxSettings
 fxBypassed:boolean
 fxCanUndo:boolean
 fxCanRedo:boolean
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
 (e:'piano-feel',settings:PianoFeelSettings):void
 (e:'fx-update',settings:TrackFxSettings):void
 (e:'fx-compare'):void
 (e:'fx-save'):void
 (e:'fx-undo'):void
 (e:'fx-redo'):void
 (e:'fx-reset'):void
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
function pianoFeelSelect(e:Event){
 const value=(e.target as HTMLSelectElement).value as PianoFeelPreset
 emit('piano-feel',pianoFeelPreset(value))
}
function pianoFeelNumber(key:'dynamics'|'chordRollMs',e:Event){
 const number=Number((e.target as HTMLInputElement).value)
 if(Number.isFinite(number))emit('piano-feel',normalizedPianoFeel({...props.pianoFeel,[key]:number}))
}
function fxChange(key:'bassDb'|'midDb'|'trebleDb'|'reverbWet'|'roomMs',event:Event){
 const value=Number((event.target as HTMLInputElement).value)
 if(Number.isFinite(value))emit('fx-update',normalizeTrackFx({...props.fxSettings,[key]:value}))
}
function fxEnable(event:Event){
 emit('fx-update',normalizeTrackFx({...props.fxSettings,enabled:(event.target as HTMLInputElement).checked}))
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
  <div class="mx-piano-feel">
   <h4><i class="fas fa-music"></i> Piano Performance — Giai đoạn C</h4>
   <label class="mx-piano-feel-mode">
    <span>Phong cách diễn tấu piano</span>
    <select :value="pianoFeel.preset" :disabled="disabled" aria-label="Phong cách diễn tấu piano" @change="pianoFeelSelect">
     <option value="original">Nguyên bản MIDI (tắt)</option>
     <option value="natural">Tự nhiên — cân bằng</option>
     <option value="expressive">Biểu cảm — rõ sắc thái</option>
    </select>
   </label>
   <div class="mx-audio-controls">
    <label><span><strong>Độ nhấn câu nhạc</strong><output>{{pianoFeel.dynamics}}%</output></span>
     <input type="range" min="0" max="100" step="1" :value="pianoFeel.dynamics"
      :disabled="disabled||pianoFeel.preset==='original'" aria-label="Độ nhấn câu nhạc"
      @input="pianoFeelNumber('dynamics',$event)">
    </label>
    <label><span><strong>Độ rải hợp âm</strong><output>{{pianoFeel.chordRollMs}} ms</output></span>
     <input type="range" min="0" max="24" step="1" :value="pianoFeel.chordRollMs"
      :disabled="disabled||pianoFeel.preset==='original'" aria-label="Độ rải hợp âm"
      @input="pianoFeelNumber('chordRollMs',$event)">
    </label>
   </div>
   <p class="mx-piano-hint">Độ nhấn theo câu nhạc và độ rải nốt hợp âm rất nhỏ, tính trên MIDI đang phát. A/B so sánh từng track; chỉ ghi vào MIDI khi bấm Áp dụng.</p>
  </div>
  <section class="mx-track-fx" aria-label="EQ và Reverb của track">
   <h4><i class="fas fa-sliders-h"></i> Giai đoạn D — EQ / Reverb riêng track</h4>
   <p v-if="nativeTrack||originalAudio" class="mx-audio-note">FX WebAudio không xử lý bản thu gốc hay âm thanh Kontakt native. Hãy chọn track phát MIDI bằng WebAudio để nghe thử.</p>
   <label class="mx-track-fx-enable">
     <input type="checkbox" :checked="fxSettings.enabled" :disabled="disabled||nativeTrack||originalAudio" aria-label="Bật EQ Reverb track" @change="fxEnable">
     <span>Bật xử lý EQ / Reverb trên track này</span>
   </label>
   <div class="mx-audio-controls">
    <label v-for="control in [
     {key:'bassDb',name:'Bass 180 Hz',min:-12,max:12,unit:'dB'},
     {key:'midDb',name:'Mid 1 kHz',min:-12,max:12,unit:'dB'},
     {key:'trebleDb',name:'Treble 4,5 kHz',min:-12,max:12,unit:'dB'},
     {key:'reverbWet',name:'Reverb Wet',min:0,max:70,unit:'%'}
    ]" :key="control.key">
     <span><strong>{{control.name}}</strong><output>{{fxSettings[control.key as 'bassDb'|'midDb'|'trebleDb'|'reverbWet']}}{{control.unit}}</output></span>
     <input type="range" :min="control.min" :max="control.max" step="1"
       :value="fxSettings[control.key as 'bassDb'|'midDb'|'trebleDb'|'reverbWet']"
       :disabled="disabled||nativeTrack||originalAudio||!fxSettings.enabled"
       :aria-label="'FX '+control.name" @input="fxChange(control.key as 'bassDb'|'midDb'|'trebleDb'|'reverbWet',$event)">
    </label>
    <label><span><strong>Không gian Reverb</strong><output>{{(fxSettings.roomMs/1000).toFixed(2)}} giây</output></span>
     <input type="range" min="350" max="2200" step="50" :value="fxSettings.roomMs"
       :disabled="disabled||nativeTrack||originalAudio||!fxSettings.enabled"
       aria-label="FX Không gian Reverb" @change="fxChange('roomMs',$event)">
    </label>
   </div>
   <div class="mx-fx-actions">
    <button type="button" :disabled="disabled||nativeTrack||originalAudio"
      :aria-pressed="!fxBypassed" @click="emit('fx-compare')">{{fxBypassed?'A/B FX: Nguyên bản (dry)':'A/B FX: Có hiệu ứng'}}</button>
    <button type="button" :disabled="disabled||nativeTrack||originalAudio" @click="emit('fx-save')">Lưu FX phiên này</button>
    <button type="button" :disabled="disabled||!fxCanUndo" @click="emit('fx-undo')">Undo FX</button>
    <button type="button" :disabled="disabled||!fxCanRedo" @click="emit('fx-redo')">Redo FX</button>
    <button type="button" :disabled="disabled||nativeTrack||originalAudio" @click="emit('fx-reset')">Reset FX</button>
   </div>
   <p class="mx-piano-hint">EQ và Reverb theo track có thể xuất trong WAV/MP4 bản phối MIDI. Lưu thành file .melorix để mở lại FX; “Lưu FX phiên này” chỉ giữ trong phiên hiện tại. MIDI .mid và Kontakt native không chứa các hiệu ứng âm thanh này.</p>
  </section>
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
  <p class="mx-audio-disclaimer">Piano Performance, Velocity, Humanize, Legato, Length và Pan nghe thử không phá nốt gốc. Khi áp dụng, thay đổi MIDI có thể hoàn tác. CC64 tác động tới độ ngân khi phát WebAudio và được xuất cùng MIDI; FX Giai đoạn D có trong bản phối WAV/MP4 từ MIDI; muốn lưu thiết lập để mở lại, dùng Tệp → Lưu dự án (.melorix).</p>
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
.mx-piano-feel{margin-top:13px;padding:10px;border:1px solid #45596e;border-radius:7px;background:#1a2938}
.mx-piano-feel h4{margin:0 0 10px;font-size:12px;color:#f3cc99}
.mx-piano-feel-mode{display:grid;gap:5px;margin-bottom:11px;font-size:11px}
.mx-piano-feel select{width:100%;background:#162637;color:#fff;border:1px solid #53687f;border-radius:5px;padding:7px}
.mx-piano-hint{font-size:10px;color:#9fb3c9;line-height:1.5;margin:8px 0 0}
.mx-track-fx{margin-top:13px;padding:10px;border:1px solid #476d86;border-radius:7px;background:#152838}
.mx-track-fx h4{font-size:12px;color:#b7dafa;margin:0 0 9px}
.mx-track-fx-enable{display:flex;align-items:center;gap:8px;font-size:11px;margin:6px 0 10px}
.mx-track-fx-enable input{accent-color:#5ca6de}
.mx-fx-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
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
