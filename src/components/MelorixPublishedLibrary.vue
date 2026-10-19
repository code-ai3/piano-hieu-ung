<script setup lang="ts">
import {ref,computed,onMounted} from 'vue'
import {loadPublishedLibrary,publishedInstrumentUrl} from '@/util/melorix-published-library'
import type {PublishedInstrument} from '@/util/melorix-published-library'
defineProps<{busy:boolean}>()
const emit=defineEmits<{
 (e:'close'):void
 (e:'choose',item:PublishedInstrument):void
}>()
const items=ref<PublishedInstrument[]>([])
const loading=ref(true)
const error=ref('')
const filter=ref<'all'|'wav'|'nki'|'nkm'>('all')
const search=ref('')
const visible=computed(()=>{
 const term=search.value.trim().toLocaleLowerCase('vi')
 return items.value.filter(i=>(filter.value==='all'||i.format===filter.value)
   &&(!term||(i.label+' '+(i.family??'')).toLocaleLowerCase('vi').includes(term)))
})
const bundledCount=computed(()=>items.value.filter(i=>i.delivery!=='drive').length)
async function refresh(){
 loading.value=true
 error.value=''
 try{items.value=await loadPublishedLibrary()}
 catch(e){console.warn('MELORIX shared library:',e);error.value='Không tải được danh mục nhạc cụ chung. Hãy thử lại.'}
 finally{loading.value=false}
}
onMounted(()=>void refresh())
</script>
<template>
<Teleport to="body">
 <div class="mx-editor-overlay" @click.self="emit('close')">
  <section class="mx-editor-dialog mx-global-library" role="dialog" aria-modal="true" aria-label="Thư viện nhạc cụ MELORIX">
   <header class="mx-editor-dialog-header">
    <div><span class="mx-editor-dialog-eyebrow">LUNOR MUSIC · MELORIX</span><h2>Thư viện nhạc cụ chung</h2></div>
    <button class="mx-editor-dialog-close" type="button" aria-label="Đóng" @click="emit('close')">×</button>
   </header>
   <div class="mx-editor-dialog-body mx-global-library-body">
    <p>Danh mục được lưu cùng MELORIX và luôn xuất hiện khi mở lại ứng dụng. Các NKI chạy trong <strong>Kontakt 8</strong>, không chạy trực tiếp trong trình duyệt và <strong>không cần chọn WAV từng tệp trong MELORIX</strong>.</p>
    <p v-if="!loading&&!error" class="mx-global-library-stats" role="status">{{ items.length }} nhạc cụ trong danh mục · {{ bundledCount }} tệp đóng gói ngay trên MELORIX · {{ items.length-bundledCount }} tệp lấy qua Drive</p>
    <div class="mx-global-library-filter">
     <label>Loại nhạc cụ
      <select v-model="filter" aria-label="Lọc định dạng nhạc cụ">
       <option value="all">Tất cả định dạng</option>
       <option value="nki">Kontakt NKI</option>
       <option value="nkm">Kontakt Multi NKM</option>
       <option value="wav">WAV chạy trong MELORIX</option>
      </select>
     </label>
     <label>Tìm nhạc cụ
      <input v-model="search" type="search" placeholder="Erhu, Drum, Yamaha…" aria-label="Tìm theo tên nhạc cụ">
     </label>
     <button type="button" :disabled="loading" @click="refresh">Làm mới</button>
    </div>
    <p v-if="loading" role="status">Đang tải thư viện chung…</p>
    <p v-else-if="error" class="mx-instrument-import-error" role="alert">{{ error }}</p>
    <p v-else-if="!items.length" class="mx-global-library-empty">Chưa có nhạc cụ công khai trong bản phát hành này.</p>
    <p v-else-if="!visible.length">Không tìm thấy nhạc cụ phù hợp.</p>
    <div v-for="item in visible" :key="item.id" class="mx-global-library-item">
     <div>
      <strong>{{ item.label }}</strong>
      <span>{{ item.family || 'Nhạc cụ' }} · {{ item.format.toUpperCase() }} · {{ item.delivery==='drive'?'File lưu trên Drive':'File đi kèm website' }}</span>
      <p v-if="item.description">{{ item.description }}</p>
     </div>
     <div class="mx-global-library-item-actions">
      <button v-if="item.format!=='nkm'" type="button" :disabled="busy" @click="emit('choose',item)">{{ item.format==='wav'?'Tạo track':'Thiết lập MIDI' }}</button>
      <a v-if="item.format!=='wav'" :href="publishedInstrumentUrl(item)" :download="item.delivery==='drive'?undefined:item.file" :target="item.delivery==='drive'?'_blank':undefined" :rel="item.delivery==='drive'?'noopener noreferrer':undefined">{{ item.delivery==='drive'?'Mở tệp trên Drive':'Tải '+item.format.toUpperCase() }}</a>
      <a v-if="item.samplesUrl" :href="item.samplesUrl" target="_blank" rel="noopener noreferrer">Thư viện Samples</a>
     </div>
    </div>
    <p class="mx-global-library-note"><strong>NKI/NKM và Samples:</strong> Tải nhạc cụ cùng thư mục Samples đi kèm nếu Kontakt yêu cầu, giữ nguyên cấu trúc thư viện, sau đó mở nhạc cụ trong Kontakt 8. Dùng loopMIDI để MELORIX gửi nốt. Link Drive cần có mạng và có thể chịu giới hạn tải của Google Drive. NKI trong MELORIX không đồng nghĩa Samples đã được nhúng vào website.</p>
    <p class="mx-global-library-note">Nhạc cụ được chủ thư viện xác nhận có quyền phân phối. Bản Preview chỉ để kiểm thử; việc tải NKI từ thư viện chung khác với việc Kontakt đã nạp/phát nhạc cụ.</p>
    <div class="mx-track-form-actions"><button type="button" @click="emit('close')">Đóng</button></div>
   </div>
  </section>
 </div>
</Teleport>
</template>
