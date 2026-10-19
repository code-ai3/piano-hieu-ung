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
const filter=ref<'all'|'wav'|'nki'>('all')
const visible=computed(()=>filter.value==='all'?items.value:items.value.filter(i=>i.format===filter.value))
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
    <div><span class="mx-editor-dialog-eyebrow">MELORIX · Thư viện chung</span><h2>Nhạc cụ có sẵn cho mọi người</h2></div>
    <button class="mx-editor-dialog-close" type="button" aria-label="Đóng" @click="emit('close')">×</button>
   </header>
   <div class="mx-editor-dialog-body mx-global-library-body">
    <p>Các nhạc cụ trong danh mục này được đóng gói cùng bản phát hành MELORIX, không mất khi F5 hoặc đổi thiết bị. Không cần tải lại tệp thủ công vào thư viện cá nhân.</p>
    <div class="mx-global-library-filter">
     <label>Loại nhạc cụ
      <select v-model="filter" aria-label="Lọc định dạng nhạc cụ">
       <option value="all">Tất cả</option>
       <option value="wav">WAV — phát trực tiếp trong MELORIX</option>
       <option value="nki">NKI — sử dụng qua Kontakt 8</option>
      </select>
     </label>
     <button type="button" :disabled="loading" @click="refresh">Làm mới danh mục</button>
    </div>
    <p v-if="loading" role="status">Đang tải thư viện chung…</p>
    <p v-else-if="error" class="mx-instrument-import-error" role="alert">{{ error }}</p>
    <p v-else-if="!items.length" class="mx-global-library-empty">Chưa có tệp nhạc cụ nào được chủ dự án phát hành công khai. Thư viện sẽ tự hiển thị sau khi tệp và quyền phân phối được xác nhận và đưa vào bản phát hành.</p>
    <p v-else-if="!visible.length">Chưa có nhạc cụ ở định dạng này.</p>
    <div v-for="item in visible" :key="item.id" class="mx-global-library-item">
     <div>
      <strong>{{ item.label }}</strong>
      <span>{{ item.format.toUpperCase() }} · {{ item.license }}</span>
      <p v-if="item.description">{{ item.description }}</p>
     </div>
     <div class="mx-global-library-item-actions">
      <button type="button" :disabled="busy" @click="emit('choose',item)">{{ item.format==='wav'?'Dùng nhạc cụ':'Kết nối Kontakt 8' }}</button>
      <a v-if="item.format==='nki'" :href="publishedInstrumentUrl(item)" :download="item.file">Tải file NKI</a>
     </div>
    </div>
    <p class="mx-global-library-note"><strong>Lưu ý về NKI:</strong> MELORIX không thể thực thi Kontakt trong trình duyệt. Người dùng phải cài Kontakt tương thích và mở NKI tại đó. Nếu NKI tham chiếu các samples ngoài chưa có, Kontakt sẽ yêu cầu thư viện gốc; không cần nạp WAV vào MELORIX.</p>
    <p class="mx-global-library-note">Chỉ chủ dự án phát hành nhạc cụ vào thư viện chung thông qua bản cập nhật đã được kiểm duyệt, không phải mọi người truy cập đều có quyền tự đăng tệp.</p>
    <div class="mx-track-form-actions"><button type="button" @click="emit('close')">Đóng</button></div>
   </div>
  </section>
 </div>
</Teleport>
</template>
