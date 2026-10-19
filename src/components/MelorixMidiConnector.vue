<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { midiBridge } from '@/util/melorix-midi-bridge'
import { midiNoteName } from '@/util/midi-edit'
const emit=defineEmits<{(e:'close'):void}>()
defineProps<{playing:boolean}>()
const supported=midiBridge.supported
const busy=ref(false)
const options=ref(midiBridge.outputs)
const selected=ref(midiBridge.selectedId)
const granted=ref(midiBridge.granted)
const connected=ref(midiBridge.connected)
const status=ref(midiBridge.status)
const playback=ref(midiBridge.playbackEnabled)
const externalOnly=ref(midiBridge.externalOnly)
const testNote=ref(60)
const testChannel=ref(1)
const heardKontakt=ref(false)
const chosenPortLabel=computed(()=>options.value.find(port=>port.id===selected.value)?.label??'')
const mayBePhysicalOutput=computed(()=>connected.value && !/loopmidi|melorix[ -]?kontakt/i.test(chosenPortLabel.value))
const setupReady=computed(()=>connected.value && heardKontakt.value)
function confirmHeard(e:Event){heardKontakt.value=(e.target as HTMLInputElement).checked}
let unsubscribe:(()=>void)|null=null
function refresh(){
 options.value=midiBridge.outputs
 selected.value=midiBridge.selectedId
 granted.value=midiBridge.granted
 connected.value=midiBridge.connected
 status.value=midiBridge.status
 playback.value=midiBridge.playbackEnabled
 externalOnly.value=midiBridge.externalOnly
}
async function grant(){busy.value=true;try{await midiBridge.requestAccess()}finally{busy.value=false;refresh()}}
function choosePort(e:Event){heardKontakt.value=false;midiBridge.selectPort((e.target as HTMLSelectElement).value)}
function test(){heardKontakt.value=false;midiBridge.test(testNote.value,testChannel.value-1)}
function setPlayback(e:Event){midiBridge.setPlayback((e.target as HTMLInputElement).checked)}
function setExternalOnly(e:Event){midiBridge.setExternalOnly((e.target as HTMLInputElement).checked)}
function disconnect(){heardKontakt.value=false;midiBridge.disconnect()}
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
          <div class="mx-kontakt-setup-guide" aria-label="Hướng dẫn nối Kontakt 8 thật">
            <p class="mx-kontakt-setup-head"><i class="fas fa-plug" aria-hidden="true"></i> Kết nối Kontakt 8 trên Windows</p>
            <ol>
              <li><strong>Tạo cổng MIDI ảo:</strong> cài <a href="https://www.tobias-erichsen.de/software/loopmidi.html" target="_blank" rel="noopener noreferrer">loopMIDI từ trang tác giả <i class="fas fa-external-link-alt" aria-hidden="true"></i></a>, mở ứng dụng và nhấn dấu <strong>+</strong> để tạo cổng tên <code>MELORIX-KONTAKT</code>. Giữ loopMIDI đang chạy (có thể thu nhỏ xuống khay hệ thống).</li>
              <li><strong>Chọn cổng trên MELORIX:</strong> bấm <strong>Cấp quyền / Làm mới MIDI</strong> bên dưới, sau đó chọn <code>MELORIX-KONTAKT</code>, không chọn DUO-CAPTURE EX. Nếu chưa thấy cổng, hãy thử mở lại Chrome/Edge.</li>
              <li><strong>Kích hoạt MIDI trong Kontakt 8:</strong> mở <strong>Kontakt 8 (Standalone)</strong> → <strong>File → Options → MIDI → Inputs</strong> → tìm <code>MELORIX-KONTAKT</code> và đổi <strong>Off → Port A</strong>. Nếu chưa hiện, đóng/mở lại Kontakt. Nạp một nhạc cụ đang có như <strong>Erhu Hmoob Nplog</strong>, đặt <strong>MIDI Ch: [A] 1</strong> (hoặc Omni để kiểm tra bước đầu).</li>
              <li><strong>Nghe âm thanh thật:</strong> đặt <strong>Kênh MIDI 1</strong> và bấm <strong>Thử nốt</strong>. Kontakt phát âm thanh qua thiết bị âm thanh do Kontakt chọn (ví dụ DUO-CAPTURE EX), không phải qua trình duyệt.</li>
            </ol>
            <p class="mx-kontakt-setup-note">Cách này dùng Kontakt 8 thật: mọi mẫu WAV, nhóm trống, key mapping và xử lý NKI vẫn do Kontakt đảm nhận. MELORIX không tự cài driver hoặc mở file NKI trên máy.</p>
          </div>
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
          <p v-if="granted && !options.length">Chưa thấy MIDI Output. Hãy tạo <code>MELORIX-KONTAKT</code> trong loopMIDI, giữ ứng dụng chạy rồi bấm Làm mới.</p>
          <p v-if="mayBePhysicalOutput" class="mx-kontakt-port-warning" role="status"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Cổng hiện chọn: <strong>{{ chosenPortLabel }}</strong>. Đây chưa được nhận diện là cổng loopMIDI. Nếu chọn DUO-CAPTURE EX, MIDI sẽ ra cổng vật lý và không tự đi vào Kontakt cùng máy. Hãy chọn cổng ảo vừa tạo.</p>
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
          <label class="mx-midi-bridge-checkbox">
            <input type="checkbox" :checked="externalOnly" :disabled="!connected || playing" @change="setExternalOnly">
            Chỉ nghe Kontakt 8 khi dùng Piano Roll hoặc Play (tắt âm thanh nhạc cụ Web Audio trong MELORIX)
          </label>
          <p>Để nghe đúng tiếng Erhu/Drum Mix, bật tùy chọn này <strong>trước khi nhấn Play</strong>. Nếu bài đang chạy, bấm Stop trước khi đổi chế độ. Track Piano Roll phải gửi trên đúng kênh MIDI mà Kontakt nhận; bản xuất MP4 chưa thu tiếng Kontakt.</p>
          <p class="mx-midi-bridge-status" role="status" aria-live="polite">{{ status }}</p>
          <label class="mx-kontakt-confirm">
            <input type="checkbox" :checked="heardKontakt" :disabled="!connected" @change="confirmHeard">
            <span>Tôi đã nghe thấy tiếng nhạc cụ phát <strong>trong Kontakt 8</strong> sau khi bấm Thử nốt.</span>
          </label>
          <p v-if="setupReady" class="mx-kontakt-confirmed" role="status">Bạn đã xác nhận nghe được Kontakt 8. MELORIX không thể tự kiểm chứng âm thanh hoặc tự mở NKI từ trình duyệt.</p>
          <p v-else class="mx-kontakt-not-yet">Chưa xác nhận âm thanh từ Kontakt 8. Thông báo “Đã gửi Note On/Off” chỉ có nghĩa trình duyệt đã gửi MIDI đến cổng được chọn.</p>
          <div class="mx-track-form-actions">
            <button type="button" :disabled="!connected" @click="disconnect">Ngắt MIDI</button>
            <button type="button" @click="emit('close')">Đóng</button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
