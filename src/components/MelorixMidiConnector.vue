<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { midiBridge } from '@/util/melorix-midi-bridge'
import { midiNoteName } from '@/util/midi-edit'
const emit=defineEmits<{(e:'close'):void}>()
const supported=midiBridge.supported
const busy=ref(false)
const options=ref(midiBridge.outputs)
const selected=ref(midiBridge.selectedId)
const granted=ref(midiBridge.granted)
const connected=ref(midiBridge.connected)
const status=ref(midiBridge.status)
const playback=ref(midiBridge.playbackEnabled)
const testNote=ref(60)
const testChannel=ref(1)
let unsubscribe:(()=>void)|null=null
function refresh(){
 options.value=midiBridge.outputs
 selected.value=midiBridge.selectedId
 granted.value=midiBridge.granted
 connected.value=midiBridge.connected
 status.value=midiBridge.status
 playback.value=midiBridge.playbackEnabled
}
async function grant(){busy.value=true;try{await midiBridge.requestAccess()}finally{busy.value=false;refresh()}}
function choosePort(e:Event){midiBridge.selectPort((e.target as HTMLSelectElement).value)}
function test(){midiBridge.test(testNote.value,testChannel.value-1)}
function setPlayback(e:Event){midiBridge.setPlayback((e.target as HTMLInputElement).checked)}
function disconnect(){midiBridge.disconnect()}
onMounted(()=>{unsubscribe=midiBridge.subscribe(refresh);refresh()})
onUnmounted(()=>{unsubscribe?.()})
</script>

<template>
  <Teleport to="body">
    <div class="mx-editor-overlay" @click.self="emit('close')">
      <section class="mx-editor-dialog" role="dialog" aria-modal="true" aria-label="Kết nối MIDI ngoài">
        <header class="mx-editor-dialog-header">
          <div><span class="mx-editor-dialog-eyebrow">MELORIX · Bảng điều khiển chỉnh sửa</span>
            <h2>Kết nối MIDI ngoài (Kontakt 8)</h2></div>
          <button type="button" class="mx-editor-dialog-close" aria-label="Đóng" @click="emit('close')"><i class="fas fa-times"></i></button>
        </header>
        <div class="mx-editor-dialog-body mx-midi-bridge-body">
          <p><strong>Giai đoạn 1:</strong> Gửi nốt MIDI từ MELORIX qua một cổng MIDI mà bạn chọn trên Windows. Chưa điều khiển Kontakt 8 tự động.</p>
          <p v-if="!supported" class="mx-instrument-import-error">Chỉ dùng được trên Chrome hoặc Edge Windows có Web MIDI; Safari iPad không hỗ trợ.</p>
          <button class="mx-midi-button" type="button" :disabled="busy || !supported" @click="grant">
            {{ busy ? 'Đang cấp quyền…' : 'Cấp quyền / Làm mới MIDI' }}
          </button>
          <label>Cổng MIDI đầu ra
            <select :value="selected" :disabled="!granted || !options.length" @change="choosePort">
              <option value="">— Chọn cổng MIDI —</option>
              <option v-for="port in options" :key="port.id" :value="port.id">{{ port.label }}</option>
            </select>
          </label>
          <p v-if="granted && !options.length">Chưa có MIDI Output. Chúng ta sẽ cấu hình cổng MIDI ảo và Kontakt 8 trong Giai đoạn 2.</p>
          <div class="mx-midi-bridge-test">
            <label>Nốt thử
              <select v-model.number="testNote" :disabled="!connected">
                <option v-for="n in 49" :key="n" :value="n+35">{{ midiNoteName(n+35) }} ({{ n+35 }})</option>
              </select>
            </label>
            <label>Kênh MIDI
              <select v-model.number="testChannel" :disabled="!connected">
                <option v-for="n in 16" :key="n" :value="n">{{ n }}</option>
              </select>
            </label>
            <button class="mx-midi-button" type="button" :disabled="!connected" @click="test">Thử nốt</button>
          </div>
          <label class="mx-midi-bridge-checkbox">
            <input type="checkbox" :checked="playback" :disabled="!connected" @change="setPlayback">
            Gửi MIDI qua cổng đã chọn khi phát bài (Play)
          </label>
          <p>Piano Roll cũng gửi MIDI khi bấm phím. Stop/Pause sẽ tắt nốt đang phát. Âm thanh trong MELORIX vẫn giữ nguyên.</p>
          <p class="mx-midi-bridge-status" role="status" aria-live="polite">{{ status }}</p>
          <div class="mx-track-form-actions">
            <button type="button" :disabled="!connected" @click="disconnect">Ngắt MIDI</button>
            <button type="button" @click="emit('close')">Đóng</button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
