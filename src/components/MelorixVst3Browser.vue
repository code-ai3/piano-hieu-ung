<script setup lang="ts">
import {onMounted,onUnmounted,ref} from 'vue'
import {Vst3PreviewPlayer} from '@/util/melorix-vst3-preview'
import {diagnoseLocalVst3} from '@/util/melorix-vst3-diagnostics'
import type {LocalVst3QaReport} from '@/util/melorix-vst3-diagnostics'

const emit=defineEmits<{(event:'close'):void;(event:'bindings-change',ids:number[]):void;(event:'live-change',id:number|null):void;(event:'diagnostic-change',busy:boolean):void}>()
const props=defineProps<{tracks:{id:number;label:string}[];playing:boolean}>()
type InstalledVst3={name:string;path:string;hasBinary:boolean}
type ScannerResult={schema:1;engine:'discovery-only';plugins:InstalledVst3[]}
type LoadedTrack={track:number;plugin:string;path:string;componentInitialized:boolean;editorOpened?:boolean;liveAudio?:boolean}
type TrackStatus={schema:3;ok:true;tracks:LoadedTrack[];audioConnected:boolean;editorOpened:false;liveTrack?:number}
type NativeApi={
 environment:'desktop'
 scanVst3:()=>Promise<ScannerResult>
 bindVst3Track:(id:number,path:string)=>Promise<unknown>
 unbindVst3Track:(id:number)=>Promise<unknown>
 listVst3Tracks:()=>Promise<TrackStatus>
 openVst3Editor:(id:number)=>Promise<unknown>
 closeVst3Editor:(id:number)=>Promise<unknown>
 auditionVst3Note:(track:number,pitch:number,velocity:number,durationMs:number)=>Promise<{audioBase64:string;peak:number;nonzeroSamples:number;track:number;format:'wav-f32';source:'vst3-process'}>
 startLiveVst3Track:(id:number)=>Promise<unknown>
 stopLiveVst3:()=>Promise<unknown>
 sendLiveVst3Note:(id:number,pitch:number,velocity:number)=>Promise<unknown>
}
const api=(window as Window&{melorixDesktop?:NativeApi}).melorixDesktop
const scanning=ref(false)
const error=ref('')
const plugins=ref<InstalledVst3[]>([])
const scanned=ref(false)
const selectedTrackId=ref<number|null>(null)
const selectedPluginPath=ref('')
const binding=ref(false)
const hearingTrack=ref<number|null>(null)
const auditionPeak=ref<number|null>(null)
const liveBusy=ref(false)
const preview=new Vst3PreviewPlayer()
const diagnosticTrack=ref<number|null>(null)
const qaReport=ref<LocalVst3QaReport|null>(null)
const qaPlugin=ref('')
const heardResult=ref<'none'|'yes'|'no'>('none')
async function runDiagnostic(slot:LoadedTrack){
 if(!api||diagnosticTrack.value!==null||props.playing||binding.value||liveBusy.value||hearingTrack.value!==null)return
 diagnosticTrack.value=slot.track
 qaReport.value=null
 qaPlugin.value=slot.plugin
 heardResult.value='none'
 routingError.value=''
 emit('diagnostic-change',true)
 try{
  qaReport.value=await diagnoseLocalVst3(api,slot.track,
   id=>preview.play(api,id,60,100,650).then(result=>({peak:result.peak,nonzeroSamples:result.nonzeroSamples})))
  await refreshBindings()
 }catch(error){routingError.value=error instanceof Error?error.message:String(error)}
 finally{diagnosticTrack.value=null;emit('diagnostic-change',false)}
}
async function copyDiagnostic(){
 const r=qaReport.value
 if(!r)return
 const text=[
  'MELORIX VST3 local QA — chưa tự xác minh Kontakt/NKI',
  'Track: '+r.track+' | Plugin: '+qaPlugin.value,
  'Loaded: '+r.loaded+' | Editor opened: '+r.editorOpened,
  'PCM: '+r.hasPcm+' | peak: '+(r.pcmPeak?.toFixed(4)??'N/A')+' | nonzero: '+(r.pcmNonzeroSamples??'N/A'),
  'WASAPI: '+r.wasapiConnected+' | Note On: '+r.noteOnAccepted+' | Note Off: '+r.noteOffAccepted+' | Clean stop: '+r.cleanStop,
  'Technical QA: '+(r.complete?'PASS':'NOT YET'),
  'Nghe được tiếng thực tế: '+(heardResult.value==='yes'?'CÓ':heardResult.value==='no'?'KHÔNG':'CHƯA XÁC NHẬN'),
  ...r.errors.map(message=>'Lỗi: '+message),
 ].join('\n')
 try{await navigator.clipboard.writeText(text)}
 catch{routingError.value='Không sao chép được kết quả; hãy chụp màn hình báo cáo.'}
}

