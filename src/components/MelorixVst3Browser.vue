<script setup lang="ts">
import {onMounted,ref} from 'vue'

const emit=defineEmits<{(event:'close'):void}>()
type InstalledVst3={name:string;path:string;hasBinary:boolean}
type ScannerResult={schema:1;engine:'discovery-only';plugins:InstalledVst3[]}
type NativeApi={environment:'desktop';scanVst3:()=>Promise<ScannerResult>}
const api=(window as Window&{melorixDesktop?:NativeApi}).melorixDesktop
const scanning=ref(false)
const error=ref('')
const plugins=ref<InstalledVst3[]>([])
const scanned=ref(false)
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
onMounted(()=>void scanInstalled())
</script>

<template>
 <div class="mx-vst3-mask" role="presentation" @click.self="emit('close')">
  <section class="mx-vst3-dialog" role="dialog" aria-modal="true" aria-labelledby="mx-vst3-dialog-title">
   <header class="mx-vst3-header">
    <div>
     <h3 id="mx-vst3-dialog-title"><i class="fas fa-puzzle-piece" aria-hidden="true"></i> MELORIX VST3</h3>
     <p>Danh sách nhạc cụ VST3 đã cài trên Windows</p>
    </div>
    <button type="button" aria-label="Đóng trình quản lý VST3" @click="emit('close')">✕</button>
   </header>
   <p class="mx-vst3-development" role="note">
    Giai đoạn 1 — Quét plugin thật từ ổ đĩa, <strong>chưa thể mở Kontakt hoặc phát VST3</strong>.
    Bộ host native, giao diện plugin và audio engine sẽ được triển khai ở các giai đoạn tiếp theo.
   </p>
   <div class="mx-vst3-actionbar">
    <button type="button" :disabled="scanning||!api" @click="scanInstalled">
     <i class="fas fa-sync-alt" aria-hidden="true"></i>
     {{ scanning?'Đang quét…':'Quét lại VST3' }}
    </button>
    <span v-if="scanned">{{ plugins.length }} plugin được tìm thấy</span>
   </div>
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
    <button type="button" @click="emit('close')">Đóng</button>
   </footer>
  </section>
 </div>
</template>

<style scoped>
.mx-vst3-mask{position:fixed;inset:0;z-index:1000;background:#000b;display:grid;place-items:center;padding:16px}
.mx-vst3-dialog{width:min(690px,100%);max-height:90vh;background:#1b2430;border:1px solid #536377;border-radius:13px;box-shadow:0 15px 60px #000a;display:flex;flex-direction:column;color:#e3eaf5;overflow:hidden}
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
</style>
