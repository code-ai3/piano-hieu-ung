<script setup lang="ts">
import {ref,computed,onMounted} from 'vue'
import {loadPublishedLibrary} from '@/util/melorix-published-library'
import type {PublishedInstrument} from '@/util/melorix-published-library'
const emit=defineEmits<{(e:'close'):void}>()
const instruments=ref<PublishedInstrument[]>([])
const loading=ref(true)
const error=ref('')
const query=ref('')
const family=ref('all')
const families=computed(()=>Array.from(new Set(instruments.value.map(x=>x.family||'Khác'))).sort())
const visible=computed(()=>instruments.value.filter(x=>
 (family.value==='all'||(x.family||'Khác')===family.value)&&
 (x.label+' '+(x.family??'')).toLocaleLowerCase('vi').includes(query.value.trim().toLocaleLowerCase('vi'))
))
async function refresh(){
 loading.value=true
 error.value=''
 try{instruments.value=await loadPublishedLibrary()}
 catch{error.value='Không tải được thư viện nhạc cụ. Hãy thử lại.'}
 finally{loading.value=false}
}
onMounted(()=>void refresh())
</script>
<template>
 <Teleport to="body">
  <div class="mx-editor-overlay" @click.self="emit('close')">
   <section class="mx-editor-dialog mx-global-library" role="dialog" aria-modal="true" aria-label="Thư viện nhạc cụ">
    <header class="mx-editor-dialog-header">
     <div><span class="mx-editor-dialog-eyebrow">LUNOR MUSIC · MELORIX</span><h2>Thư viện nhạc cụ</h2></div>
     <button type="button" class="mx-editor-dialog-close" aria-label="Đóng" @click="emit('close')">×</button>
    </header>
    <div class="mx-editor-dialog-body mx-global-library-body">
     <p>Danh sách nhạc cụ đã có trong MELORIX. Để sử dụng, chọn <strong>Thêm track → Chọn nhạc cụ</strong>.</p>
     <div class="mx-global-library-filter">
      <label>Nhóm
       <select v-model="family" aria-label="Lọc nhóm nhạc cụ">
        <option value="all">Tất cả nhóm</option>
        <option v-for="name in families" :key="name" :value="name">{{ name }}</option>
       </select>
      </label>
      <label>Tìm nhanh
       <input v-model="query" type="search" placeholder="Erhu, Drum, Yamaha…" aria-label="Tìm nhạc cụ">
      </label>
     </div>
     <p v-if="loading" role="status">Đang mở thư viện…</p>
     <p v-else-if="error" role="alert" class="mx-instrument-import-error">{{ error }}</p>
     <p v-else role="status">{{ visible.length }} / {{ instruments.length }} nhạc cụ</p>
     <p v-if="!loading&&!error&&!instruments.length">Thư viện hiện chưa có nhạc cụ nào.</p>
     <p v-else-if="!loading&&!error&&!visible.length">Không tìm thấy nhạc cụ.</p>
     <div v-for="item in visible" :key="item.id" class="mx-catalog-only-row">
      <strong>{{ item.label }}</strong>
      <span>{{ item.family||'Khác' }} · {{ item.format.toUpperCase() }}</span>
     </div>
     <div class="mx-track-form-actions">
      <button type="button" @click="emit('close')">Đóng</button>
     </div>
    </div>
   </section>
  </div>
 </Teleport>
</template>
<style scoped>
.mx-catalog-only-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 18px;padding:10px 12px;border-bottom:1px solid #43556a}
.mx-catalog-only-row strong{font-size:13px;color:#f4f7ff}
.mx-catalog-only-row span{font-size:12px;color:#a1b8cb}
.mx-global-library-filter input{background:#182638;color:#eff5fc;padding:8px;border:1px solid #657687;border-radius:6px;min-height:39px;width:100%}
</style>