async function hearRealVst3(track:number){
 if(!api?.auditionVst3Note||hearingTrack.value!==null)return
 hearingTrack.value=track;routingError.value='';auditionPeak.value=null
 try{
  await preview.warmup()
  const result=await preview.play(api,track,60,105,650)
  auditionPeak.value=result.peak
  if(result.nonzeroSamples===0)routingError.value='Plugin đã xử lý nốt nhưng chưa trả âm thanh. Kiểm tra nhạc cụ/NKI trong plugin.'
 }catch(error){routingError.value=error instanceof Error?error.message:String(error)}
 finally{hearingTrack.value=null}
}

const routingError=ref('')
async function toggleLive(slot:LoadedTrack){
 if(!api?.startLiveVst3Track||!api?.stopLiveVst3||liveBusy.value||diagnosticTrack.value!==null)return
 liveBusy.value=true;routingError.value=''
 try{
  if(slot.liveAudio)await api.stopLiveVst3()
  else await api.startLiveVst3Track(slot.track)
  await refreshBindings()
 }catch(error){routingError.value=error instanceof Error?error.message:String(error)}
 finally{liveBusy.value=false}
}
const loaded=ref<LoadedTrack[]>([])
async function refreshBindings(){
 if(!api?.listVst3Tracks)return
 try{
  const snapshot=await api.listVst3Tracks()
  if(!Array.isArray(snapshot.tracks))throw Error('Danh sách track VST3 không hợp lệ')
  loaded.value=snapshot.tracks.filter(entry=>entry.componentInitialized)
  emit('bindings-change',loaded.value.map(x=>x.track))
  emit('live-change',snapshot.audioConnected?snapshot.liveTrack??null:null)
 }catch(error){routingError.value=error instanceof Error?error.message:String(error)}
}
async function bindToTrack(){
 if(!api?.bindVst3Track||diagnosticTrack.value!==null||selectedTrackId.value===null||!selectedPluginPath.value||
  binding.value||!props.tracks.some(t=>t.id===selectedTrackId.value))return
 const plugin=plugins.value.find(p=>p.path===selectedPluginPath.value&&p.hasBinary)
 if(!plugin)return
 binding.value=true;routingError.value=''
 try{
  await api.bindVst3Track(selectedTrackId.value,plugin.path)
  await refreshBindings()
 }catch(error){routingError.value=error instanceof Error?error.message:String(error)}
 finally{binding.value=false}
}
async function toggleEditor(slot:LoadedTrack){
 if(!api?.openVst3Editor||!api?.closeVst3Editor||binding.value||diagnosticTrack.value!==null)return
 binding.value=true;routingError.value=''
 try{
  if(slot.editorOpened)await api.closeVst3Editor(slot.track)
  else await api.openVst3Editor(slot.track)
  await refreshBindings()
 }catch(error){routingError.value=error instanceof Error?error.message:String(error)}
 finally{binding.value=false}
}
async function removeBinding(id:number){
 if(!api?.unbindVst3Track||binding.value||diagnosticTrack.value!==null)return
 binding.value=true;routingError.value=''
 try{await api.unbindVst3Track(id);await refreshBindings()}
 catch(error){routingError.value=error instanceof Error?error.message:String(error)}
 finally{binding.value=false}
}
async function scanInstalled(){
 if(!api||scanning.value)return
 scanning.value=true;error.value=''
 try{
  const data=await api.scanVst3()
  if(data.schema!==1||data.engine!=='discovery-only'||!Array.isArray(data.plugins)){
   throw Error('Dữ liệu quét VST3 không đúng định dạng')
  }
  plugins.value=data.plugins.filter(plugin=>
   typeof plugin.name==='string'&&typeof plugin.path==='string'&&
   typeof plugin.hasBinary==='boolean')
  scanned.value=true
 }catch(cause){error.value=cause instanceof Error?cause.message:String(cause)}
 finally{scanning.value=false}
}
onUnmounted(()=>{void preview.dispose()})
onMounted(()=>{
 selectedTrackId.value=props.tracks[0]?.id??null
 void scanInstalled()
 void refreshBindings()
})
</script>

