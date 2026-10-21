<script setup lang="ts">
import {onMounted,ref,computed} from 'vue'
type Vst3Plugin={name:string;path:string;hasBinary:boolean}
type ScanResult={schema:number;engine:string;plugins:Vst3Plugin[]}
type NativeApi={scanVst3:()=>Promise<ScanResult>}
type CreateRequest={pluginPath:string;pluginName:string;name:string;count:number}
const props=defineProps<{busy:boolean}>()
const emit=defineEmits<{(e:'close'):void;(e:'create',request:CreateRequest):void}>()
const api=(window as Window&{melorixDesktop?:NativeApi}).melorixDesktop
const plugins=ref<Vst3Plugin[]>([])
const loading=ref(false),error=ref('')
const selectedPath=ref('')
const name=ref('')
const count=ref(1)
const selected=computed(()=>plugins.value.find(p=>p.path===selectedPath.value&&p.hasBinary))
async function scan(){
 if(!api?.scanVst3||loading.value||props.busy)return
 loading.value=true;error.value=''
 try{
  const result=await api.scanVst3()
  if(result.schema!==1||result.engine!=='discovery-only'||!Array.isArray(result.plugins))
   throw Error('Danh sách VST3 không hợp lệ')
  plugins.value=result.plugins.filter(p=>typeof p.name==='string'&&typeof p.path==='string'&&p.hasBinary===true)
  if(!plugins.value.some(p=>p.path===selectedPath.value))
   selectedPath.value=plugins.value[0]?.path??''
 }catch(e){error.value=e instanceof Error?e.message:String(e)}
 finally{loading.value=false}
}
function submit(){
 if(props.busy||!selected.value)return
 if(!Number.isInteger(count.value)||count.value<1||count.value>4){
  error.value='Số track phải từ 1 đến 4';return
 }
 emit('create',{pluginPath:selected.value.path,pluginName:selected.value.name,
  name:name.value.trim().slice(0,60),count:count.value})
}
onMounted(()=>{void scan()})
</script>

<template>
  <div class="mx-native-track-overlay" role="presentation" @click.self="!busy&&emit('close')">
    <section class="mx-native-track-dialog" role="dialog" aria-modal="true" aria-labelledby="mx-native-add-title">
      <header>
        <h2 id="mx-native-add-title"><i class="fas fa-keyboard" aria-hidden="true"></i> Thêm Instrument Track</h2>
        <button type="button" :disabled="busy" aria-label="Đóng" @click="emit('close')"><i class="fas fa-times"></i></button>
      </header>
      <form @submit.prevent="submit">
        <label>Nhạc cụ VST3 đã cài trên Windows
          <span class="mx-native-track-inline">
            <select v-model="selectedPath" :disabled="busy||loading||!plugins.length" aria-label="Chọn nhạc cụ VST3 cho track">
              <option v-for="plugin in plugins" :key="plugin.path" :value="plugin.path">{{plugin.name}}</option>
            </select>
            <button type="button" :disabled="busy||loading" @click="scan">{{loading?'Đang quét…':'Quét lại'}}</button>
          </span>
        </label>
        <label>Nguồn MIDI
          <select disabled><option>MIDI từ Piano Roll (nội bộ)</option></select>
        </label>
        <label>Đầu ra âm thanh
          <select disabled><option>WASAPI shared (thử nghiệm: một track đang phát)</option></select>
        </label>
        <label>Tên track
          <input v-model="name" maxlength="60" placeholder="Ví dụ: Violin, Piano RH, Strings">
        </label>
        <label>Số lượng track (1–4)
          <input v-model.number="count" type="number" min="1" max="4" step="1" :disabled="busy">
        </label>
        <p class="mx-native-track-note">Mỗi track được gắn một instance VST3 riêng. Có thể mở editor để chọn NKI cho từng track. Bản thử hiện mới phát <strong>một track VST3 qua WASAPI tại một thời điểm</strong>; chưa trộn nhiều VST3 đồng thời như Cubase.</p>
        <p v-if="!api" role="alert">Cần mở MELORIX Desktop Windows để quét và nạp VST3. Bản web không được truy cập plugin máy tính.</p>
        <p v-else-if="!loading&&!plugins.length" role="status">Không tìm thấy VST3 hợp lệ. Hãy cài plugin rồi Quét lại.</p>
        <p v-if="error" class="mx-native-track-error" role="alert">{{error}}</p>
        <footer>
          <button type="button" :disabled="busy" @click="emit('close')">Hủy</button>
          <button type="submit" :disabled="busy||loading||!selected">{{busy?'Đang nạp plugin…':'Thêm Instrument Track'}}</button>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.mx-native-track-overlay{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;background:#000b;padding:15px}
.mx-native-track-dialog{width:min(550px,96vw);max-height:95vh;overflow:auto;background:#1b2430;color:#edf2f9;border:1px solid #586a7e;border-radius:14px;box-shadow:0 12px 45px #0009}
.mx-native-track-dialog header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #445366}
.mx-native-track-dialog h2{font-size:17px;font-weight:700;margin:0}.mx-native-track-dialog header button{border:0;background:transparent;color:inherit;cursor:pointer}
.mx-native-track-dialog form{padding:16px;display:grid;gap:13px}
.mx-native-track-dialog label{display:grid;gap:5px;font-size:12px;color:#d9e3ef}
.mx-native-track-dialog select,.mx-native-track-dialog input{width:100%;min-width:0;background:#142132;color:#fff;border:1px solid #5c708b;border-radius:6px;padding:9px}
.mx-native-track-inline{display:flex;gap:7px}.mx-native-track-inline select{flex:1}
.mx-native-track-dialog button{padding:9px 12px;border-radius:6px;border:1px solid #ad855b;background:#865230;color:#fff;cursor:pointer}
.mx-native-track-dialog button:disabled{opacity:.5;cursor:default}
.mx-native-track-note{font-size:11px;line-height:1.6;color:#cbd4e3;background:#27354a;padding:10px;border-radius:7px;margin:0}
.mx-native-track-error{color:#ffb1aa;font-size:12px}
.mx-native-track-dialog footer{display:flex;justify-content:flex-end;gap:8px}
</style>
