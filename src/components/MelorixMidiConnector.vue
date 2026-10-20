<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { midiBridge } from '@/util/melorix-midi-bridge'
import { midiNoteName } from '@/util/midi-edit'
const emit=defineEmits<{(e:'close'):void;(e:'kontakt-enabled'):void}>()
const props=defineProps<{playing:boolean}>()
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
const preferredPort=computed(()=>options.value.find(port=>/melorix[ _-]?kontakt/i.test(port.label))
 ??options.value.find(port=>/loopmidi/i.test(port.label)))
const quickMessage=ref('')
async function quickKontakt(){
 if(props.playing||busy.value)return
 busy.value=true
 quickMessage.value=''
 heardKontakt.value=false
 try{
  if(!midiBridge.granted)await midiBridge.requestAccess()
  refresh()
  const port=preferredPort.value
  if(!port){
   quickMessage.value='Chưa tìm thấy cổng loopMIDI. Mở loopMIDI, tạo cổng MELORIX-KONTAKT và nhấn Kết nối nhanh lại.'
   return
  }
  midiBridge.selectPort(port.id)
  midiBridge.setExternalOnly(true)
  refresh()
  // A test Note On/Off proves sending worked, but cannot prove Kontakt made sound.
  midiBridge.test(testNote.value,testChannel.value-1)
  quickMessage.value='Đã gửi MIDI qua '+port.label+'; hãy mở Kontakt Standalone, bật MIDI Input Port A và bấm Thử nốt để nghe.'
  refresh()
  emit('kontakt-enabled')
 }finally{busy.value=false}
}
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
function setExternalOnly(e:Event){
 const enabled=(e.target as HTMLInputElement).checked
 midiBridge.setExternalOnly(enabled)
 if(enabled)emit('kontakt-enabled')
}
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
            <p class="mx-kontakt-setup-head"><i class="fas fa-plug" aria-hidden="true"></i> Dùng file .nki bằng Kontakt 8 thật</p>
            <p class="mx-kontakt-setup-note" role="note">
              <strong>Không phải chọn thêm WAV trong MELORIX.</strong>
              Mở file <code>.nki</code> trực tiếp trong ứng dụng <strong>Kontakt 8</strong> đang cài trên Windows, sau đó MELORIX gửi MIDI đến nhạc cụ đó qua <code>MELORIX-KONTAKT</code>.
              Nếu một thư viện tham chiếu sample bên ngoài bị thiếu, chính Kontakt sẽ báo thiếu sample và hỏi vị trí thư viện. MELORIX không thể tự mở/chạy file NKI bên trong trình duyệt.
            </p>
            <ol>
              <li><strong>Tạo cổng MIDI ảo:</strong> cài <a href="https://www.tobias-erichsen.de/software/loopmidi.html" target="_blank" rel="noopener noreferrer">loopMIDI từ trang tác giả <i class="fas fa-external-link-alt" aria-hidden="true"></i></a>, mở ứng dụng và nhấn dấu <strong>+</strong> để tạo cổng tên <code>MELORIX-KONTAKT</code>. Giữ loopMIDI đang chạy (có thể thu nhỏ xuống khay hệ thống).</li>
              <li><strong>Chọn cổng trên MELORIX:</strong> bấm <strong>Cấp quyền / Làm mới MIDI</strong> bên dưới, sau đó chọn <code>MELORIX-KONTAKT</code>, không chọn DUO-CAPTURE EX. Nếu chưa thấy cổng, hãy thử mở lại Chrome/Edge.</li>
              <li><strong>Kích hoạt MIDI trong Kontakt 8:</strong> mở <strong>Kontakt 8 (Standalone)</strong> → <strong>File → Options → MIDI → Inputs</strong> → tìm <code>MELORIX-KONTAKT</code> và đổi <strong>Off → Port A</strong>. Nếu chưa hiện, đóng/mở lại Kontakt. Mở file <code>.nki</code> cần sử dụng (ví dụ <strong>S90 ES for Kontakt edition1.nki</strong> hoặc <strong>Erhu Hmoob Nplog</strong>) ngay trong Kontakt. Chuyển sang <strong>Classic View</strong> nếu chưa thấy phần Rack/MIDI Ch (có thể cần bấm nút <strong>i</strong> ở header nhạc cụ), đặt <strong>MIDI Ch: [A] 1</strong> (hoặc Omni để kiểm tra bước đầu).</li>
              <li><strong>Nghe âm thanh thật:</strong> đặt <strong>Kênh MIDI 1</strong> và bấm <strong>Thử nốt</strong>. Kontakt phát âm thanh qua thiết bị âm thanh do Kontakt chọn (ví dụ DUO-CAPTURE EX), không phải qua trình duyệt.</li>
            </ol>
            <p class="mx-kontakt-setup-note">Kontakt 8 thực thi nhạc cụ .nki và xử lý sample, key mapping, hiệu ứng và script theo thư viện. MELORIX chỉ điều khiển qua MIDI, không yêu cầu bạn tách WAV và không tự truy cập các file trên Windows. Âm thanh Kontakt phát từ soundcard của Kontakt; video MP4 muốn dùng đúng tiếng này cần thu/nhập bản thu Kontakt.</p>
          </div>
          <p v-if="!supported" class="mx-instrument-import-error">MELORIX Desktop và Chrome/Edge trên Windows hỗ trợ MIDI; iPad Safari không hỗ trợ.</p>
          <button class="mx-midi-button mx-kontakt-quick-button" type="button"
            :disabled="busy || !supported || playing" @click="quickKontakt">
            <i class="fas fa-link" aria-hidden="true"></i> {{ busy ? 'Đang kết nối…' : 'Kết nối nhanh Kontakt trên Windows' }}
          </button>
          <p v-if="quickMessage" role="status" class="mx-midi-bridge-status">{{ quickMessage }}</p>
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
            <input type="checkbox" :checked="playback" :disabled="!connected || playing" @change="setPlayback">
            Gửi MIDI qua cổng đã chọn khi phát bài (Play)
          </label>
          <label class="mx-midi-bridge-checkbox">
            <input type="checkbox" :checked="externalOnly" :disabled="!connected || playing" @change="setExternalOnly">
            Chỉ nghe Kontakt 8 khi dùng Piano Roll hoặc Play (tắt âm thanh nhạc cụ Web Audio trong MELORIX)
          </label>
          <p>Chế độ này tự bật gửi MIDI khi Play. Để nghe đúng tiếng Erhu/Drum Mix, bật tùy chọn này <strong>trước khi nhấn Play</strong>. Nếu bài đang chạy, bấm Stop trước khi đổi chế độ. Track Piano Roll phải gửi trên đúng kênh MIDI mà Kontakt nhận. Nếu muốn đưa tiếng Kontakt vào MP4, dùng mục Thu / nhập âm thanh Kontakt (MP4) trong menu Nhạc cụ.</p>
          <p class="mx-midi-bridge-status" role="status" aria-live="polite">{{ status }}</p>
          <label class="mx-kontakt-confirm">
            <input type="checkbox" :checked="heardKontakt" :disabled="!connected" @change="confirmHeard">
            <span>Tôi đã nghe thấy tiếng nhạc cụ phát <strong>trong Kontakt 8</strong> sau khi bấm Thử nốt.</span>
          </label>
          <p v-if="setupReady" class="mx-kontakt-confirmed" role="status">Đã xác nhận Kontakt phát tiếng. Bản MELORIX Desktop điều khiển Kontakt Standalone qua cổng MIDI ảo; không nhúng VST3/NKI vào Electron.</p>
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