<template>
 <div class="mx-vst3-mask" role="presentation" @click.self="diagnosticTrack===null&&emit('close')">
  <section class="mx-vst3-dialog" role="dialog" aria-modal="true" aria-labelledby="mx-vst3-dialog-title">
   <header class="mx-vst3-header">
    <div>
     <h3 id="mx-vst3-dialog-title"><i class="fas fa-puzzle-piece" aria-hidden="true"></i> MELORIX VST3</h3>
     <p>Danh sách nhạc cụ VST3 đã cài trên Windows</p>
    </div>
    <button type="button" :disabled="diagnosticTrack!==null" aria-label="Đóng trình quản lý VST3" @click="emit('close')">✕</button>
   </header>
   <p class="mx-vst3-development" role="note">
    Giai đoạn 3D thử nghiệm — VST3 theo track, nghe thử PCM và có thể bật tiếng live qua thiết bị Windows WASAPI.
    Có thể mở cửa sổ giao diện gốc của plugin ngay từ track MELORIX, nếu VST3 cung cấp Windows editor.
    <strong>Chưa kết nối âm thanh Kontakt hoặc chọn NKI được kiểm chứng</strong>; cửa sổ editor là native do chính plugin vẽ, không phải bản giả lập.
   </p>
   <div class="mx-vst3-actionbar">
    <button type="button" :disabled="scanning||!api||diagnosticTrack!==null" @click="scanInstalled">
     <i class="fas fa-sync-alt" aria-hidden="true"></i>
     {{ scanning?'Đang quét…':'Quét lại VST3' }}
    </button>
    <span v-if="scanned">{{ plugins.length }} plugin được tìm thấy</span>
   </div>
   <section v-if="api?.bindVst3Track" class="mx-vst3-assign-panel" aria-label="Gán nhạc cụ VST3 cho track">
     <strong>Gắn plugin vào track MIDI</strong>
     <p>Chỉ chọn plugin đã quét từ máy. Nút Nghe thử dùng PCM thật từ VST3. Bật WASAPI cho một track để bấm phím Piano Roll nghe live, GĐ3C1 cho phép Play toàn bộ MIDI trên một track đã bật WASAPI; chưa trộn nhiều track native hoặc hỗ trợ ASIO. Tắt WASAPI trước khi chẩn đoán.</p>
     <div class="mx-vst3-assign-row">
       <select v-model="selectedTrackId" :disabled="binding||!props.tracks.length" aria-label="Chọn track MIDI">
         <option v-for="part in props.tracks" :key="part.id" :value="part.id">{{ part.label }}</option>
       </select>
       <select v-model="selectedPluginPath" :disabled="binding||!plugins.some(p=>p.hasBinary)" aria-label="Chọn plugin VST3">
         <option value="">— Chọn VST3 —</option>
         <option v-for="plugin in plugins.filter(p=>p.hasBinary)" :key="plugin.path" :value="plugin.path">{{ plugin.name }}</option>
       </select>
       <button type="button" :disabled="binding||selectedTrackId===null||!selectedPluginPath" @click="bindToTrack">
         {{ binding?'Đang xử lý…':'Nạp plugin cho track' }}
       </button>
     </div>
     <p v-if="!props.tracks.length">Chưa có track MIDI. Tạo hoặc nhập track trước khi gắn plugin.</p>
     <p v-if="routingError" class="mx-vst3-error" role="alert">{{ routingError }}</p>
     <p v-if="auditionPeak!==null" role="status">Nguồn nghe thử: plugin VST3 thật · PCM float32 không nén · peak {{ auditionPeak.toFixed(3) }}. Đây là nghe thử offline, chưa phát liên tục từ Piano Roll.</p>
     <div v-for="slot in loaded" :key="slot.track" class="mx-vst3-loaded-row">
       <span>Track {{ slot.track }} — {{ slot.plugin }} <small>{{ slot.editorOpened?'Editor native đang mở · ':'Đã khởi tạo · ' }}{{slot.liveAudio?'WASAPI live đang bật':'WASAPI chưa bật'}}</small></span>
       <div class="mx-vst3-loaded-actions">
         <button type="button" :disabled="binding||liveBusy||diagnosticTrack!==null" @click="toggleLive(slot)">{{liveBusy?'Đang kết nối…':slot.liveAudio?'Tắt WASAPI':'Bật WASAPI (thử)'}}</button>
          <button type="button" :disabled="binding||hearingTrack!==null||diagnosticTrack!==null||!!slot.liveAudio" title="Tắt WASAPI trước khi render đoạn WAV riêng" @click="hearRealVst3(slot.track)">{{ hearingTrack===slot.track?'Đang render…':'Nghe thử C4 từ VST3' }}</button>
         <button type="button" :disabled="binding||diagnosticTrack!==null" @click="toggleEditor(slot)">
           {{ slot.editorOpened?'Đóng giao diện':'Mở giao diện VST3' }}
         </button>
         <button type="button" :disabled="binding||diagnosticTrack!==null" @click="removeBinding(slot.track)">Gỡ</button>
         <button type="button" :disabled="binding||liveBusy||diagnosticTrack!==null||!!slot.liveAudio||props.playing" @click="runDiagnostic(slot)">{{diagnosticTrack===slot.track?'Đang kiểm tra…':'Chẩn đoán VST3'}}</button>
       </div>
     </div>
     <section v-if="qaReport" class="mx-vst3-qa" role="status" aria-label="Kết quả chẩn đoán">
       <strong>Chẩn đoán trên Windows — Track {{qaReport.track}}</strong>
       <p>Plugin: {{qaPlugin}} · PCM: {{qaReport.hasPcm?'Có tín hiệu':'Chưa có tín hiệu'}} · Peak: {{qaReport.pcmPeak?.toFixed(4)??'N/A'}}</p>
       <p>WASAPI: {{qaReport.wasapiConnected?'Đã kết nối':'Chưa kết nối'}} · Note On: {{qaReport.noteOnAccepted?'Đạt':'Chưa đạt'}} · Note Off: {{qaReport.noteOffAccepted?'Đạt':'Chưa đạt'}} · Dừng: {{qaReport.cleanStop?'Đạt':'Chưa đạt'}}</p>
       <p><strong>{{qaReport.complete?'Kiểm thử kỹ thuật đạt':'Kiểm thử kỹ thuật chưa đạt'}}</strong>. Chưa tự chứng minh Kontakt/NKI có tiếng trên loa.</p>
       <p v-for="(message,index) in qaReport.errors" :key="index" class="mx-vst3-error">{{message}}</p>
       <label class="mx-vst3-heard">Bạn có nghe nốt C4 thật không?
         <select v-model="heardResult" aria-label="Âm thanh nghe thực tế"><option value="none">Chưa xác nhận</option><option value="yes">Có tiếng</option><option value="no">Không có tiếng</option></select>
       </label>
       <button type="button" @click="copyDiagnostic">Sao chép kết quả QA</button>
     </section>
   </section>
   <p v-if="!api" role="alert" class="mx-vst3-error">Chỉ khả dụng trên MELORIX Desktop (Windows). Trang web không được phép quét plugin máy tính.</p>
   <p v-else-if="error" role="alert" class="mx-vst3-error">{{ error }}</p>
   <div class="mx-vst3-plugin-list">
    <p v-if="scanned&&!plugins.length">Chưa tìm thấy VST3 trong thư mục hệ thống. Có thể Kontakt chưa được cài dưới dạng VST3 hoặc nằm ở đường dẫn riêng.</p>
    <article v-for="plugin in plugins" :key="plugin.path" class="mx-vst3-plugin">
     <div class="mx-vst3-plugin-title">
      <i class="fas fa-music" aria-hidden="true"></i>
      <strong>{{ plugin.name }}</strong>
      <span>{{ plugin.hasBinary?'Đã tìm thấy tệp VST3':'Chưa tìm thấy tệp nhị phân x64' }}</span>
     </div>
     <small :title="plugin.path">{{ plugin.path }}</small>
    </article>
   </div>
   <footer>
    <span>Chỉ đọc; không mở hoặc chạy mã plugin khi quét.</span>
    <button type="button" :disabled="diagnosticTrack!==null" @click="emit('close')">Đóng</button>
   </footer>
  </section>
 </div>
