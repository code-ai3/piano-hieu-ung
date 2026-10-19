<script setup lang="ts">
import { ref, onBeforeUnmount, watch } from 'vue'
const props=defineProps<{open:boolean;playing:boolean;busy:boolean}>()
const emit=defineEmits<{
 (e:'close'):void
 (e:'audio-ready',audio:AudioBuffer|null,name:string):void
 (e:'record-started'):void
}>()
const recording=ref(false)
const processing=ref(false)
const status=ref('')
const error=ref('')
const audioUrl=ref('')
const audioName=ref('')
const audioDuration=ref(0)
let screenStream:MediaStream|null=null
let recorder:MediaRecorder|null=null
let data:BlobPart[]=[]
let currentUrl=''
let alive=true
function releaseScreen(){
 screenStream?.getTracks().forEach(track=>track.stop())
 screenStream=null
}
function stopCapture(){
 if(recorder?.state==='recording')recorder.stop()
 recording.value=false
 releaseScreen()
}
function clearAudio(){
 if(currentUrl)URL.revokeObjectURL(currentUrl)
 currentUrl=''
 audioUrl.value=''
 audioName.value=''
 audioDuration.value=0
 emit('audio-ready',null,'')
}
async function acceptAudio(blob:Blob,name:string){
 if(blob.size<100||blob.size>180*1024*1024){error.value='Tệp âm thanh trống hoặc lớn hơn 180 MB';return}
 processing.value=true
 error.value=''
 try{
  const ctx=new AudioContext()
  let decoded:AudioBuffer
  try{decoded=await ctx.decodeAudioData(await blob.arrayBuffer())}
  finally{await ctx.close()}
  if(!alive)return
  if(decoded.duration<.05||decoded.duration>900)throw new Error('Audio duration invalid')
  clearAudio()
  audioName.value=name
  audioDuration.value=decoded.duration
  currentUrl=URL.createObjectURL(blob)
  audioUrl.value=currentUrl
  emit('audio-ready',decoded,name)
  // A selected system-audio track may still contain silence, especially with ASIO.
  let maxLevel=0
  for(let ch=0;ch<decoded.numberOfChannels;ch++){
   const arr=decoded.getChannelData(ch)
   for(let i=0;i<arr.length;i+=201)maxLevel=Math.max(maxLevel,Math.abs(arr[i]))
  }
  status.value=maxLevel<.0002?'Đã nạp nhưng âm thanh có vẻ im lặng. Hãy nghe thử bên dưới và kiểm tra đầu ra ASIO.':'Âm thanh đã sẵn sàng cho xuất MP4.'
 }catch(err){
  console.error('Kontakt audio decode failed',err)
  error.value='Không đọc được âm thanh. Hãy thử WAV hoặc MP3 được xuất trực tiếp từ DAW/Kontakt.'
 }finally{processing.value=false}
}
async function chooseFile(e:Event){
 const input=e.target as HTMLInputElement
 const file=input.files?.[0]
 input.value=''
 if(file&&!recording.value&&!props.busy)await acceptAudio(file,file.name)
}
async function beginCapture(){
 if(recording.value||processing.value||props.busy)return
 error.value=''
 status.value=''
 if(!navigator.mediaDevices?.getDisplayMedia||typeof MediaRecorder==='undefined'){
  error.value='Trình duyệt không hỗ trợ thu âm thanh màn hình. Hãy nhập bản thu WAV/MP3 ở dưới.'
  return
 }
 try{
  const stream=await navigator.mediaDevices.getDisplayMedia({
   video:true,
   audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},
   systemAudio:'include',
  } as any)
  if(!alive){stream.getTracks().forEach(t=>t.stop());return}
  screenStream=stream
  const tracks=stream.getAudioTracks()
  if(!tracks.length){
   error.value='Nguồn chia sẻ không có âm thanh hệ thống. Thử chọn Toàn bộ màn hình và bật Chia sẻ âm thanh hệ thống; hoặc nhập WAV/MP3.'
   releaseScreen()
   return
  }
  const supported=['audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x))
  recorder=new MediaRecorder(new MediaStream(tracks),supported?{mimeType:supported}:{})
  data=[]
  recorder.ondataavailable=e=>{if(e.data.size>0)data.push(e.data)}
  recorder.onerror=()=>{error.value='Gặp lỗi khi ghi âm từ hệ thống.';releaseScreen();recording.value=false}
  recorder.onstop=async()=>{
   const blob=new Blob(data,{type:recorder?.mimeType||'audio/webm'})
   data=[]
   releaseScreen()
   if(blob.size>0&&alive)await acceptAudio(blob,'Kontakt-System-Audio.webm')
   else if(alive)error.value='Không thu được âm thanh từ nguồn đã chọn.'
  }
  stream.getVideoTracks().forEach(track=>{track.onended=()=>{if(recording.value)stopCapture()}})
  clearAudio()
  recorder.start(250)
  recording.value=true
  status.value='Đang ghi tiếng hệ thống. MELORIX bắt đầu phát MIDI từ đầu bài; bấm Dừng thu khi xong.'
  emit('record-started')
 }catch(err){
  if((err as DOMException)?.name!=='NotAllowedError')console.warn('System capture unavailable',err)
  error.value='Không thể cấp quyền thu âm thanh màn hình. Bạn vẫn có thể nhập WAV hoặc MP3 của Kontakt.'
  releaseScreen()
 }
}
watch(()=>props.open,open=>{if(!open&&recording.value)stopCapture()})
onBeforeUnmount(()=>{alive=false;stopCapture();if(currentUrl)URL.revokeObjectURL(currentUrl)})
</script>
<template>
<Teleport to="body">
<div v-if="open" class="mx-editor-overlay" @click.self="emit('close')">
 <section class="mx-editor-dialog mx-kontakt-capture-dialog" role="dialog" aria-modal="true" aria-label="Thu âm thanh Kontakt 8">
  <header class="mx-editor-dialog-header">
   <div><span class="mx-editor-dialog-eyebrow">MELORIX · Kontakt 8 · Giai đoạn 4</span><h2>Âm thanh Kontakt cho MP4</h2></div>
   <button type="button" class="mx-editor-dialog-close" aria-label="Đóng" @click="emit('close')">×</button>
  </header>
  <div class="mx-editor-dialog-body mx-kontakt-capture-body">
   <p><strong>Cách 1 — Thu trực tiếp.</strong> Bấm nút dưới, trong Chrome/Edge chọn <strong>Toàn bộ màn hình</strong> và bật <strong>Chia sẻ âm thanh hệ thống</strong> (nếu có). Sau khi cho phép, MELORIX tự phát MIDI từ đầu. Thu xong thì bấm Dừng.</p>
   <div class="mx-kontakt-capture-actions">
    <button v-if="!recording" type="button" :disabled="processing||busy" @click="beginCapture">Bắt đầu thu và phát MIDI từ đầu</button>
    <button v-else type="button" class="mx-kontakt-stop" @click="stopCapture">Dừng thu âm thanh</button>
   </div>
   <p class="mx-kontakt-capture-note">Lưu ý: ASIO của DUO-CAPTURE EX có thể không đi qua luồng âm thanh hệ thống Windows. MELORIX không thể ép trình duyệt nghe được đầu ra Kontakt. Nếu bản thu im lặng, dùng cách 2.</p>
   <p><strong>Cách 2 — Nhập âm thanh đã thu.</strong> Xuất một bản WAV/MP3 từ Kontakt qua DAW hoặc ghi âm rồi chọn tệp ở đây. Âm thanh nằm trong trình duyệt, không tải lên máy chủ.</p>
   <label class="mx-kontakt-capture-upload">Chọn WAV / MP3 / WebM
    <input type="file" accept=".wav,.mp3,.webm,.m4a,.ogg,audio/*" :disabled="processing||recording||busy" @change="chooseFile">
   </label>
   <p v-if="status" role="status" class="mx-kontakt-capture-status">{{ status }}</p>
   <p v-if="error" role="alert" class="mx-kontakt-router-warning">{{ error }}</p>
   <div v-if="audioUrl" class="mx-kontakt-audio-preview">
    <strong>{{ audioName }} · {{ audioDuration.toFixed(1) }} giây</strong>
    <audio :src="audioUrl" controls preload="metadata"></audio>
    <a :href="audioUrl" :download="audioName">Lưu tệp âm thanh</a>
    <button type="button" :disabled="recording||busy" @click="clearAudio">Bỏ bản âm thanh</button>
   </div>
   <p>Trong <strong>Xuất MP4</strong>, chọn “Dùng âm thanh Kontakt” để thay tiếng piano mặc định. Có thể chỉnh độ lệch khi tiếng thu bắt đầu sớm hoặc muộn hơn hình ảnh.</p>
   <div class="mx-track-form-actions"><button type="button" @click="emit('close')">Xong</button></div>
  </div>
 </section>
</div>
</Teleport>
</template>