</template>

<style scoped>
.mx-vst3-mask{position:fixed;inset:0;z-index:1000;background:#000b;display:grid;place-items:center;padding:16px}
.mx-vst3-dialog{width:min(690px,100%);max-height:90vh;background:#1b2430;border:1px solid #536377;border-radius:13px;box-shadow:0 15px 60px #000a;display:flex;flex-direction:column;color:#e3eaf5;overflow:auto}
.mx-vst3-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #364556}
.mx-vst3-header h3{font-size:17px;font-weight:750;margin:0 0 3px}
.mx-vst3-header p{font-size:12px;color:#acbcd1;margin:0}
.mx-vst3-header button{border:0;color:#e3eaf5;background:transparent;font-size:18px;cursor:pointer}
.mx-vst3-development{padding:13px 18px;background:#342b1b;color:#ffe3b4;border-bottom:1px solid #77582f;font-size:12px;line-height:1.6}
.mx-vst3-actionbar{padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}
.mx-vst3-actionbar button,.mx-vst3-dialog footer button{padding:7px 11px;border:1px solid #bd8654;background:#754c2d;color:#fff5e7;border-radius:6px;cursor:pointer}
.mx-vst3-actionbar button:disabled{opacity:.5;cursor:wait}
.mx-vst3-plugin-list{min-height:85px;max-height:48vh;overflow:auto;padding:8px 18px 18px}
.mx-vst3-plugin-list>p{font-size:12px;color:#bdc8d7}
.mx-vst3-plugin{padding:11px;margin-top:7px;border:1px solid #3e5269;background:#222f40;border-radius:7px}
.mx-vst3-plugin-title{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:13px}
.mx-vst3-plugin-title span{margin-left:auto;font-size:10px;color:#9fcbac}
.mx-vst3-plugin small{display:block;color:#9aaac0;overflow-wrap:anywhere;margin-top:6px;font-size:10px}
.mx-vst3-error{margin:0 18px;color:#ffb2af;font-size:12px}
.mx-vst3-dialog footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 18px;border-top:1px solid #364556;color:#9faec0;font-size:11px}
@media(max-width:560px){.mx-vst3-plugin-title span{margin-left:0;width:100%}.mx-vst3-dialog footer{align-items:flex-start}}
.mx-vst3-assign-panel{padding:12px 18px;border-bottom:1px solid #46566a;background:#243344}
.mx-vst3-assign-panel strong{font-size:13px;color:#ffdc9e}
.mx-vst3-assign-panel p{font-size:11px;line-height:1.5;color:#b6c8dc;margin:6px 0}
.mx-vst3-assign-row{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:8px}
.mx-vst3-assign-row select{min-width:110px;flex:1;padding:7px;background:#1a2737;color:#fff;border:1px solid #566b85;border-radius:5px;font-size:11px}
.mx-vst3-assign-row button,.mx-vst3-loaded-row button{padding:7px 9px;background:#895432;border:1px solid #d69761;border-radius:5px;color:#fff;font-size:11px;cursor:pointer}
.mx-vst3-assign-row button:disabled,.mx-vst3-loaded-row button:disabled{opacity:.45;cursor:default}
.mx-vst3-loaded-row{padding:8px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #4e5d70;font-size:12px}
.mx-vst3-loaded-row small{display:block;color:#dfb678;font-size:10px;margin-top:3px}
.mx-vst3-assign-panel .mx-vst3-error{margin:8px 0;color:#ffb5ab}
.mx-vst3-loaded-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}

.mx-vst3-qa{border:1px solid #68819c;border-radius:8px;background:#1d3045;padding:11px;margin-top:10px;font-size:12px;color:#dce6f4}
.mx-vst3-qa p{margin:5px 0;line-height:1.5}
.mx-vst3-qa .mx-vst3-error{margin:5px 0;color:#ffb2af}
.mx-vst3-heard{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:9px 0}
.mx-vst3-heard select{background:#142333;color:#fff;border:1px solid #5a6f87;padding:5px}
.mx-vst3-qa button{border:1px solid #d69761;background:#895432;color:white;border-radius:5px;padding:7px 9px}
</style>
