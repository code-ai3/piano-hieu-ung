<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Midi } from '@tonejs/midi'
import { extractMidiParts, filterMidiParts, TRACK_COLORS } from '@/util/midi-tracks'
import type { MidiNoteEvent, MidiPart } from '@/util/midi-tracks'
import { portraitKeyboardRange, videoDimensions } from '@/util/video-format'
import { exportDurationSeconds, exportFrameCount, musicalTimeAtFrame, previewClockForMusicalTime } from '@/util/export-timing'
import type { ExportLength } from '@/util/export-timing'
import { velocityVisualStrength, velocityParticleCount } from '@/util/velocity-effects'
import type { VelocityVisualMode } from '@/util/velocity-effects'
import type { VideoFormat, PortraitKeyboard } from '@/util/video-format'
import { SplendidGrandPiano } from 'smplr'
import { renderMultiTrackAudio } from '@/util/melorix-offline-mix'
import { ExpressiveAudioMaster, expressedVelocity } from '@/util/melorix-expressive-audio'
import {exportMidiProgram} from '@/util/melorix-midi-program-export'
import {removeMidiTrack,omitTrackSetting} from '@/util/melorix-track-actions'
import type { ExpressionMode } from '@/util/melorix-expressive-audio'
import Btn from '@/components/Btn.vue'
import Modal from '@/components/Model.vue'
import MelorixPianoRoll from '@/components/MelorixPianoRoll.vue'
import MelorixMidiConnector from '@/components/MelorixMidiConnector.vue'
import MelorixVst3Browser from '@/components/MelorixVst3Browser.vue'
import {Vst3PreviewPlayer} from '@/util/melorix-vst3-preview'
import {Vst3SongScheduler} from '@/util/melorix-vst3-song'
import {Vst3PedalScheduler} from '@/util/melorix-vst3-pedal'
import {normalizePedalPoints} from '@/util/melorix-auto-pedal'
import type {PedalPoint} from '@/util/melorix-auto-pedal'
import type {Vst3PreviewApi} from '@/util/melorix-vst3-preview'
import MelorixKontaktTrackRouter from '@/components/MelorixKontaktTrackRouter.vue'
import MelorixKontaktAudioCapture from '@/components/MelorixKontaktAudioCapture.vue'
import MelorixPublishedLibrary from '@/components/MelorixPublishedLibrary.vue'
import {loadPublishedLibrary} from '@/util/melorix-published-library'
import type {PublishedInstrument} from '@/util/melorix-published-library'
import { alignKontaktAudio } from '@/util/melorix-kontakt-audio'
import { mergeOverlappingMidiNotes } from '@/util/melorix-midi-overlap'
import { midiNoteName } from '@/util/midi-edit'
import { INSTRUMENT_PRESETS, instrumentPreset, isInstrumentPreset, makeInstrumentTrack, playSynthVoice } from '@/util/melorix-instruments'
import type { InstrumentPreset, SynthVoice } from '@/util/melorix-instruments'
import { createLocalSampleSpec, validLocalWavFile, samplePitchRate } from '@/util/melorix-local-wav'
import { ErhuWebSampler } from '@/util/melorix-erhu-web-sampler'
import {GmWebAudio,gmVoiceForTrack} from '@/util/melorix-gm-audio'
import type { LocalInstrumentId, LocalSampleSpec } from '@/util/melorix-local-wav'
import { midiBridge } from '@/util/melorix-midi-bridge'
import { trackMidiChannel } from '@/util/melorix-web-midi'
import { kontaktChannel, nextKontaktChannel, validKontaktChannel, autoKontaktChannels } from '@/util/melorix-kontakt-routing'
import '@/assets/melorix-roll.css'
import AppCheckbox from '@/components/AppCheckbox.vue'
import { Output, Mp4OutputFormat, BufferTarget, StreamTarget, VideoSampleSource, VideoSample, AudioSampleSource, AudioSample } from 'mediabunny'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// ---- 类型 ----
type NoteEvent = MidiNoteEvent

// ---- 状态 ----
const playState = ref<'idle' | 'playing' | 'paused'>('idle')
type Vst3TrackPreviewApi=Vst3PreviewApi&{listVst3Tracks:()=>Promise<{audioConnected:boolean;liveTrack?:number;tracks:{track:number;componentInitialized:boolean}[]}>;sendLiveVst3Note:(track:number,pitch:number,velocity:number)=>Promise<unknown>;sendLiveVst3Pedal?:(track:number,value:number)=>Promise<unknown>}
const vst3Api=(window as Window&{melorixDesktop?:Vst3TrackPreviewApi}).melorixDesktop
const vst3AssignedTrackIds=ref<Set<number>>(new Set())
const vst3LiveTrackId=ref<number|null>(null)
let activeVst3KeyPitch:number|null=null
let activeVst3ChordPitches:number[]=[]
const vst3Song=vst3Api?new Vst3SongScheduler(vst3Api,message=>{uploadError.value='VST3: '+message}):null
function onVst3LiveChanged(id:number|null){if(id!==vst3LiveTrackId.value){vst3Pedal?.stop();vst3Song?.stop()}vst3LiveTrackId.value=id}
const vst3Pedal=vst3Api?.sendLiveVst3Pedal?new Vst3PedalScheduler({sendLiveVst3Pedal:vst3Api.sendLiveVst3Pedal},message=>{uploadError.value='VST3 Pedal: '+message}):null
const vst3KeyPreview=new Vst3PreviewPlayer()
function onVst3BindingsChanged(ids:number[]){vst3AssignedTrackIds.value=new Set(ids)}
async function refreshVst3PianoBindings(){
 if(!vst3Api)return
 try{
  const snapshot=await vst3Api.listVst3Tracks()
  onVst3BindingsChanged(snapshot.tracks.filter(t=>t.componentInitialized).map(t=>t.track))
  onVst3LiveChanged(snapshot.audioConnected?snapshot.liveTrack??null:null)
 }catch(error){console.warn('Cannot read assigned VST3 instruments:',error)}
}
const currentTime = ref(0)
const speed = ref(1)
const allNotes = ref<NoteEvent[]>([])
const pedalByTrack=ref<Record<number,PedalPoint[]>>({})
const midiTempo = ref(120)
const pianoRollTrackId = ref<number | null>(null)
const selectedTrackId=ref<number|null>(null)
const pianoRollHeight = ref(330)
const pianoRollPart = computed(() => midiParts.value.find(part => part.id === pianoRollTrackId.value) || null)
const pianoRollNotes = computed(() => allNotes.value.filter(note => note.trackId === pianoRollTrackId.value))
const pianoRollPedal=computed(()=>pianoRollTrackId.value===null?[]:pedalByTrack.value[pianoRollTrackId.value]??[])
const midiParts = ref<MidiPart[]>([])
const notes = computed(() => filterMidiParts(allNotes.value, midiParts.value))
const enabledPartCount = computed(() => midiParts.value.filter(part => part.enabled).length)
const trackRgbMap = computed(() => new Map(midiParts.value.map(part => [part.id, hexRgb(part.color)] as const)))
const showTrackPanel = ref(false)
const uploadError = ref('')
const noteRange = ref({ min: 21, max: 108 })
const videoFormat = ref<VideoFormat>('landscape')
const portraitKeyboard = ref<PortraitKeyboard>('auto')
const displayRange = computed(() => videoFormat.value === 'portrait'
  ? portraitKeyboardRange(notes.value, portraitKeyboard.value, noteRange.value)
  : noteRange.value)
const formatDimensions = computed(() => videoDimensions(videoFormat.value))
const hiddenPortraitNotes = computed(() => {
  if (videoFormat.value !== 'portrait') return 0
  const { min, max } = displayRange.value
  return notes.value.reduce((count, n) => count + (n.midi < min || n.midi > max ? 1 : 0), 0)
})
function onKeyboardModeChange(event: Event) {
  portraitKeyboard.value = (event.target as HTMLSelectElement).value as PortraitKeyboard
}
const duration = ref(0)
const pianoLoaded = ref(false)
const loadingMidi = ref(false)
const converting = ref(false)
const bpSettings = ref({ onsetThresh: 0.7, frameThresh: 0.3, minNoteLen: 5 })

async function onFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || exporting.value) return
  uploadError.value = ''
  try {
    if (/\.(mid|midi)$/i.test(file.name)) await handleUpload(file)
    else await handleAudioUpload(file)
  } finally {
    input.value = '' // reselect same file is supported
  }
}

function attachOriginalAudioToCurrentMidi(event:Event){
 const input=event.target as HTMLInputElement
 const file=input.files?.[0]
 input.value=''
 if(!file||exporting.value)return
 if(!file.type.startsWith('audio/')&&!/\.(wav|mp3|m4a|aac|flac|ogg|aiff?)$/i.test(file.name)){
  uploadError.value='Hãy chọn bản thu âm gốc WAV, MP3 hoặc định dạng âm thanh trình duyệt đọc được.'
  return
 }
 const track=currentTrack.value
 if(!track)return
 const wasPlaying=playState.value==='playing'
 stop()
 const old=track.originalAudioUrl
 if(originalAudioPlayer){
  originalAudioPlayer.pause()
  originalAudioPlayer.removeAttribute('src')
  originalAudioPlayer.load()
 }
 track.originalAudioUrl=URL.createObjectURL(file)
 if(old)URL.revokeObjectURL(old)
 useOriginalAudio.value=true
 duration.value=allNotes.value.reduce((max,n)=>Math.max(max,n.time+n.duration),0)
 uploadError.value=''
 ensureOriginalAudioPlayer()
 if(wasPlaying)void play()
}
async function handleAudioUpload(file: File) {
  converting.value = true
  try {
    const { audioFileToMidi } = await import('@/util/audio-to-midi')
    const bytes = await audioFileToMidi(file, {
      onsetThresh: bpSettings.value.onsetThresh,
      frameThresh: bpSettings.value.frameThresh,
      minNoteLen: bpSettings.value.minNoteLen,
    })
    const blob = new Blob([bytes as BlobPart], { type: 'audio/midi' })
    const url = URL.createObjectURL(blob)
    const name = file.name.replace(/\.[^.]+$/, '')
    // Keep the original local audio separately; MIDI is only a transcription.
    // Playback and video export can now use the actual imported sound.
    const originalAudioUrl=URL.createObjectURL(file)
    playlist.value.push({ name: `${t('piano.aiTranscriptionLabel')} ${name}`, file: url, originalAudioUrl })
    loadTrack(playlist.value.length - 1)
  } catch (e: any) {
    console.error(e)
    uploadError.value = t('piano.importAudioError')
  } finally {
    converting.value = false
  }
}

let piano: SplendidGrandPiano | null = null
let rafId = 0

const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasAreaRef = ref<HTMLDivElement | null>(null)
const isInspectorOpen = ref(typeof window !== 'undefined' && window.innerWidth > 1000)
const isTrackPanelOpen = ref(typeof window !== 'undefined' && window.innerWidth > 1000)
const isTimelineOpen = ref(false)
// Instrument routing is per track and survives Piano Roll edits.
const showMidiConnector=ref(false)
const showVst3Browser=ref(false)
const vst3QaBusy=ref(false)
function onVst3DiagnosticChange(busy:boolean){vst3QaBusy.value=busy}
// Only native Electron preload exposes the read-only local VST3 scanner.
// Ordinary Cloudflare/Chrome pages never inspect the user's installed plugins.
const hasNativeVst3Scanner=typeof window!=='undefined'&&
 typeof (window as Window&{melorixDesktop?:{scanVst3?:unknown}}).melorixDesktop?.scanVst3==='function'
const kontaktMidiLive=ref(false)
let unsubscribeKontaktStatus:(()=>void)|null=null
function syncKontaktStatus(){kontaktMidiLive.value=midiBridge.externalOnly}
function activateKontaktOnly(){
 // The user's complete recording and editable MIDI must never play twice.
 if(useOriginalAudio.value){
  useOriginalAudio.value=false
  onOriginalAudioModeChange()
 }else if(playState.value==='playing')stop()
 syncKontaktStatus()
}

const showKontaktRouter=ref(false)
const showPublishedLibrary=ref(false)
const publishedInstruments=ref<PublishedInstrument[]>([])
const catalogLoadError=ref('')
async function refreshPublishedInstruments(){
 try{
  publishedInstruments.value=await loadPublishedLibrary()
  catalogLoadError.value=''
 }catch{
  catalogLoadError.value='Không tải được danh sách nhạc cụ chung. Hãy thử mở lại trang.'
 }
}
function openPublishedLibrary(){
 closeControlPanel()
 showPublishedLibrary.value=true
}
const kontaktTrackChannels=ref<Record<number,number>>({})
const kontaktTrackNames=ref<Record<number,string>>({})
function kontaktChannelForTrack(id:number):number {
 const part=midiParts.value.find(part=>part.id===id)
 return part?kontaktChannel(part,kontaktTrackChannels.value):1
}
function openKontaktRouter(){
 closeControlPanel()
 showKontaktRouter.value=true
}
function setKontaktTrackChannel(id:number,channel:number){
 if(exporting.value||playState.value==='playing'||!validKontaktChannel(channel))return
 if(!midiParts.value.some(part=>part.id===id))return
 midiBridge.stopAll()
 kontaktTrackChannels.value={...kontaktTrackChannels.value,[id]:channel}
}
function autoAssignKontaktTracks(){
 if(exporting.value||playState.value==='playing')return
 midiBridge.stopAll()
 kontaktTrackChannels.value=autoKontaktChannels(midiParts.value)
}
function setKontaktTrackName(id:number,name:string){
 if(exporting.value||playState.value==='playing'||!midiParts.value.some(part=>part.id===id))return
 kontaktTrackNames.value={...kontaktTrackNames.value,[id]:name.slice(0,65)}
}
const trackComposerPreviewOpen = ref(false)
const instrumentPreviewTrackId = ref<number | null>(null)
const newTrackName=ref('')
type CatalogInstrumentId=`library:${string}`
type TrackInstrument=InstrumentPreset|LocalInstrumentId|CatalogInstrumentId
const newTrackPreset=ref<TrackInstrument>('piano')
const assignedTrackPresets=ref<Record<number,TrackInstrument>>({})
const trackVolumeLevels=ref<Record<number,number>>({})
const expressionMode=ref<ExpressionMode>('natural')
let audioMaster:ExpressiveAudioMaster|null=null
function getAudioMaster(ctx:AudioContext):AudioNode{
 if(!audioMaster)audioMaster=new ExpressiveAudioMaster(ctx,expressionMode.value)
 return audioMaster.input
}
function setExpressionMode(mode:ExpressionMode){
 if(exporting.value)return
 expressionMode.value=mode
 if(audioMaster&&audioCtx.value)audioMaster.setMode(audioCtx.value,mode)
}
const trackGainNodes=new Map<number,GainNode>()
function trackVolumePercent(id:number){return trackVolumeLevels.value[id]??100}
function trackOutput(ctx:AudioContext,id:number):GainNode{
 let node=trackGainNodes.get(id)
 if(!node){
  node=ctx.createGain()
  node.gain.value=trackVolumePercent(id)/100
  node.connect(getAudioMaster(ctx))
  trackGainNodes.set(id,node)
 }
 return node
}
function setTrackVolume(id:number,event:Event){
 if(exporting.value||!midiParts.value.some(p=>p.id===id))return
 const raw=Number((event.target as HTMLInputElement).value)
 if(!Number.isFinite(raw))return
 const volume=Math.max(0,Math.min(100,Math.round(raw)))
 trackVolumeLevels.value={...trackVolumeLevels.value,[id]:volume}
 const node=trackGainNodes.get(id)
 if(node&&audioCtx.value)node.gain.setTargetAtTime(volume/100,audioCtx.value.currentTime,.012)
 if(midiBridge.externalOnly)midiBridge.setChannelVolume(trackMidiChannel(kontaktChannelForTrack(id)),volume)
}
function clearTrackAudioOutputs(){
 for(const node of trackGainNodes.values()){try{node.disconnect()}catch{}}
 trackGainNodes.clear()
}
const importedMidiPrograms=ref<Record<number,number>>({})
// The bundled SplendidGrandPiano samples are genuine recordings and work offline.
type PianoTrackSample={sampler:SplendidGrandPiano;ready:boolean}
const pianoTrackSamples=new Map<number,PianoTrackSample>()
function ensurePianoTrackSample(ctx:AudioContext,id:number):PianoTrackSample{
 const cached=pianoTrackSamples.get(id)
 if(cached)return cached
 const storage={fetch:(url:string)=>fetch(url.replace('#','%23'))}
 const sampler=SplendidGrandPiano(ctx,{
  volume:100,
  baseUrl:'/samples/sfzinstruments-splendid-grand-piano/samples',
  decayTime:.65,
  destination:trackOutput(ctx,id),
  storage:storage as any,
 })
 const entry:PianoTrackSample={sampler,ready:false}
 pianoTrackSamples.set(id,entry)
 void sampler.load.then(()=>{entry.ready=true}).catch(error=>{
  console.warn('Cannot load bundled sampled piano; GM fallback remains available:',error)
 })
 return entry
}
function stopPianoTrackSamples(){
 for(const entry of pianoTrackSamples.values()){try{entry.sampler.dispose()}catch{}}
 pianoTrackSamples.clear()
}
let gmEngine:GmWebAudio|null=null
const gmAudioNotice=ref('')
function gmVoiceForId(trackId:number){
 const part=midiParts.value.find(p=>p.id===trackId)
 const choice=assignedTrackPresets.value[trackId]
 return gmVoiceForTrack({
  program:importedMidiPrograms.value[trackId],
  channel:part?.channel,
  name:part?.name,
  instrument:part?.instrument,
  libraryId:choice?.startsWith('library:')?choice.slice(8):undefined,
  forcePiano:choice==='piano'
 })
}
function getGmEngine(ctx:AudioContext):GmWebAudio{
 if(!gmEngine)gmEngine=new GmWebAudio(ctx,id=>id<0?ctx.destination:trackOutput(ctx,id))
 return gmEngine
}
function playGmVoice(ctx:AudioContext,trackId:number,midi:number,velocity:number,when:number,duration:number,voices:Set<SynthVoice>){
 const engine=getGmEngine(ctx)
 const voice=engine.play(gmVoiceForId(trackId),midi,velocity,when,duration,trackId)
 voices.add(voice)
}
async function prepareAudioContext():Promise<AudioContext>{
 const ctx=audioCtx.value??new AudioContext()
 audioCtx.value=ctx
 await ctx.resume()
 return ctx
}
function preloadGmForEnabledTracks(){
 const ctx=audioCtx.value
 if(!ctx)return
 const engine=getGmEngine(ctx)
 for(const part of midiParts.value){
  if(!part.enabled)continue
  const choice=assignedTrackPresets.value[part.id]
  if((choice===undefined||choice==='piano') && gmVoiceForId(part.id).key==='acoustic_grand_piano'){
   ensurePianoTrackSample(ctx,part.id)
  }else if(choice===undefined||choice.startsWith('library:')||choice==='piano'){
   engine.preload(gmVoiceForId(part.id),part.id)
  }
 }
}
function playTrackVoice(ctx:AudioContext,trackId:number,midi:number,velocity:number,when:number,duration:number,voices:Set<SynthVoice>,_stopId?:string,scoreOnset?:number){
 const preset=trackPreset(trackId)
 const chosen=assignedTrackPresets.value[trackId]
 // Playback-only musical emphasis. Editor auditions and the MIDI file stay unchanged.
 const playedVelocity=scoreOnset===undefined?velocity:
  expressedVelocity(velocity,scoreOnset,midiTempo.value,expressionMode.value)
 if((chosen===undefined||chosen==='piano') && gmVoiceForId(trackId).key==='acoustic_grand_piano'){
  const pianoTrack=ensurePianoTrackSample(ctx,trackId)
  if(pianoTrack.ready){
   const release=pianoTrack.sampler.start({note:midi,velocity:playedVelocity,
    time:Math.max(ctx.currentTime+.005,when),duration:Math.max(.06,duration)})
   voices.add({stop:()=>release(ctx.currentTime+.002)})
   return
  }
 }
 if(chosen===undefined || (isPublishedTrackInstrument(preset) && !(preset==='library:erhu-hmoob-nplog' && erhuWebSampler.ready))){
  playGmVoice(ctx,trackId,midi,playedVelocity,when,duration,voices)
  return
 }
 if(preset==='piano'){
  playGmVoice(ctx,trackId,midi,playedVelocity,when,duration,voices)
 }else{
  routedNote(ctx,midi,playedVelocity,when,duration,preset,voices,trackId)
 }
}

const localSamples=ref<LocalSampleSpec[]>([])
const localSampleBuffers=new Map<LocalInstrumentId,AudioBuffer>()

const erhuWebSampler=new ErhuWebSampler()
const erhuWebReady=ref(false)
const erhuWebMessage=ref('')
function selectErhuFolder(){
 const picker=document.createElement('input')
 picker.type='file';picker.multiple=true;picker.accept='.wav'
 picker.setAttribute('webkitdirectory','')
 picker.style.display='none'
 document.body.appendChild(picker)
 picker.addEventListener('change',async()=>{
  try{
   if(!picker.files)throw Error('Không có thư mục WAV')
   erhuWebMessage.value='Đang lưu bộ WAV Erhu vào trình duyệt…'
   await erhuWebSampler.install(picker.files)
   erhuWebReady.value=erhuWebSampler.ready
   erhuWebMessage.value='Đã cài 7 WAV Erhu; chọn Erhu Hmoob Nplog trong Thêm track để nghe.'
  }catch(error){
   console.warn('Erhu setup failed:',error)
   erhuWebMessage.value=error instanceof Error?error.message:'Không nạp được thư viện Erhu.'
  }finally{picker.remove()}
 })
 picker.addEventListener('cancel',()=>picker.remove())
 picker.click()
}

// A library NKI is a persistent catalog choice, not a browser-side WAV.
const allInstruments=computed(()=>[
 ...INSTRUMENT_PRESETS.map(p=>({id:p.id,label:p.label})),
 ...publishedInstruments.value.filter(p=>p.format==='nki').map(p=>({id:'library:'+p.id,label:p.label+(p.id==='erhu-hmoob-nplog'&&erhuWebReady.value?' (WAV trên web)':' (Kontakt)')})),
 ...localSamples.value.map(p=>({id:p.id,label:p.label+' (WAV riêng)'}))
])
function isPublishedTrackInstrument(value:TrackInstrument):value is CatalogInstrumentId {
 return value.startsWith('library:')
}
function trackPreset(id:number):TrackInstrument {return assignedTrackPresets.value[id]??'piano'}
function availableInstrument(value:string):value is TrackInstrument{
 return isInstrumentPreset(value)
  ||localSamples.value.some(p=>p.id===value)
  ||publishedInstruments.value.some(p=>p.format==='nki'&&'library:'+p.id===value)
}
function instrumentLabel(value:TrackInstrument):string {
 if(isInstrumentPreset(value))return instrumentPreset(value).label
 if(isPublishedTrackInstrument(value))return publishedInstruments.value.find(p=>'library:'+p.id===value)?.label??'Nhạc cụ Kontakt'
 return localSamples.value.find(p=>p.id===value)?.label??'Mẫu WAV'
}
const sampleImportOpen=ref(false)
const sampleImportFile=ref<File|null>(null)
const sampleImportRoot=ref(60)
const sampleImportName=ref('')
const sampleImportError=ref('')
const sampleImportBusy=ref(false)
let nextLocalSample=1
// The true Kontakt 8 instrument workflow runs outside the browser via Web MIDI.
// WAV import is exclusively for users who intentionally import a separate sample.
const instrumentEditorPreset=ref<TrackInstrument>('piano')
const activeEditorPanel=computed<'track'|'wav'|'instrument'|null>(()=>{
 if(sampleImportOpen.value)return 'wav'
 if(trackComposerPreviewOpen.value)return 'track'
 if(instrumentPreviewTrackId.value!==null)return 'instrument'
 return null
})
const isControlPanelOpen=computed(()=>activeEditorPanel.value!==null)
const controlPanelTitle=computed(()=>({
 track:'Thêm track nhạc cụ',wav:'Mẫu WAV riêng',instrument:'Chọn nhạc cụ cho track'
}[activeEditorPanel.value??'track']))
const instrumentPanelRef=ref<HTMLElement|null>(null)
function openMidiConnector(){
 closeControlPanel()
 showMidiConnector.value=true
}
function closeControlPanel(){
 showMidiConnector.value=false
 showKontaktRouter.value=false
 showPublishedLibrary.value=false
 showKontaktAudioCapture.value=false
 if(sampleImportBusy.value)return
 sampleImportOpen.value=false
 trackComposerPreviewOpen.value=false;instrumentPreviewTrackId.value=null
}
function changeInstrumentTarget(e:Event){
 const id=Number((e.target as HTMLSelectElement).value)
 if(!midiParts.value.some(p=>p.id===id))return
 instrumentPreviewTrackId.value=id
 selectTrack(id)
 instrumentEditorPreset.value=trackPreset(id)
}
function applyInstrumentSelection(){
 const id=instrumentPreviewTrackId.value
 if(id!==null)assignTrackPreset(id,instrumentEditorPreset.value)
}
watch(isControlPanelOpen,(open)=>{
 if(open)void nextTick(()=>instrumentPanelRef.value?.focus({preventScroll:true}))
})
function openPersonalInstrumentImport(){
 closeControlPanel()
 sampleImportOpen.value=true
}
function onPersonalWavChoose(e:Event){
 const input=e.target as HTMLInputElement
 sampleImportFile.value=input.files?.[0]??null
 sampleImportError.value=''
 sampleImportName.value=sampleImportFile.value?.name.replace(/\.wav$/i,'')??''
}
async function importPersonalWav(){
 if(exporting.value||sampleImportBusy.value)return
 const file=sampleImportFile.value
 if(!file){sampleImportError.value='Bạn chưa chọn file WAV';return}
 if(!validLocalWavFile(file.name,file.size)){
  sampleImportError.value='Chỉ nhận WAV hợp lệ từ 44 byte đến 25 MB. .nki/.vst3 chưa được hỗ trợ.';return
 }
 sampleImportBusy.value=true
 sampleImportError.value=''
 try{
  // Offline decoder works on iPad too and avoids changing live transport state.
  const decoder=new OfflineAudioContext(1,1,44100)
  const decoded=await decoder.decodeAudioData(await file.arrayBuffer())
  if(!decoded.length||!Number.isFinite(decoded.duration)||decoded.duration<.02)throw Error('Empty sample')
  const spec=createLocalSampleSpec(nextLocalSample++,sampleImportName.value.trim()||file.name,sampleImportRoot.value)
  localSampleBuffers.set(spec.id,decoded)
  localSamples.value=[...localSamples.value,spec]
  newTrackPreset.value=spec.id
  newTrackName.value=spec.label
  sampleImportFile.value=null
  sampleImportOpen.value=false
  trackComposerPreviewOpen.value=true
 }catch(error){
  console.error('Personal WAV import failed:',error)
  sampleImportError.value='Không giải mã được WAV này. Hãy thử file WAV PCM thông thường.'
 }finally{sampleImportBusy.value=false}
}
function openTrackComposer(){
 closeControlPanel()
 trackComposerPreviewOpen.value=true
}
function openInstrumentTrackPanel(id?:number){
 closeControlPanel()
 const chosen=id??selectedTrackId.value??midiParts.value[0]?.id
 if(chosen===undefined)return
 selectTrack(chosen)
 instrumentPreviewTrackId.value=chosen
 instrumentEditorPreset.value=trackPreset(chosen)
}
function toggleInstrumentPreview(id:number){
 if(activeEditorPanel.value==='instrument'&&instrumentPreviewTrackId.value===id)closeControlPanel()
 else openInstrumentTrackPanel(id)
}
function toggleTrackComposerPreview(){
 if(activeEditorPanel.value==='track')closeControlPanel()
 else openTrackComposer()
}
function assignTrackPreset(id:number,selection:TrackInstrument){
 if(exporting.value)return
 if(!availableInstrument(selection))return
 const part=midiParts.value.find(p=>p.id===id)
 if(!part)return
 if(playState.value==='playing')pause()
 else {stopSynthVoices(synthScheduledVoices);stopPianoAudition();stopChordAudition();piano?.stop()}
 assignedTrackPresets.value={...assignedTrackPresets.value,[id]:selection}
 if(isPublishedTrackInstrument(selection)&&midiBridge.connected&&!midiBridge.playbackEnabled)midiBridge.setPlayback(true)
 part.instrument=instrumentLabel(selection)
 lastScheduledIdx=0
 playState.value='idle'
 closeControlPanel()
}
function deleteMidiTrack(id:number){
 if(exporting.value)return
 const part=midiParts.value.find(p=>p.id===id)
 if(!part)return
 const count=allNotes.value.filter(n=>n.trackId===id).length
 const recordingWarning=kontaktAudioBuffer.value?'\nBản thu Kontakt của bài cũng sẽ được bỏ vì không còn khớp bản phối.':''
 if(!window.confirm(`Xóa track "${part.name}" và ${count} nốt MIDI?\nThao tác này không thể hoàn tác.${recordingWarning}`))return
 // Stop scheduled MIDI and Web Audio before removing notes or track routing.
 playRequest++
 pianoLoading=false
 resetPiano()
 if(kontaktAudioBuffer.value){
  setKontaktAudio(null,'')
  captureSession.value++
 }
 const result=removeMidiTrack(midiParts.value,allNotes.value,id,selectedTrackId.value)
 midiParts.value=result.parts
 allNotes.value=result.notes
 selectedTrackId.value=result.selectedId
 if(pianoRollTrackId.value===id)pianoRollTrackId.value=null
 if(instrumentPreviewTrackId.value===id)closeControlPanel()
 assignedTrackPresets.value=omitTrackSetting(assignedTrackPresets.value,id)
 importedMidiPrograms.value=omitTrackSetting(importedMidiPrograms.value,id)
 kontaktTrackChannels.value=omitTrackSetting(kontaktTrackChannels.value,id)
 kontaktTrackNames.value=omitTrackSetting(kontaktTrackNames.value,id)
 trackVolumeLevels.value=omitTrackSetting(trackVolumeLevels.value,id)
 pedalByTrack.value=omitTrackSetting(pedalByTrack.value,id)
 duration.value=allNotes.value.reduce((max,n)=>Math.max(max,n.time+n.duration),0)
 playState.value='idle'
 currentTime.value=0
 lastScheduledIdx=0
 keyState.value={}
 updateNoteRange()
}
function createInstrumentTrack(){
 if(exporting.value)return
 const selected=newTrackPreset.value
 if(!availableInstrument(selected))return
 const builtIn=isInstrumentPreset(selected)?selected:'piano'
 const p=makeInstrumentTrack(midiParts.value,builtIn,newTrackName.value,TRACK_COLORS[midiParts.value.length%TRACK_COLORS.length])
 p.instrument=instrumentLabel(selected)
 if(playState.value==='playing')pause()
 else {stopSynthVoices(synthScheduledVoices);piano?.stop()}
 const freeKontaktChannel=nextKontaktChannel(midiParts.value,kontaktTrackChannels.value)
 midiParts.value.push(p)
 selectedTrackId.value=p.id
 kontaktTrackChannels.value={...kontaktTrackChannels.value,[p.id]:freeKontaktChannel}
 assignedTrackPresets.value={...assignedTrackPresets.value,[p.id]:selected}
 if(isPublishedTrackInstrument(selected)&&midiBridge.connected&&!midiBridge.playbackEnabled)midiBridge.setPlayback(true)
 newTrackName.value=''
 trackComposerPreviewOpen.value=false
 instrumentPreviewTrackId.value=null
 lastScheduledIdx=0
 playState.value='idle'
 openPianoRoll(p.id)
}
function toggleTrackPanel() {
  isTrackPanelOpen.value = !isTrackPanelOpen.value
  if (window.innerWidth <= 1000 && isTrackPanelOpen.value) isInspectorOpen.value = false
}
function toggleInspectorPanel() {
  isInspectorOpen.value = !isInspectorOpen.value
  if (window.innerWidth <= 1000 && isInspectorOpen.value) isTrackPanelOpen.value = false
}
// Keep native <details> semantics but enforce desktop-style exclusive menus.
const menuBarRef = ref<HTMLElement | null>(null)
// Distinguish a menu opened by hovering from an explicit click to avoid
// immediately toggling it closed when users click after a hover switch.
let menuOpenedByHover: HTMLDetailsElement | null = null
function closeMenus(except?: HTMLDetailsElement | null) {
  for (const menu of menuBarRef.value?.querySelectorAll<HTMLDetailsElement>('details') ?? []) {
    if (menu !== except) menu.open = false
  }
}
function onMenuClick(e: MouseEvent) {
  const element = e.target as HTMLElement
  const summary = element.closest('summary')
  if (summary) {
    const selected = summary.closest('details') as HTMLDetailsElement | null
    if (selected?.open && selected === menuOpenedByHover) {
      // Hover already opened this menu; keep it open on the first click.
      e.preventDefault()
      menuOpenedByHover = null
      return
    }
    menuOpenedByHover = null
    // The native summary click will toggle this menu after the handler.
    closeMenus(selected)
    return
  }
  // Do not unmount a file input on label click (before the file picker opens).
  if (element.closest('.mx-menu-pop button')) closeMenus()
}
function onMenuPointerOver(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return
  const element = e.target as HTMLElement
  const summary = element.closest('summary')
  const incoming = summary?.closest('details') as HTMLDetailsElement | null
  if (!incoming || incoming.open) return
  const anyOpen = Array.from(menuBarRef.value?.querySelectorAll<HTMLDetailsElement>('details') ?? [])
    .some(menu => menu.open)
  if (!anyOpen) return
  closeMenus(incoming)
  incoming.open = true
  menuOpenedByHover = incoming
}
function onDocumentPointerDown(e: PointerEvent) {
  if (menuBarRef.value && !menuBarRef.value.contains(e.target as Node)) {
    menuOpenedByHover = null
    closeMenus()
  }
}
const fittedPreview = ref({ width: 960, height: 540 })
let previewResizeObserver: ResizeObserver | null = null

function fitPreviewCanvas() {
  const host = canvasAreaRef.value
  if (!host) return
  const availableWidth = host.clientWidth
  const availableHeight = host.clientHeight
  if (availableWidth <= 0 || availableHeight <= 0) return
  const ratio = videoFormat.value === 'portrait' ? 9 / 16 : 16 / 9
  const width = Math.max(1, Math.floor(Math.min(availableWidth, availableHeight * ratio)))
  const height = Math.max(1, Math.floor(Math.min(availableHeight, width / ratio)))
  fittedPreview.value = { width, height }
}


const CANVAS_H = 560
const PIANO_H = 120

// ---- 燃烧特效参数 ----
// 燃烧时长 = 音符播放时长（n.duration），随发声同步燃尽
// 烟雾 / 碎片 / 火星寿命均按 burnDur 缩放，长音符飘更久、短音符快速散尽
const FLASH_DUR = 0.12  // 接触瞬闪时长（秒）

// 确定性伪随机 [0,1)：保证实时与逐帧导出一致、不闪烁
function hash(n: number) {
  const x = Math.sin(n) * 43758.5453
  return x - Math.floor(x)
}

// ---- 播放列表 ----
interface Track { name: string; file: string; originalAudioUrl?: string }
const playlist = ref<Track[]>([
  { name: 'Canon', file: '/midi/canon.mid' },
  { name: 'Kiss The Rain', file: '/midi/Kiss%20The%20Rain.mid' },
  { name: 'Rivers Flow In You', file: '/midi/Rivers%20Flow%20In%20You.mid' },
])
const currentTrackIdx = ref(0)
const showPlaylist = ref(false)

const currentTrack = computed(() => playlist.value[currentTrackIdx.value])
const useOriginalAudio=ref(true)
const hasOriginalAudio=computed(()=>Boolean(currentTrack.value?.originalAudioUrl))
let originalAudioPlayer:HTMLAudioElement|null=null
function originalAudioActive(){return hasOriginalAudio.value&&useOriginalAudio.value}
function ensureOriginalAudioPlayer():HTMLAudioElement{
 const url=currentTrack.value?.originalAudioUrl
 if(!url)throw new Error('Bài này không có bản thu âm gốc')
 if(!originalAudioPlayer){
  originalAudioPlayer=new Audio()
  originalAudioPlayer.preload='auto'
  originalAudioPlayer.addEventListener('loadedmetadata',()=>{
   if(!originalAudioActive())return
   const length=originalAudioPlayer?.duration
   if(length&&Number.isFinite(length))duration.value=Math.max(duration.value,length)
  })
 }
 if(originalAudioPlayer.src!==url){
  originalAudioPlayer.pause()
  originalAudioPlayer.src=url
  originalAudioPlayer.load()
 }
 // The browser preserves pitch when playbackRate differs from 1, where supported.
 originalAudioPlayer.preservesPitch=true
 originalAudioPlayer.playbackRate=1/Math.max(.25,speed.value)
 return originalAudioPlayer
}
function pauseOriginalAudio(){originalAudioPlayer?.pause()}
function onOriginalAudioModeChange(){
 if(exporting.value)return
 const wasPlaying=playState.value==='playing'
 pauseOriginalAudio()
 resetPiano()
 playState.value='idle'
 currentTime.value=0
 lastScheduledIdx=0
 keyState.value={}
 // MIDI mode uses the edited MIDI duration; original mode uses the longer
 // source recording if it contains tails or silence beyond the notes.
 duration.value=allNotes.value.reduce((max,n)=>Math.max(max,n.time+n.duration),0)
 if(originalAudioActive()){
  const source=ensureOriginalAudioPlayer()
  if(Number.isFinite(source.duration))duration.value=Math.max(duration.value,source.duration)
 }
 if(wasPlaying)void play()
}
watch(speed,()=>{if(originalAudioPlayer)originalAudioPlayer.playbackRate=1/Math.max(.25,speed.value)})
async function decodeOriginalAudio(url:string):Promise<AudioBuffer>{
 const response=await fetch(url)
 if(!response.ok)throw new Error('Không đọc được bản thu âm gốc')
 const content=await response.arrayBuffer()
 const context=new AudioContext()
 try{return await context.decodeAudioData(content)}
 finally{void context.close()}
}
const repeat = ref(false)
const isFullscreen = ref(false)
watch([videoFormat, isFullscreen], () => { void nextTick(fitPreviewCanvas) })
const noteActiveColor = ref('#5cf6fe')
// 音符接触特效：smoke = 燃烧烟雾消散，diffuse = 扩散光环
const noteEffect = ref<'smoke' | 'diffuse'>('smoke')
const noteEffectOptions = computed(() => [
  { value: 'smoke' as const, label: t('piano.effectSmoke') },
  { value: 'diffuse' as const, label: t('piano.effectDiffuse') },
])
const showPianoSettings = ref(false)
const pianoActiveColor = ref('#5cf6fe')
const pianoInactiveColor = ref('#f0f0f0')
const pianoBlackActiveColor = ref('#5daab1')
const pianoBlackInactiveColor = ref('#1a1a1a')
const noteGlow = ref(30)
const velocityMode = ref<VelocityVisualMode>('expressive')
const velocitySensitivity = ref(85)
const velocityModes: VelocityVisualMode[] = ['off', 'natural', 'expressive']
const visualPower = (velocity: number) => velocityVisualStrength(velocity, velocityMode.value, velocitySensitivity.value)
const pianoGlow = ref(30)
const noteOpacity = ref(70)
const pianoOpacity = ref(70)
const dividerSize = ref(1)
const showOtherSettings = ref(false)
const hideControlsInFullscreen = ref(false)
const showKontaktAudioCapture=ref(false)
const kontaktAudioBuffer=shallowRef<AudioBuffer|null>(null)
const kontaktAudioName=ref('')
const useKontaktAudio=ref(false)
const kontaktAudioOffset=ref(0)
const captureSession=ref(0)
function openKontaktAudioCapture(){
 closeControlPanel()
 showExport.value=false
 showKontaktAudioCapture.value=true
}
function setKontaktAudio(audio:AudioBuffer|null,name:string){
 kontaktAudioBuffer.value=audio
 kontaktAudioName.value=audio?name:''
 useKontaktAudio.value=!!audio
 kontaktAudioOffset.value=0
}
function startKontaktAudioPlayback(){
 if(exporting.value||!notes.value.length||!midiBridge.connected||
    !midiBridge.playbackEnabled||!midiBridge.externalOnly){
  uploadError.value='Hãy kết nối MELORIX-KONTAKT và bật Chỉ nghe Kontakt trước khi thu trực tiếp.'
  return
 }
 stop()
 void play()
}
function stopKontaktAudioPlayback(){
 if(playState.value==='playing')pause()
}
const showExport = ref(false)
const exporting = ref(false)

const supportsFsApi = 'showSaveFilePicker' in window
const exportProgress = ref(0)
const exportEta = ref(0)   // 剩余秒数
const exportLength = ref<ExportLength>('preview15')
const selectedExportSeconds = computed(() => exportDurationSeconds(duration.value, exportLength.value))
const exportPhase = ref<'preparing' | 'rendering'>('preparing')
const exportAudioNotice=ref('')

async function exportVideo() {
  if (exporting.value) return
  if (!notes.value.length) { uploadError.value = t('piano.noActiveTrack'); return }
  uploadError.value = ''
  // Freeze the live timeline before encoding frames to prevent audio/video drift.
  if (playState.value === 'playing') pause()
  const savedTime = currentTime.value
  exporting.value = true
  exportProgress.value = 0
  exportEta.value = 0
  exportPhase.value = 'preparing'
  exportAudioNotice.value=''
  let fileWriter: FileSystemWritableFileStream | null = null
  try {
    const { width: w, height: h, fps } = formatDimensions.value
    const exportSeconds = selectedExportSeconds.value
    const totalFrames = exportFrameCount(exportSeconds, fps)
    if (!totalFrames) throw new Error('No MIDI duration to export')
    const suffix = exportLength.value === 'full' ? '' : `-${Math.ceil(exportSeconds)}s-test`
    const fileName = `${currentTrack.value?.name || 'piano'}-${videoFormat.value === 'portrait' ? '9x16' : '16x9'}${suffix}.mp4`

    // 选保存位置（支持时走流式写盘，省内存）
    let fileHandle: any = null
    if (supportsFsApi) {
      try {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'MP4', accept: { 'video/mp4': ['.mp4'] } }],
        })
        fileWriter = await fileHandle.createWritable()
      } catch (e: any) {
        if (e?.name === 'AbortError') { exporting.value = false; return }
        fileWriter = null
      }
    }

    // The real Kontakt soundtrack replaces the internal piano only if selected.
    // Web MIDI carries no audio; captured/imported audio is decoded separately.
    let audioBuf: AudioBuffer
    if(useKontaktAudio.value&&kontaktAudioBuffer.value){
      if(!Number.isFinite(kontaktAudioOffset.value)||Math.abs(kontaktAudioOffset.value)>300){
        throw new Error('Kontakt audio sync offset must be between -300 and 300 seconds')
      }
      audioBuf=alignKontaktAudio(kontaktAudioBuffer.value,exportSeconds,kontaktAudioOffset.value)
    }else if(originalAudioActive()&&currentTrack.value?.originalAudioUrl){
      const original=await decodeOriginalAudio(currentTrack.value.originalAudioUrl)
      audioBuf=alignKontaktAudio(original,exportSeconds,0)
      exportAudioNotice.value='Xuất âm thanh bản thu gốc; nốt MIDI chỉ dùng cho hình nốt rơi.'
    }else{
      const wavSamples=new Map<string,{buffer:AudioBuffer,root:number}>()
      for(const sample of localSamples.value){
        const buffer=localSampleBuffers.get(sample.id)
        if(buffer)wavSamples.set(sample.id,{buffer,root:sample.rootMidi})
      }
      const mix=await renderMultiTrackAudio({
        notes:notes.value,
        parts:midiParts.value,
        programs:importedMidiPrograms.value,
        presets:assignedTrackPresets.value,
        volumes:trackVolumeLevels.value,
        wavSamples,
        erhuSamples:erhuWebSampler.getDecodedSamples(),
        seconds:exportSeconds,
        tempo:midiTempo.value,
        expression:expressionMode.value
      })
      audioBuf=mix.audioBuffer
      exportAudioNotice.value=mix.fallbacks.length
        ?'Đã xuất bản phối đa track; các nhạc cụ dùng tiếng tổng hợp dự phòng: '+mix.fallbacks.join(', ')
        :'Đã dựng âm thanh đa track theo nhạc cụ, Volume và biểu cảm đang chọn.'
    }

    // mediabunny output：流式写盘用 StreamTarget，否则用 BufferTarget
    const target: any = fileWriter
      ? new StreamTarget(new WritableStream<{ type: 'write', data: Uint8Array, position: number }>({
          write: async chunk => { await fileWriter!.write({ type: 'write', position: chunk.position, data: chunk.data } as any) },
        }))
      : new BufferTarget()
    const output = new Output({ format: new Mp4OutputFormat(fileWriter ? { fastStart: 'fragmented' } : { fastStart: 'in-memory' }), target })

    const vs = new VideoSampleSource({ codec: 'avc', bitrate: 8_000_000 })
    output.addVideoTrack(vs)
    const as = new AudioSampleSource({ codec: 'aac', bitrate: 256000 })
    output.addAudioTrack(as)
    await output.start()

    // Preserve all rendered audio channels, including stereo. Mediabunny splits long buffers.
    for (const audioSample of AudioSample.fromAudioBuffer(audioBuf, 0)) {
      try { await as.add(audioSample) }
      finally { audioSample.close() }
    }
    as.close()

    // 离屏 canvas 渲染（独立于 DOM）+ 边渲边编码
    const offCanvas = document.createElement('canvas')
    exportPhase.value = 'rendering'
    const t0 = performance.now()
    for (let frame = 0; frame < totalFrames; frame++) {
      currentTime.value = previewClockForMusicalTime(musicalTimeAtFrame(frame, fps), speed.value)
      const t2 = musicalTimeAtFrame(frame, fps)
      const ks: Record<number, boolean> = {}
      for (const n of notes.value) {
        if (n.time <= t2 && n.time + n.duration > t2) ks[n.midi] = true
      }
      keyState.value = ks
      draw(offCanvas, w, h)
      const sample = new VideoSample(offCanvas, { timestamp: frame / fps, duration: 1 / fps })
      await vs.add(sample)
      sample.close()
      // 进度 + ETA
      if (frame % 6 === 0 || frame === totalFrames - 1) {
        exportProgress.value = (frame + 1) / totalFrames
        const elapsed = (performance.now() - t0) / 1000
        exportEta.value = elapsed * (totalFrames - frame - 1) / (frame + 1)
      }
    }
    vs.close()
    await output.finalize()

    if (fileWriter) {
      await fileWriter.close()
      fileWriter = null
    } else {
      // BufferTarget：把 buffer 当下载
      const buf = (target as InstanceType<typeof BufferTarget>).buffer!
      const blob = new Blob([buf], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = fileName
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    }
  } catch (e) {
    console.error(e)
    if (fileWriter) {
      try { await fileWriter.abort() } catch (abortError) { console.warn('Could not abort incomplete export', abortError) }
    }
    uploadError.value = t('piano.videoExportError')
  } finally {
    // Always restore the preview timestamp, including failed/aborted exports.
    currentTime.value = savedTime
    keyState.value = {}
    exporting.value = false
    exportProgress.value = 0
    exportEta.value = 0
    showExport.value = false
  }
}
const showBgSettings = ref(false)
const bgPresets = [
  { name: '星空', url: '/wallpaper/star.jpg', type: 'image' as const },
  { name: '波浪', url: '/wallpaper/waves.mp4', type: 'video' as const },
]
const bgMedia = ref<{ url: string; type: 'image' | 'video' } | null>(bgPresets[0])
const bgMediaEl = ref<HTMLVideoElement | null>(null)
const bgImage = ref<HTMLImageElement | null>(null)

function applyBgPreset(preset: typeof bgPresets[0]) {
  bgMedia.value = { url: preset.url, type: preset.type }
  if (preset.type === 'image') {
    const img = new Image()
    img.src = preset.url
    bgImage.value = img
  } else {
    // 视频/GIF：等 DOM 更新后播放
    nextTick(() => { bgMediaEl.value?.play().catch(() => {}) })
  }
  showBgSettings.value = false
}

function handleBgUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  const type = file.type.startsWith('video/') ? 'video' as const : 'image' as const
  bgMedia.value = { url, type }
  if (type === 'image') {
    const img = new Image()
    img.src = url
    bgImage.value = img
  }
  showBgSettings.value = false
}
function clearBg() { bgMedia.value = null; bgImage.value = null; showBgSettings.value = false }

function toggleFullscreen() {
  if (!isFullscreen.value) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen()
    } else if ((document.documentElement as any).webkitRequestFullscreen) {
      (document.documentElement as any).webkitRequestFullscreen()
    }
  } else {
    if (document.exitFullscreen) document.exitFullscreen()
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen()
  }
}
function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement || !!(document as any).webkitFullscreenElement
}

function loadTrack(idx: number) {
  currentTrackIdx.value = idx
  resetPiano()
  currentTime.value = 0
  lastScheduledIdx = 0
  playState.value = 'idle'
  uploadError.value = ''
  useOriginalAudio.value=true
  pauseOriginalAudio()
  void loadMidi(playlist.value[idx].file).then(ok=>{
   if(!ok)return
   if(hasOriginalAudio.value)ensureOriginalAudioPlayer()
   void play()
  })
}

function nextTrack() {
  const next = currentTrackIdx.value + 1
  loadTrack(next >= playlist.value.length ? 0 : next)
}

// ---- smplr 钢琴引擎（baseUrl 指向本地采样） ----
let pianoLoading = false

let initPianoPromise: Promise<void> | null = null
async function initPiano() {
  if (initPianoPromise) { await initPianoPromise; return }
  if (piano) return
  initPianoPromise = (async () => {
    const ctx = audioCtx.value??new AudioContext()
    // 自定义 storage：修复文件名中 # 被浏览器当 hash 截断的问题
    const safeStorage = { fetch: (url: string) => fetch(url.replace('#', '%23')) }
    piano = SplendidGrandPiano(ctx, {
      volume: 100,
      baseUrl: '/samples/sfzinstruments-splendid-grand-piano/samples',
      decayTime: 0.5,
      storage: safeStorage as any,
    })
    audioCtx.value = ctx
    await piano.load
    pianoLoaded.value = true
  })()
  try { await initPianoPromise } finally { initPianoPromise = null }
}

// ---- Nạp MIDI: giữ tên, channel và màu của từng track ----
let midiLoadSeq = 0
async function loadMidi(src: string): Promise<boolean> {
  const request = ++midiLoadSeq
  loadingMidi.value = true
  try {
    const midi = await Midi.fromUrl(src)
    if (request !== midiLoadSeq) return false
    processMidi(midi)
    return true
  } catch (e) {
    console.error(e)
    if (request === midiLoadSeq) uploadError.value = t('piano.importMidiError')
    return false
  } finally {
    if (request === midiLoadSeq) loadingMidi.value = false
  }
}

function updateNoteRange() {
  const enabledNotes = notes.value
  if (!enabledNotes.length) {
    noteRange.value = { min: 21, max: 108 }
    return
  }
  let min = 127, max = 0
  for (const note of enabledNotes) {
    min = Math.min(min, note.midi)
    max = Math.max(max, note.midi)
  }
  noteRange.value = { min: Math.max(21, min - 12), max: Math.min(108, max + 12) }
}
function processMidi(midi: Midi) {
  playRequest++
  // A soundtrack belongs to the current MIDI timeline; never reuse on a new song.
  if(kontaktAudioBuffer.value){
    setKontaktAudio(null,'')
    captureSession.value++
  }
  kontaktTrackChannels.value={}
  kontaktTrackNames.value={}
  showKontaktRouter.value=false
  // Importing a different song must cancel MIDI messages already queued on the port.
  if(playState.value==='playing')pause()
  midiBridge.stopAll()
  pianoRollTrackId.value = null
  selectedTrackId.value=null
  assignedTrackPresets.value={}
  // Do not retain GM instruments routed to disconnected buses from the previous MIDI.
  gmEngine?.stop();gmEngine=null
  stopPianoTrackSamples()
  clearTrackAudioOutputs()
  trackVolumeLevels.value={}
  pedalByTrack.value=Object.fromEntries(midi.tracks.map((track,id)=>[
    id,normalizePedalPoints((track.controlChanges[64]??[]).map(cc=>({time:cc.time,value:cc.value*127})))
  ]))
  vst3Song?.stop()
  importedMidiPrograms.value=Object.fromEntries(midi.tracks.map((track,index)=>[index,
   typeof track.instrument?.number==='number'?track.instrument.number:0]))
  instrumentPreviewTrackId.value=null
  trackComposerPreviewOpen.value=false
  midiTempo.value = midi.header.tempos[0]?.bpm || 120
  const parsed = extractMidiParts(midi)
  midiParts.value = parsed.parts
  selectedTrackId.value=parsed.parts[0]?.id??null
  allNotes.value = parsed.events
  duration.value = midi.duration || parsed.events.reduce((end, n) => Math.max(end, n.time + n.duration), 0)
  currentTime.value = 0
  playState.value = 'idle'
  lastScheduledIdx = 0
  keyState.value = {}
  updateNoteRange()
  // Start loading bundled piano recordings as soon as the MIDI has been parsed,
  // not only after the first Play click. No AudioContext resume is required here.
  if(audioCtx.value)preloadGmForEnabledTracks()
}
function selectTrack(id:number){
 if(exporting.value||!midiParts.value.some(p=>p.id===id))return
 selectedTrackId.value=id
 if(pianoRollTrackId.value!==null&&pianoRollTrackId.value!==id){
  stopPianoAudition()
  stopChordAudition()
  pianoRollTrackId.value=id
 }
}
function openPianoRoll(id: number) {
  if (exporting.value || !midiParts.value.some(part => part.id === id)) return
  selectTrack(id)
  pianoRollTrackId.value = id
  if (playState.value === 'playing') pause()
}
function updatePianoRollPedal(points:PedalPoint[]){
 const id=pianoRollTrackId.value
 if(id===null||exporting.value)return
 if(playState.value==='playing')pause()
 vst3Song?.stop()
 midiBridge.stopAll()
 pedalByTrack.value={...pedalByTrack.value,[id]:normalizePedalPoints(points)}
}
function updatePianoRollNotes(edited: NoteEvent[]) {
  const id = pianoRollTrackId.value
  if (id === null || exporting.value) return
  // Never modify notes on any other track. All playback and export reads allNotes.
  if (playState.value === 'playing') pause()
  midiBridge.stopAll()
  vst3Song?.stop()
  piano?.stop()
  allNotes.value = [
    ...allNotes.value.filter(note => note.trackId !== id),
    ...edited.map(note => ({ ...note, trackId: id })),
  ].sort((a,b) => a.time-b.time || a.midi-b.midi)
  const part = midiParts.value.find(part => part.id === id)
  if (part) part.noteCount = edited.length
  duration.value = allNotes.value.reduce((max, note) => Math.max(max, note.time + note.duration), 0)
  lastScheduledIdx = 0
  keyState.value = {}
  updateNoteRange()
}
function beginPianoRollResize(e: PointerEvent) {
  e.preventDefault()
  const startY = e.clientY
  const initial = pianoRollHeight.value
  function move(event: PointerEvent) {
    pianoRollHeight.value = Math.min(Math.round(window.innerHeight * 0.68), Math.max(200, initial + startY - event.clientY))
  }
  function stop() {
    window.removeEventListener('pointermove',move)
    window.removeEventListener('pointerup',stop)
  }
  window.addEventListener('pointermove',move)
  window.addEventListener('pointerup',stop)
}
function resetAfterTrackChange() {
  vst3Song?.stop()
  playRequest++
  // Stop pending MIDI as well as Web Audio when switching track mixes.
  midiBridge.stopAll()
  stopSynthVoices(synthScheduledVoices)
  piano?.stop()
  playState.value = 'idle'
  currentTime.value = 0
  lastScheduledIdx = 0
  keyState.value = {}
  updateNoteRange()
}
function setPartEnabled(id: number, enabled: boolean) {
  if (exporting.value) return
  const part = midiParts.value.find(part => part.id === id)
  if (part && part.enabled !== enabled) {
    part.enabled = enabled
    resetAfterTrackChange()
  }
}
function onPartToggle(id: number, event: Event) {
  setPartEnabled(id, (event.target as HTMLInputElement).checked)
}
function setAllParts(enabled: boolean) {
  if (exporting.value) return
  midiParts.value.forEach(part => { part.enabled = enabled })
  resetAfterTrackChange()
}
function soloPart(id: number) {
  if (exporting.value) return
  const wasSolo = midiParts.value.filter(p => p.enabled).length === 1 && midiParts.value.some(p => p.id === id && p.enabled)
  midiParts.value.forEach(part => { part.enabled = wasSolo || part.id === id })
  resetAfterTrackChange()
}
function onPartColorInput(id: number, event: Event) {
  if (exporting.value) return
  const part = midiParts.value.find(part => part.id === id)
  if (part) part.color = (event.target as HTMLInputElement).value
}
function hexRgb(color: string): [number, number, number] {
  const hex = color.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}
async function handleUpload(file: File) {
  try {
    const buf = await file.arrayBuffer()
    const midi = new Midi(buf)
    const name = midi.name || file.name.replace(/\.midi?$/i, '')
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/midi' }))
    playlist.value.push({ name, file: url })
    loadTrack(playlist.value.length - 1)
  } catch (e) {
    console.error(e)
    uploadError.value = t('piano.importMidiError')
  }
}

// ---- Âm sắc MIDI dựng sẵn (Web Audio) và engine Piano sampler hiện hữu ----
let lastScheduledIdx = 0
const audioCtx = ref<AudioContext | null>(null)
const synthScheduledVoices=new Set<SynthVoice>()
const synthKeyVoices=new Set<SynthVoice>()
const synthChordVoices=new Set<SynthVoice>()
function stopSynthVoices(set:Set<SynthVoice>){
 for(const voice of set)voice.stop()
 set.clear()
}
function routedNote(ctx:AudioContext,midi:number,velocity:number,when:number,duration:number,
 preset:TrackInstrument,set:Set<SynthVoice>,trackId:number){
 let voice:SynthVoice
 if(isPublishedTrackInstrument(preset)){
   if(preset!=='library:erhu-hmoob-nplog'||!erhuWebSampler.ready)return
   let samplerVoice:SynthVoice|null=null
   samplerVoice=erhuWebSampler.play(ctx,midi,velocity,when,duration,()=>{
    if(samplerVoice)set.delete(samplerVoice)
   },trackOutput(ctx,trackId))
   if(samplerVoice)set.add(samplerVoice)
   return
  }
 if(isInstrumentPreset(preset))voice=playSynthVoice(ctx,midi,velocity,when,duration,preset,trackOutput(ctx,trackId))
 else{
  const one=localSamples.value.find(s=>s.id===preset)
  const buffer=localSampleBuffers.get(preset)
  const root=one?.rootMidi
  if(!buffer||root===undefined)return
  const start=Math.max(ctx.currentTime+.003,when)
  const length=Math.max(.06,Number.isFinite(duration)?duration:.5)
  const source=ctx.createBufferSource()
  const gain=ctx.createGain()
  source.buffer=buffer
  source.playbackRate.setValueAtTime(samplePitchRate(midi,root),start)
  const level=Math.min(1,Math.max(.01,velocity/127))*.7
  gain.gain.setValueAtTime(.0001,start)
  gain.gain.linearRampToValueAtTime(level,start+.012)
  gain.gain.setValueAtTime(level,start+length)
  gain.gain.linearRampToValueAtTime(.0001,start+length+.10)
  source.connect(gain);gain.connect(trackOutput(ctx,trackId))
  source.onended=()=>{set.delete(voice);try{source.disconnect();gain.disconnect()}catch{}}
  source.start(start)
  source.stop(start+length+.12)
  voice={stop:()=>{try{source.stop(Math.max(ctx.currentTime+.002,start+.001))}catch{}}}
 }
 set.add(voice)
 if(set.size>2400){for(const stale of Array.from(set).slice(0,set.size-2200))set.delete(stale)}
}

const midiPlaybackPlan=computed(()=>mergeOverlappingMidiNotes(notes.value.map(n=>({
 note:n.midi,
 velocity:n.velocity*127,
 channel:trackMidiChannel(kontaktChannelForTrack(n.trackId)),
 start:n.time,
 duration:n.duration,
}))))
// Schedule Web Audio in short windows, never thousands of voices all at once.
// This also lets soundfont samples that finish downloading replace the fallback.
const AUDIO_LOOKAHEAD_SECONDS=.35
function scheduleUpcomingAudio() {
 const ctx=audioCtx.value
 if(originalAudioActive()||!ctx||midiBridge.externalOnly||ctx.state!=='running')return
 const targetTime=currentTime.value/speed.value
 for(let i=lastScheduledIdx;i<notes.value.length;i++){
  const n=notes.value[i]
  const delay=(n.time-targetTime)*speed.value
  if(delay>AUDIO_LOOKAHEAD_SECONDS)break
  lastScheduledIdx=i+1
  // When resuming/starting mid-song do not retrigger older notes.
  if(delay<-.035||vst3Song?.isPlayingTrack(n.trackId))continue
  playTrackVoice(ctx,n.trackId,n.midi,n.velocity*127,
    ctx.currentTime+Math.max(.005,delay),n.duration*speed.value,synthScheduledVoices,undefined,n.time)
 }
}
function scheduleAll() {
 if(originalAudioActive())return
 scheduleUpcomingAudio()
 // Web MIDI is scheduled separately once at Play/seek/repeat; do not resend each animation frame.
 if(exporting.value)return
 const midiClockMs=performance.now()
 // Send channel volume before the first note; never send Program Change
 // because Kontakt's loaded NKI should not be replaced.
 if(midiBridge.playbackEnabled){
  for(const part of midiParts.value){
   if(part.enabled)midiBridge.setChannelVolume(
    trackMidiChannel(kontaktChannelForTrack(part.id)),trackVolumePercent(part.id))
  }
 }
 const targetTime=currentTime.value/speed.value
 for(const event of midiPlaybackPlan.value){
  if(event.start<targetTime-.02)continue
  midiBridge.schedule(event.note,event.velocity,event.channel,
   Math.max(0,(event.start-targetTime)*speed.value),
   Math.max(.05,event.duration*speed.value),midiClockMs)
 }
}

// ---- 播放控制 ----
let playRequest=0
async function play() {
  if (!notes.value.length || pianoLoading || vst3QaBusy.value) return
  if (playState.value === 'playing') return
  pianoLoading = true
  const request=++playRequest
  try {
    if(originalAudioActive()){
      const original=ensureOriginalAudioPlayer()
      original.currentTime=Math.max(0,currentTime.value/Math.max(.25,speed.value))
      await original.play()
    }else if(!midiBridge.externalOnly){
      const ctx=await prepareAudioContext()
      preloadGmForEnabledTracks()
      void erhuWebSampler.init()
      if(!piano)void initPiano().catch(e=>console.warn('Grand piano preload:',e))
      if(ctx.state!=='running')throw Error('AudioContext not running')
    }
    if(request!==playRequest)return
    lastScheduledIdx = 0; lastFrameTime = performance.now()
    if(vst3LiveTrackId.value!==null&&!originalAudioActive()&&!midiBridge.externalOnly){
      vst3Song?.start(notes.value,vst3LiveTrackId.value,currentTime.value/speed.value)
      vst3Pedal?.start(vst3LiveTrackId.value,pedalByTrack.value[vst3LiveTrackId.value]??[],currentTime.value/speed.value)
     }
    scheduleAll();vst3Song?.tick(currentTime.value/speed.value)
    playState.value = 'playing'
  } catch(error){
    if(request!==playRequest)return
    console.error('MELORIX playback failed:',error)
    midiBridge.stopAll()
    playState.value='idle'
    uploadError.value='Không thể bắt đầu phát nhạc. Hãy kiểm tra âm thanh và cổng MIDI.'
  } finally { pianoLoading = false }
}

function resetPiano() {
  vst3Pedal?.stop()
  vst3Song?.stop()
  pauseOriginalAudio()
  midiBridge.stopAll()
  stopPianoAudition()
  stopChordAudition()
  stopSynthVoices(synthScheduledVoices)
  gmEngine?.stop();gmEngine=null
  stopPianoTrackSamples()
  clearTrackAudioOutputs()
  audioMaster?.disconnect();audioMaster=null
  piano?.stop(); piano = null
  audioCtx.value?.close(); audioCtx.value = null
  pianoLoaded.value = false; initPianoPromise = null
}

function pause() { vst3Pedal?.stop(); vst3Song?.stop(); playRequest++; pauseOriginalAudio(); midiBridge.stopAll(); stopChordAudition(); stopPianoAudition(); stopSynthVoices(synthScheduledVoices); playState.value = 'paused'; audioCtx.value?.suspend(); piano?.stop() }
function stop() {
  playRequest++
  playState.value = 'idle'; currentTime.value = 0
  lastScheduledIdx = 0; pianoLoading = false
  resetPiano()
  if(originalAudioPlayer){try{originalAudioPlayer.currentTime=0}catch{}}
  if(!midiBridge.externalOnly&&!originalAudioActive())void initPiano().catch(e=>console.warn('Piano preload:',e))
}
function togglePlay() { playState.value === 'playing' ? pause() : play() }
async function testWebSound(){
 try{
  const ctx=await prepareAudioContext()
  const engine=getGmEngine(ctx)
  const percussion={key:'percussion',percussion:true,program:0}
  const pianoTest={key:'acoustic_grand_piano',percussion:false,program:0}
  for(const [n,delay] of [[36,0],[38,.28],[42,.54]]){
   synthKeyVoices.add(engine.play(percussion,n,110,ctx.currentTime+.05+delay,.20))
  }
  synthKeyVoices.add(engine.play(pianoTest,72,115,ctx.currentTime+.9,.65))
  gmAudioNotice.value='Đã phát 3 tiếng trống và nốt Đô để thử loa; nếu vẫn im, kiểm tra âm lượng của tab và đầu ra hệ thống.'
 }catch(error){gmAudioNotice.value='Không mở được đầu ra âm thanh: '+String(error)}
}

const AUDITION_STOP_ID = 'melorix-editor-key'
let auditionRequest = 0
function stopPianoAudition() {
 // A fast piano key release must not discard a pending PCM audition that
 // is still being rendered by the plugin. Stop the current sounding buffer.
 vst3KeyPreview.stop(false)
 if(activeVst3KeyPitch!==null&&vst3LiveTrackId.value!==null&&vst3Api){
  void vst3Api.sendLiveVst3Note(vst3LiveTrackId.value,activeVst3KeyPitch,0)
   .catch(error=>console.warn('VST3 Note Off:',error))
 }
 activeVst3KeyPitch=null
 midiBridge.auditionStop()
 auditionRequest++
 stopSynthVoices(synthKeyVoices)
 piano?.stop(AUDITION_STOP_ID)
}
async function startPianoAudition(midi: number) {
 if(exporting.value) return
 stopChordAudition()
 stopPianoAudition()
 const targetTrack=pianoRollTrackId.value
 if(vst3Api && targetTrack!==null && vst3LiveTrackId.value===targetTrack){
  activeVst3KeyPitch=midi
  void vst3Api.sendLiveVst3Note(targetTrack,midi,95)
    .catch(error=>{uploadError.value=error instanceof Error?error.message:String(error)})
  return
 }
 if(vst3Api && targetTrack!==null && vst3AssignedTrackIds.value.has(targetTrack)){
  uploadError.value=''
  void vst3KeyPreview.play(vst3Api,targetTrack,midi,95,500,trackVolumePercent(targetTrack)/100)
   .then(result=>{
    if(result.nonzeroSamples===0)uploadError.value='Nhạc cụ VST3 chưa trả âm thanh. Mở giao diện plugin và chọn NKI trước khi thử.'
   })
   .catch(error=>{uploadError.value=error instanceof Error?error.message:String(error)})
  return
 }
 midiBridge.auditionStart([midi],trackMidiChannel(kontaktChannelForTrack(pianoRollTrackId.value??-1)))
 if(midiBridge.externalOnly)return
 const request = auditionRequest
 try {
  const ctx=await prepareAudioContext()
  if(request !== auditionRequest || exporting.value) return
  playTrackVoice(ctx,pianoRollTrackId.value??-1,midi,95,ctx.currentTime+.003,1.2,synthKeyVoices,AUDITION_STOP_ID)
 } catch(error) { console.error('Piano audition failed:',error) }
}


const CHORD_STOP_ID='melorix-editor-chord'
let chordRequest=0
let chordStopTimer:ReturnType<typeof setTimeout>|null=null
function stopChordAudition(){
 if(activeVst3ChordPitches.length&&vst3LiveTrackId.value!==null&&vst3Api){
  for(const pitch of activeVst3ChordPitches){
   void vst3Api.sendLiveVst3Note(vst3LiveTrackId.value,pitch,0).catch(error=>console.warn('VST3 chord off:',error))
  }
 }
 activeVst3ChordPitches=[]
 chordRequest++
 midiBridge.auditionStop()
 stopSynthVoices(synthChordVoices)
 if(chordStopTimer!==null){clearTimeout(chordStopTimer);chordStopTimer=null}
 piano?.stop(CHORD_STOP_ID)
}
async function startChordAudition(pitches:number[]){
 if(exporting.value||!pitches.length)return
 stopChordAudition()
 stopPianoAudition()
 const request=chordRequest
 if(vst3Api&&vst3LiveTrackId.value===pianoRollTrackId.value){
  const track=vst3LiveTrackId.value
  if(track!==null){
   activeVst3ChordPitches=pitches.slice()
   for(const pitch of pitches){
    void vst3Api.sendLiveVst3Note(track,pitch,95).catch(error=>{uploadError.value=String(error)})
   }
   chordStopTimer=setTimeout(()=>{if(request===chordRequest)stopChordAudition()},1200)
   return
  }
 }
 midiBridge.auditionStart(pitches,trackMidiChannel(kontaktChannelForTrack(pianoRollTrackId.value??-1)))
 chordStopTimer=setTimeout(()=>{if(request===chordRequest)stopChordAudition()},1200)
 if(midiBridge.externalOnly)return
 try {
  const ctx=await prepareAudioContext()
  if(request!==chordRequest||exporting.value)return
  for(const pitch of pitches){
   playTrackVoice(ctx,pianoRollTrackId.value??-1,pitch,95,ctx.currentTime+.003,1.2,synthChordVoices,CHORD_STOP_ID)
  }
  if(chordStopTimer===null)chordStopTimer=setTimeout(()=>{if(request===chordRequest)stopChordAudition()},1200)
 }catch(error){console.error('Chord audition failed:',error)}
}

// ---- Canvas 渲染 ----
function draw(targetCanvas?: HTMLCanvasElement, targetW?: number, targetH?: number) {
  const canvas = targetCanvas || canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  let cw: number, ch: number
  if (targetCanvas && targetW && targetH) {
    // Do not reallocate a 1080x1920 canvas every frame: this is expensive.
    if (canvas.width !== targetW) canvas.width = targetW
    if (canvas.height !== targetH) canvas.height = targetH
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    cw = targetW; ch = targetH
  } else {
    const dpr = window.devicePixelRatio || 1
    const pixelW = Math.max(1, Math.round(canvas.offsetWidth * dpr))
    const pixelH = Math.max(1, Math.round(canvas.offsetHeight * dpr))
    if (canvas.width !== pixelW) canvas.width = pixelW
    if (canvas.height !== pixelH) canvas.height = pixelH
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cw = canvas.width / dpr
    ch = canvas.height / dpr
  }
  // Keep the same keyboard proportion for portrait preview and exported frames.
  const isExport = !!targetCanvas
  const isPortrait = videoFormat.value === 'portrait'
  const actualPianoH = isPortrait ? Math.round(ch * 0.20)
    : (isExport || isFullscreen.value ? Math.round(PIANO_H * (ch / CANVAS_H)) : PIANO_H)
  const notesAreaH = ch - actualPianoH
  ctx.clearRect(0, 0, cw, ch)

  const { min, max } = displayRange.value
  const whiteCount = getWhiteKeys(min, max).length
  const keyW = cw / whiteCount
  const visibleTime = (isPortrait ? 5 : 4) / speed.value
  const targetTime = currentTime.value / speed.value
  const timeTop = targetTime + visibleTime
  const timeBottom = targetTime

  // ---- 音符掉落区域背景（cover，不拉伸） ----
  if (bgMedia.value?.type === 'video' && bgMediaEl.value) {
    const vw = bgMediaEl.value.videoWidth || cw
    const vh = bgMediaEl.value.videoHeight || notesAreaH
    const scale = Math.max(cw / vw, notesAreaH / vh)
    const sw = vw * scale, sh = vh * scale
    ctx.drawImage(bgMediaEl.value, (cw - sw) / 2, (notesAreaH - sh) / 2, sw, sh)
  } else if (bgImage.value?.complete) {
    const iw = bgImage.value.naturalWidth || cw
    const ih = bgImage.value.naturalHeight || notesAreaH
    const scale = Math.max(cw / iw, notesAreaH / ih)
    const sw = iw * scale, sh = ih * scale
    ctx.drawImage(bgImage.value, (cw - sw) / 2, (notesAreaH - sh) / 2, sw, sh)
  }
  // 黑色蒙版：无背景时 0.95 近纯黑，有背景时 0.75 压暗确保音符可见
  ctx.fillStyle = bgMedia.value ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.95)'
  ctx.fillRect(0, 0, cw, notesAreaH)

  // 激活色（统一用于下落音符与燃烧/粒子特效）
  const [ar, ag, ab] = hexRgb(noteActiveColor.value)

  // ---- 音符掉落（仅钢琴+电子琴音色） ----
  for (const n of notes.value) {
    const [ar, ag, ab] = (trackRgbMap.value.get(n.trackId) || hexRgb(noteActiveColor.value))
    const noteEnd = n.time + n.duration
    // 燃烧时长 = 音符播放时长：接触后随发声同步燃尽
    const burnDur = Math.max(0.05, n.duration)
    // 按燃烧窗口剔除：即使音符时值已结束，仍在燃烧期内就要继续绘制
    if (n.time + burnDur < timeBottom || n.time > timeTop) continue
    if (n.midi < min || n.midi > max) continue

    const yTop = notesAreaH - ((n.time - timeBottom) / visibleTime) * notesAreaH
    const rawYBottom = notesAreaH - ((noteEnd - timeBottom) / visibleTime) * notesAreaH
    const yBottom = Math.min(rawYBottom, notesAreaH)  // 不画进钢琴区域
    const { x, w: nw } = noteXW(n.midi, min, keyW)
    const rx = Math.min(4, nw / 4)
    const cx = x + nw / 2
    // 燃烧几何：接触瞬间音符底贴分割线、高 noteH，以此为基准无跳变
    const noteH = Math.max(8, (n.duration / visibleTime) * notesAreaH)
    const age = targetTime - n.time
    const power = visualPower(n.velocity)

    if (age < 0) {
      // 尚未接触分割线：正常下落绘制（按音高多彩色）
      const alpha = Math.min(0.98, (noteOpacity.value / 100) * (0.32 + 0.68 * power))
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${alpha})`
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},${Math.min(1, alpha + 0.25)})`
      ctx.lineWidth = 2
      const nh = Math.max(2, yTop - yBottom)
      ctx.beginPath(); roundRect(ctx, x + 1, yBottom, nw - 2, nh, rx); ctx.fill()
      ctx.beginPath(); roundRect(ctx, x + 1, yBottom, nw - 2, nh, rx); ctx.stroke()
      ctx.shadowBlur = 0
    } else if (noteEffect.value === 'diffuse') {
      // 扩散光环特效：接触后激活色持续矩形 + 接触瞬间多彩扩散光环（原始效果）
      const playing = n.time + n.duration > targetTime
      if (!playing) continue
      const alpha = (noteOpacity.value / 100) * (0.32 + 0.68 * power)
      // 激活瞬间扩散光环（音符启动后 0.6s 内，多彩色减淡）
      const actAge = age
      if (actAge < 0.6) {
        const actProgress = actAge / 0.6
        const actR = 6 + actProgress * 40 * (0.3 + 0.7 * power)
        const actAlpha = (1 - actProgress) * (1 - actProgress) * 0.5 * power
        const actH = Math.max(2, yTop - yBottom)
        ctx.fillStyle = `rgba(${ar},${ag},${ab},${actAlpha})`
        ctx.beginPath(); roundRect(ctx, x - actR/2, yBottom - actR/2, nw + actR, actH + actR, rx + 2); ctx.fill()
      }
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${alpha})`
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},${Math.min(1, alpha + 0.25)})`
      ctx.shadowColor = `rgba(${ar},${ag},${ab},0.8)`
      ctx.shadowBlur = noteGlow.value * (0.25 + 0.75 * power)
      ctx.lineWidth = 2
      const nh = Math.max(2, yTop - yBottom)
      ctx.beginPath(); roundRect(ctx, x + 1, yBottom, nw - 2, nh, rx); ctx.fill()
      ctx.beginPath(); roundRect(ctx, x + 1, yBottom, nw - 2, nh, rx); ctx.stroke()
      ctx.shadowBlur = 0
    } else if (age < burnDur) {
      // 燃烧中：前沿由下而上爬过音符，前沿白热化，残存部分沿前沿淡出，整体趋零
      const p = age / burnDur
      const topY = notesAreaH - noteH          // 音符顶部（接触位置）
      const frontY = notesAreaH - noteH * p    // 燃烧前沿（由分割线向上爬）
      const remainH = frontY - topY
      if (remainH > 1) {
        // 本体不透明度按激活后绝对时间快速指数衰减：长音不会一直停在画面里
        const bodyA = (noteOpacity.value / 100) * Math.exp(-age * 2.2) * (0.3 + 0.7 * power)
        // 前沿白热亮带随燃烧进度保持可见（引线仍在爬）
        const frontA = ((1 - p) * 0.7 + 0.3) * (0.25 + 0.75 * power)
        ctx.save()
        ctx.shadowColor = `rgba(${tint(ar,ag,ab,0.5)},1)`
        ctx.shadowBlur = (noteGlow.value + 25) * (0.2 + 0.8 * power)
        // 主体：上方未燃部分保持激活色 → 靠近前沿逐渐白热，底边平直
        const grad = ctx.createLinearGradient(0, topY, 0, frontY)
        grad.addColorStop(0, `rgba(${ar},${ag},${ab},${bodyA})`)
        grad.addColorStop(0.55, `rgba(${tint(ar,ag,ab,0.2)},${bodyA})`)
        grad.addColorStop(0.85, `rgba(${tint(ar,ag,ab,0.55)},${bodyA})`)
        grad.addColorStop(1, `rgba(255,255,255,${Math.max(bodyA, frontA * 0.6)})`)
        ctx.fillStyle = grad
        ctx.beginPath(); roundRect(ctx, x + 1, topY, nw - 2, remainH, rx); ctx.fill()
        // 前沿白热亮带（燃烧正发生的炽热线）
        const fg2 = ctx.createLinearGradient(0, frontY - 6, 0, frontY + 2)
        fg2.addColorStop(0, 'rgba(255,255,255,0)')
        fg2.addColorStop(1, `rgba(255,255,255,${frontA})`)
        ctx.fillStyle = fg2
        ctx.fillRect(x, frontY - 6, nw, 8)
        ctx.restore()
      }
      // 接触瞬闪：白 → 激活色 径向闪光（更大更亮）
      if (age < FLASH_DUR) {
        const fp = age / FLASH_DUR
        const fr = (18 + fp * 80) * (0.35 + 0.65 * power)
        const fa = (1 - fp) * 0.95 * power
        const fg = ctx.createRadialGradient(cx, notesAreaH, 1, cx, notesAreaH, fr)
        fg.addColorStop(0, `rgba(255,255,255,${fa})`)
        fg.addColorStop(0.25, `rgba(${tint(ar,ag,ab,0.6)},${fa * 0.8})`)
        fg.addColorStop(0.6, `rgba(${tint(ar,ag,ab,0.2)},${fa * 0.3})`)
        fg.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
        ctx.fillStyle = fg
        ctx.fillRect(cx - fr, notesAreaH - fr, fr * 2, fr * 2)
      }
    }
    // age >= burnDur：音符已燃尽消散，不绘制本体（钢琴键仍由 keyState 点亮）

  }

  // ---- 燃烧粒子（冲击波 / 解体碎片 / 烟雾 / 火星 / 引线前沿）----
  // 仅烟雾特效模式下绘制
  if (noteEffect.value === 'smoke') {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const n of notes.value) {
    const [ar, ag, ab] = (trackRgbMap.value.get(n.trackId) || hexRgb(noteActiveColor.value))
    const age = targetTime - n.time
    const burnDur = Math.max(0.05, n.duration)
    const smokeLife = Math.max(0.4, burnDur * 0.85)
    const shardLife = Math.max(0.35, burnDur * 0.75)
    const sparkLife = Math.max(0.22, burnDur * 0.5)
    // 燃尽后仍允许残留粒子（烟雾/碎片）继续上飘直至自身寿命结束，渐隐而非骤灭
    if (age < 0 || age >= burnDur + smokeLife) continue
    if (n.midi < min || n.midi > max) continue
    const { x, w: nw } = noteXW(n.midi, min, keyW)
    const cx = x + nw / 2
    const noteH = Math.max(8, (n.duration / visibleTime) * notesAreaH)
    const p = age / burnDur
    const frontY = notesAreaH - noteH * p
    const seed = n.midi * 73856093 + n.trackId * 19349663
    const burning = age < burnDur  // 燃烧中（燃尽后只残留粒子，不画引线/本体）

    // 解体碎片：从前沿位置沿音符本体向外（主要向两侧+上）飞散
    const shardCount = velocityParticleCount(16, visualPower(n.velocity))
    for (let i = 0; i < shardCount; i++) {
      // 每片在燃烧期内的某个时刻“脱离”前沿
      const breakT = n.time + hash(seed + i * 3.1) * burnDur * 0.9
      const sAge = targetTime - breakT
      if (sAge < 0) continue
      if (sAge > shardLife) continue
      // 脱离前沿：从前沿高度沿音符本体向外飞散
      const bp = (breakT - n.time) / burnDur
      const spawnY = notesAreaH - noteH * bp
      const lr = sAge / shardLife
      const ang = -Math.PI / 2 + (hash(seed + i * 4.7) - 0.5) * 2.6   // 偏上为主，向两侧散
      const spd = 80 + hash(seed + i * 6.3) * 380
      const px = cx + Math.cos(ang) * spd * sAge
      const py = spawnY + Math.sin(ang) * spd * sAge - sAge * sAge * 90 // 轻微上抛重力反转
      const a = fadeA(lr, 0.9)
      const sz = (1.5 + hash(seed + i * 8.1) * 2.5) * (1 - lr * 0.5)
      // 碎片本身是小亮矩形，旋转感用大小变化近似
      ctx.fillStyle = lr < 0.3
        ? `rgba(255,255,255,${a})`
        : `rgba(${tint(ar,ag,ab,0.35 - lr * 0.2)},${a})`
      ctx.save(); ctx.translate(px, py); ctx.rotate(hash(seed + i) * 3.14)
      ctx.fillRect(-sz, -sz * 0.5, sz * 2, sz)
      ctx.restore()
    }

    // 引线前沿 + 炽热核：仅在燃烧中绘制（燃尽后只剩残留粒子上飘）
    if (burning) {
      const lineA = (1 - p) * 0.95 * visualPower(n.velocity)
      const lineGrad = ctx.createLinearGradient(cx - nw, frontY, cx + nw, frontY)
      lineGrad.addColorStop(0, `rgba(${tint(ar,ag,ab,0.4)},0)`)
      lineGrad.addColorStop(0.5, `rgba(255,255,255,${lineA})`)
      lineGrad.addColorStop(1, `rgba(${tint(ar,ag,ab,0.4)},0)`)
      ctx.fillStyle = lineGrad
      ctx.fillRect(x - nw * 0.6, frontY - 2, nw * 2.2, 4)
      const coreR = (10 + (1 - p) * 8) * (0.35 + 0.65 * visualPower(n.velocity))
      const coreG = ctx.createRadialGradient(cx, frontY, 0, cx, frontY, coreR)
      coreG.addColorStop(0, `rgba(255,255,255,${lineA})`)
      coreG.addColorStop(0.5, `rgba(${tint(ar,ag,ab,0.5)},${lineA * 0.6})`)
      coreG.addColorStop(1, `rgba(${tint(ar,ag,ab,0.2)},0)`)
      ctx.fillStyle = coreG
      ctx.fillRect(cx - coreR, frontY - coreR, coreR * 2, coreR * 2)
    }

    // 烟雾：按燃烧时长确定密度，向上飘并扩散、快速消散
    const smokeCount = velocityParticleCount(Math.max(14, Math.min(60, Math.round(burnDur * 30))), visualPower(n.velocity))
    for (let i = 0; i < smokeCount; i++) {
      const ts = n.time + (i / smokeCount) * burnDur
          + (hash(seed + i * 1.7) - 0.5) * (burnDur / smokeCount)
      const pAge = targetTime - ts
      if (pAge < 0 || pAge > smokeLife) continue
      const spawnFront = notesAreaH - noteH * ((ts - n.time) / burnDur)
      const lr = pAge / smokeLife
      const riseSpeed = noteH / smokeLife * 0.5 + 200
      const ox = (hash(seed + i * 2) - 0.5) * nw * 4
      const drift = (hash(seed + i * 3) - 0.5) * 120
      const px = cx + ox + drift * pAge
      const py = spawnFront - riseSpeed * pAge - lr * 60
      const size = 6 + lr * 34
      const a = fadeA(lr, 0.5)
      const g = ctx.createRadialGradient(px, py, 0, px, py, size)
      // 底层发白热 → 外层激活色，营造发光烟雾
      g.addColorStop(0, `rgba(255,255,255,${a * 0.5})`)
      g.addColorStop(0.4, `rgba(${tint(ar,ag,ab,0.55)},${a})`)
      g.addColorStop(0.7, `rgba(${tint(ar,ag,ab,0.15)},${a * 0.4})`)
      g.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
      ctx.fillStyle = g
      ctx.fillRect(px - size, py - size, size * 2, size * 2)
    }

    // 火星拖尾：接触瞬间大量高速白亮粒向上射出
    for (let i = 0; i < velocityParticleCount(14, visualPower(n.velocity)); i++) {
      const ts = n.time + hash(seed + i * 5.3) * 0.1
      const pAge = targetTime - ts
      if (pAge < 0 || pAge > sparkLife) continue
      const lr = pAge / sparkLife
      const ang = -Math.PI / 2 + (hash(seed + i * 7.1) - 0.5) * 1.4
      const spd = 260 + hash(seed + i * 9.7) * 420
      const px = cx + Math.cos(ang) * spd * pAge
      const py = notesAreaH + Math.sin(ang) * spd * pAge - pAge * pAge * 100
      const a = fadeA(lr, 0.95)
      const size = 2.8 * fadeA(lr, 1) + 0.4
      ctx.fillStyle = `rgba(${tint(ar,ag,ab,0.6 + hash(seed + i) * 0.2)},${a})`
      ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
  }

  // ---- 钢琴区域背景 ----
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, notesAreaH, cw, actualPianoH)

  // ---- 绘制钢琴键盘 ----
  // 构建每个键的最新按下时间（取自 notes，无需额外状态）
  const latestPress: Record<number, number> = {}
  const latestPower: Record<number, number> = {}
  for (const n of notes.value) {
    if (n.time <= targetTime && (latestPress[n.midi] === undefined || n.time >= latestPress[n.midi])) {
      latestPress[n.midi] = n.time
      latestPower[n.midi] = visualPower(n.velocity)
    }
  }
  // 白键
  const whiteKeysArr = getWhiteKeys(min, max)
  for (let i = 0; i < whiteKeysArr.length; i++) {
    const midi = whiteKeysArr[i]
    const x = i * keyW
    const active = keyState.value[midi]
    if (active) {
      const power = latestPower[midi] ?? 1
      const age = targetTime - (latestPress[midi] || 0)
      const pulse = Math.max(0, 1 - age / 0.3) * Math.exp(-age * 5) * power
      const c = pianoActiveColor.value
      const pr = parseInt(c.slice(1,3), 16), pg = parseInt(c.slice(3,5), 16), pb = parseInt(c.slice(5,7), 16)
      const a = (pianoOpacity.value / 100) * (0.3 + 0.7 * power)
      ctx.fillStyle = `rgba(${pr},${pg},${pb},${a})`
      ctx.fillRect(x, notesAreaH, keyW - 1, actualPianoH)
      if (pulse > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.5})`
        ctx.fillRect(x, notesAreaH, keyW - 1, actualPianoH)
      }
      ctx.shadowColor = `rgba(${pr},${pg},${pb},${a + pulse * 0.5})`
      ctx.shadowBlur = pianoGlow.value * (0.3 + 0.7 * power) + pulse * 40
      ctx.fillStyle = `rgba(${pr},${pg},${pb},0.01)`
      ctx.fillRect(x, notesAreaH, keyW - 1, actualPianoH)
      ctx.shadowBlur = 0
    } else {
      ctx.fillStyle = pianoInactiveColor.value
      ctx.fillRect(x, notesAreaH, keyW - 1, actualPianoH)
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5
    ctx.strokeRect(x, notesAreaH, keyW - 1, actualPianoH)
    if (((midi - min) % 12 + 12) % 12 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(midiToName(midi), x + keyW / 2, notesAreaH + actualPianoH - 6)
    }
  }
  // 黑键
  for (let i = 0; i < whiteKeysArr.length; i++) {
    const midi = whiteKeysArr[i]
    if (![0,2,5,7,9].includes((midi % 12 + 12) % 12) || midi >= max) continue
    const bMidi = midi + 1
    const x = i * keyW + keyW * 0.65
    const bw = keyW * 0.55; const bh = actualPianoH * 0.62
    const active = keyState.value[bMidi]
    if (active) {
      const power = latestPower[bMidi] ?? 1
      const age = targetTime - (latestPress[bMidi] || 0)
      const pulse = Math.max(0, 1 - age / 0.3) * Math.exp(-age * 5) * power
      const c = pianoBlackActiveColor.value
      const pr = parseInt(c.slice(1,3), 16), pg = parseInt(c.slice(3,5), 16), pb = parseInt(c.slice(5,7), 16)
      const a = (pianoOpacity.value / 100) * (0.3 + 0.7 * power)
      ctx.fillStyle = `rgba(${pr},${pg},${pb},${a})`
      ctx.fillRect(x, notesAreaH, bw, bh)
      if (pulse > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.5})`
        ctx.fillRect(x, notesAreaH, bw, bh)
      }
      ctx.shadowColor = `rgba(${pr},${pg},${pb},${a + pulse * 0.5})`
      ctx.shadowBlur = Math.round(pianoGlow.value * 0.7 * (0.3 + 0.7 * power)) + pulse * 30
      ctx.fillStyle = `rgba(${pr},${pg},${pb},0.01)`
      ctx.fillRect(x, notesAreaH, bw, bh)
      ctx.shadowBlur = 0
    } else {
      ctx.fillStyle = pianoBlackInactiveColor.value
      ctx.fillRect(x, notesAreaH, bw, bh)
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(x + bw * 0.15, notesAreaH, bw * 0.7, bh - 2)
  }

  // ---- 键盘分界线 ----
  const c = noteActiveColor.value
  const r = parseInt(c.slice(1,3), 16), g = parseInt(c.slice(3,5), 16), b = parseInt(c.slice(5,7), 16)
  // 向上渐变光带
  ctx.save()
  ctx.filter = 'blur(3px)'
  const glowH = 30
  const glowGrad = ctx.createLinearGradient(0, notesAreaH - glowH, 0, notesAreaH)
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const a = Math.pow(t, 1.8) * 0.35
    glowGrad.addColorStop(t, `rgba(${r},${g},${b},${a})`)
  }
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, notesAreaH - glowH, cw, glowH)
  ctx.restore()

  // 分割线光晕（烟雾感：多层叠加 + 模糊）
  const lineGlowH = 40, downH = 16
  // 背景烟雾层（宽、极淡）
  ctx.save()
  ctx.filter = 'blur(12px)'
  ctx.fillStyle = `rgba(${r},${g},${b},0.03)`
  ctx.fillRect(0, notesAreaH - lineGlowH, cw, lineGlowH + downH)
  ctx.fillStyle = `rgba(${r},${g},${b},0.015)`
  ctx.fillRect(30, notesAreaH - lineGlowH + 15, cw - 60, lineGlowH - 10)
  ctx.restore()
  // 主线光晕（白色抖动线）
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = dividerSize.value + 1
  ctx.beginPath()
  const t = performance.now() / 100
  ctx.moveTo(0, notesAreaH - 2)
  for (let x = 0; x <= cw; x += 6) {
    const wave = Math.sin(x * 0.06 + t) * 0.8
    ctx.lineTo(x, notesAreaH - 2 + wave)
  }
  ctx.stroke()
  // 主线渐变底
  const lineGlow = ctx.createLinearGradient(0, notesAreaH - lineGlowH, 0, notesAreaH)
  lineGlow.addColorStop(0, `rgba(${r},${g},${b},0)`)
  lineGlow.addColorStop(0.4, `rgba(${r},${g},${b},0.02)`)
  lineGlow.addColorStop(0.7, `rgba(${r},${g},${b},0.06)`)
  lineGlow.addColorStop(0.88, `rgba(${r},${g},${b},0.15)`)
  lineGlow.addColorStop(0.97, 'rgba(255,255,255,0.8)')
  lineGlow.addColorStop(1, 'rgba(255,255,255,1)')
  ctx.fillStyle = lineGlow
  ctx.fillRect(0, notesAreaH - lineGlowH, cw, lineGlowH)
  // 向下渐变
  const downGlow = ctx.createLinearGradient(0, notesAreaH, 0, notesAreaH + downH)
  downGlow.addColorStop(0, 'rgba(255,255,255,0.6)')
  downGlow.addColorStop(0.15, `rgba(${r},${g},${b},0.2)`)
  downGlow.addColorStop(0.5, `rgba(${r},${g},${b},0.04)`)
  downGlow.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = downGlow
  ctx.fillRect(0, notesAreaH, cw, downH)

  // 激活音符接触点：白 → 激活色径向扩散（仅钢琴族）
  for (const n of notes.value) {

    const t2 = currentTime.value / speed.value
    if (!(n.time <= t2 && n.time + n.duration > t2 && n.midi >= min && n.midi <= max)) continue
    const { x: sx, w: nw } = noteXW(n.midi, min, keyW)
    const cx = sx + nw / 2
    const rad = 60
    // 横向拉伸：椭圆渐变
    const rx = rad * 1.5, ry = rad * 0.6
    ctx.save()
    ctx.translate(cx, notesAreaH)
    ctx.scale(1, ry / rx)
    const dotGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, rx)
    dotGlow.addColorStop(0, 'rgba(255,255,255,0.5)')
    dotGlow.addColorStop(0.3, `rgba(${r},${g},${b},0.3)`)
    dotGlow.addColorStop(0.6, `rgba(${r},${g},${b},0.08)`)
    dotGlow.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = dotGlow
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2)
    ctx.restore()
  }

}

function noteXW(midi: number, minNote: number, whiteKeyW: number) {
  const noteInChromatic = ((midi % 12) + 12) % 12
  const whiteIdx = getWhiteKeys(minNote, midi).length - 1
  // 黑键：与钢琴绘制的黑键位置对齐
  if ([1,3,6,8,10].includes(noteInChromatic)) {
    return { x: whiteIdx * whiteKeyW + whiteKeyW * 0.65, w: whiteKeyW * 0.55 }
  }
  // 白键
  return { x: whiteIdx * whiteKeyW, w: whiteKeyW }
}

function getWhiteKeys(minNote: number, upTo?: number) {
  const end = upTo ?? 108
  const result: number[] = []
  for (let i = minNote; i <= end; i++) {
    const n = ((i % 12) + 12) % 12
    if ([0,2,4,5,7,9,11].includes(n)) result.push(i)
  }
  return result
}

// 把 rgb 向白色提亮（l=0 原色，l=1 纯白），返回 "r,g,b" 串
function tint(r: number, g: number, b: number, l: number) {
  return `${Math.round(r + (255 - r) * l)},${Math.round(g + (255 - g) * l)},${Math.round(b + (255 - b) * l)}`
}

// 粒子生命周期的渐隐 alpha：lr∈[0,1]（0=新生 1=消亡）。
// 用 (1-lr)^1.6 缓出，末段额外压低，让消散是逐渐透明而非突然消失。
function fadeA(lr: number, peak: number) {
  return peak * Math.pow(1 - lr, 1.6)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

function midiToName(midi: number) {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
  return names[midi % 12] + Math.floor(midi / 12 - 1)
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ---- RAF 循环 ----
function loop() {
  if (playState.value === 'playing') {
    if(originalAudioActive()&&originalAudioPlayer){
      // Keep MIDI falling-note visuals locked to the unmodified original recording.
      currentTime.value=originalAudioPlayer.currentTime*speed.value
      if(originalAudioPlayer.ended){
        if(repeat.value){
          originalAudioPlayer.currentTime=0
          currentTime.value=0
          void originalAudioPlayer.play().catch(error=>{
            console.warn('Cannot repeat original recording:',error)
            stop()
          })
        }else nextTrack()
      }
    }else{
      currentTime.value += (performance.now() - lastFrameTime) / 1000
      vst3Song?.tick(currentTime.value/speed.value)
      scheduleUpcomingAudio()
      if (currentTime.value >= duration.value) {
        if (repeat.value) {currentTime.value=0;lastScheduledIdx=0;vst3Song?.stop();if(vst3LiveTrackId.value!==null&&!midiBridge.externalOnly)vst3Song?.start(notes.value,vst3LiveTrackId.value,0);midiBridge.stopAll();stopSynthVoices(synthScheduledVoices);piano?.stop();scheduleAll();vst3Song?.tick(0)}
        else { nextTrack() }
      }
    }
  }
  lastFrameTime = performance.now()
  draw()
  rafId = requestAnimationFrame(loop)
}
let lastFrameTime = performance.now()

function onKeyDown(e: KeyboardEvent) {
  if(e.key==='Escape'&&showPublishedLibrary.value){
    showPublishedLibrary.value=false
    e.preventDefault()
    return
  }
  if(showPublishedLibrary.value)return
  if(e.key==='Escape'&&showKontaktAudioCapture.value){
    showKontaktAudioCapture.value=false
    e.preventDefault()
    return
  }
  if(showKontaktAudioCapture.value)return
  if(e.key==='Escape'&&showKontaktRouter.value){
    showKontaktRouter.value=false
    e.preventDefault()
    return
  }
  if(showKontaktRouter.value)return
  if(e.key==='Escape'&&showMidiConnector.value){
    showMidiConnector.value=false
    e.preventDefault()
    return
  }
  if(showMidiConnector.value)return
  if(e.key==='Escape'&&isControlPanelOpen.value){
   closeControlPanel()
   e.preventDefault()
   return
  }
  if(isControlPanelOpen.value)return
  if (e.key === 'Escape') {
    const menuWasOpen = Array.from(menuBarRef.value?.querySelectorAll<HTMLDetailsElement>('details') ?? [])
      .some(menu => menu.open)
    if (menuWasOpen) { menuOpenedByHover = null; closeMenus(); e.preventDefault(); return }
  }
  // Space should not interrupt native menu controls, file selectors, or text entry.
  const target = e.target as HTMLElement
  if (target.closest('input, textarea, select, button, summary, [contenteditable="true"]')) return
  if (e.code === 'Space') { e.preventDefault(); togglePlay() }
}

// ---- 生命周期 ----

onMounted(() => {
  unsubscribeKontaktStatus=midiBridge.subscribe(syncKontaktStatus)
  syncKontaktStatus()
  void erhuWebSampler.init().then(()=>{erhuWebReady.value=erhuWebSampler.ready})
  void refreshPublishedInstruments()
  initPiano()
  void refreshVst3PianoBindings()
  rafId = requestAnimationFrame(loop)
  // 预加载默认背景
  const def = bgPresets[0]
  const img = new Image(); img.src = def.url; bgImage.value = img
  if (playlist.value.length) loadMidi(playlist.value[0].file)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  void nextTick(() => {
    const host = canvasAreaRef.value
    if (!host) return
    previewResizeObserver = new ResizeObserver(fitPreviewCanvas)
    previewResizeObserver.observe(host)
    fitPreviewCanvas()
  })
})

onUnmounted(() => {
  unsubscribeKontaktStatus?.()
  midiBridge.cleanup()
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
  previewResizeObserver?.disconnect()
  previewResizeObserver = null
  cancelAnimationFrame(rafId)
  resetPiano()
  void vst3KeyPreview.dispose()
  originalAudioPlayer?.pause()
  if(originalAudioPlayer){
   originalAudioPlayer.removeAttribute('src')
   originalAudioPlayer.load()
   originalAudioPlayer=null
  }
  for(const entry of playlist.value){
   if(entry.originalAudioUrl)URL.revokeObjectURL(entry.originalAudioUrl)
  }
})

// The timeline is a responsive overview; MIDI playback and export retain every note.
const timelineRows = computed(() => {
  const groups = new Map<number, NoteEvent[]>()
  for (const n of allNotes.value) {
    const list = groups.get(n.trackId)
    if (list) list.push(n)
    else groups.set(n.trackId, [n])
  }
  const total = Math.max(1, duration.value)
  return midiParts.value.map(part => {
    const events = groups.get(part.id) ?? []
    const stride = Math.max(1, Math.ceil(events.length / 160))
    const bars = events.filter((_, i) => i % stride === 0).map(n => {
      const left = Math.min(100, n.time / total * 100)
      return { left, width: Math.max(.2, Math.min(100 - left, n.duration / total * 100)), top: Math.round(Math.max(5, Math.min(29, 29 - (n.midi - 24) / 84 * 22))) }
    })
    return { ...part, bars }
  })
})
const timelineTicks = computed(() => Array.from({ length: 7 }, (_, i) => fmtTime(duration.value * i / 6)))
function seekFromPianoRoll(seconds:number) {
 if(exporting.value)return
 const wasPlaying=playState.value==='playing'
 if(wasPlaying)pause()
 currentTime.value=Math.min(duration.value,Math.max(0,seconds))*speed.value
 lastScheduledIdx=0
 keyState.value={}
 if(wasPlaying)void play()
}
function seekFromTimeline(event: MouseEvent) {
  if (exporting.value || !duration.value) return
  const element = event.currentTarget as HTMLElement
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0) return
  if (playState.value === 'playing') pause()
  midiBridge.stopAll()
  currentTime.value = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * duration.value * speed.value
  lastScheduledIdx = 0
  keyState.value = {}
}
function downloadEditedMidi() {
  if (!allNotes.value.length) return
  // Export a fresh Standard MIDI File from edited notes, keeping each track separate.
  const result = new Midi()
  result.header.setTempo(midiTempo.value)
  for (const part of midiParts.value) {
    const track = result.addTrack()
    track.name = part.name
    track.channel = trackMidiChannel(kontaktChannelForTrack(part.id))
    const chosen=assignedTrackPresets.value[part.id]
    const explicitPresetProgram=chosen&&isInstrumentPreset(chosen)?instrumentPreset(chosen).program:undefined
    track.instrument.number=exportMidiProgram(importedMidiPrograms.value[part.id],explicitPresetProgram)
    // MIDI cannot embed a WAV or NKI. Retain the original GM program for those tracks.
    for (const note of allNotes.value) {
      if (note.trackId !== part.id) continue
      track.addNote({ midi: note.midi, time: note.time, duration: note.duration, velocity: note.velocity })
    }
    // Keep pedal CC64 in its own MIDI track, without extending the original notes.
    for(const event of pedalByTrack.value[part.id]??[])track.addCC({number:64,time:event.time,value:event.value/127})
  }
  const blob = new Blob([result.toArray() as BlobPart], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (currentTrack.value?.name || 'melorix') + '-edited.mid'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function captureFrame() {
  const canvas = canvasRef.value
  if (!canvas) return
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = 'melorix-frame.png'
  a.click()
}

const progressPct = computed(() => duration.value ? (currentTime.value / duration.value) * 100 : 0)
const keyState = ref<Record<number, boolean>>({})
watch(() => currentTime.value, (t) => {
  if (playState.value !== 'playing') return
  const ks: Record<number, boolean> = {}
  const target = t / speed.value
  for (const n of notes.value) {
    if (n.time <= target && n.time + n.duration > target) ks[n.midi] = true
  }
  keyState.value = ks
})
</script>

<template>
  <div class="mx-shell" :class="isFullscreen ? 'mx-fullscreen' : ''">
    <header v-if="!isFullscreen" class="mx-topline">
      <div class="mx-brand"><span class="mx-brand-mark"><i class="fas fa-music"></i></span><span>MELORIX</span></div>
      <nav ref="menuBarRef" class="mx-menu" aria-label="Menu MELORIX" @click="onMenuClick" @pointerover="onMenuPointerOver">
        <details name="melorix-main-menu"><summary>Tệp</summary><div class="mx-menu-pop">
          <label><i class="fas fa-file-import mr-2"></i> Nhập MIDI
            <input type="file" class="hidden" accept=".mid,.midi" :disabled="loadingMidi || converting || exporting" @change="onFileUpload($event); closeMenus()">
          </label>
          <label><i class="fas fa-wave-square mr-2"></i> Nhập âm thanh
            <input type="file" class="hidden" accept="audio/*" :disabled="loadingMidi || converting || exporting" @change="onFileUpload($event); closeMenus()">
          </label>
          <label title="Gắn một bản thu âm gốc vào MIDI đang mở, giữ nguyên track và nốt">
            <i class="fas fa-link mr-2"></i> Gắn bản thu gốc vào MIDI
            <input type="file" class="hidden" accept="audio/*,.wav,.mp3,.flac,.m4a"
              :disabled="loadingMidi || converting || exporting" @change="attachOriginalAudioToCurrentMidi($event); closeMenus()">
          </label>
          <button type="button" @click="showPlaylist = !showPlaylist"><i class="fas fa-folder-open mr-2"></i> Thư viện bài nhạc</button>
          <button type="button" :disabled="exporting || !allNotes.length" @click="downloadEditedMidi"><i class="fas fa-save mr-2"></i> Lưu MIDI đã chỉnh (.mid)</button>
          <button type="button" :disabled="exporting" @click="showExport = true"><i class="fas fa-file-video mr-2"></i> Xuất video MP4</button>
        </div></details>
        <details name="melorix-main-menu"><summary>Chỉnh sửa</summary><div class="mx-menu-pop">
          <button type="button" :disabled="exporting" @click="setAllParts(true)">Bật tất cả track</button>
          <button type="button" :disabled="exporting" @click="setAllParts(false)">Tắt tất cả track</button>
          <button type="button" @click="showOtherSettings = true">Thiết lập MIDI và AI</button>
        </div></details>
        <details name="melorix-main-menu"><summary>Phát lại</summary><div class="mx-menu-pop">
          <button type="button" :disabled="!notes.length || exporting" @click="togglePlay">{{ playState === 'playing' ? 'Tạm dừng' : 'Phát nhạc' }}</button>
          <button type="button" @click="stop">Dừng / về đầu</button>
           <button type="button" @click="testWebSound">Kiểm tra loa (trống + nhạc cụ)</button>
           <div v-if="gmAudioNotice" role="status" class="mx-menu-caption">{{ gmAudioNotice }}</div>
          <div class="mx-menu-caption">Biểu cảm khi phát (không sửa MIDI gốc)</div>
           <button type="button" :aria-pressed="expressionMode==='original'" @click="setExpressionMode('original')">{{ expressionMode==='original'?'✓ ':'' }}Nguyên bản MIDI</button>
           <button type="button" :aria-pressed="expressionMode==='natural'" @click="setExpressionMode('natural')">{{ expressionMode==='natural'?'✓ ':'' }}Tự nhiên · nhấn nhá nhẹ</button>
           <button type="button" :aria-pressed="expressionMode==='warm'" @click="setExpressionMode('warm')">{{ expressionMode==='warm'?'✓ ':'' }}Ấm và sâu · ngân vang hơn</button>
           <button type="button" @click="nextTrack">Bài tiếp theo</button>
          <button type="button" @click="repeat = !repeat">{{ repeat ? '✓ ' : '' }}Lặp lại bài</button>
        </div></details>
        <details name="melorix-main-menu"><summary>Track MIDI</summary><div class="mx-menu-pop">
          <button type="button" :aria-pressed="isTimelineOpen" @click="isTimelineOpen = !isTimelineOpen">{{ isTimelineOpen ? '✓ ' : '' }}Hiện dòng thời gian</button>
          <button type="button" :aria-pressed="isTrackPanelOpen" @click="toggleTrackPanel">{{ isTrackPanelOpen ? '✓ ' : '' }}Danh sách track bên trái</button>
          <button type="button" :aria-pressed="isInspectorOpen" @click="toggleInspectorPanel">{{ isInspectorOpen ? '✓ ' : '' }}Bảng chỉnh sửa bên phải</button>
          <button type="button" :disabled="exporting" @click="setAllParts(true)">Bật toàn bộ nhạc cụ</button>
          <button type="button" :disabled="exporting" @click="setAllParts(false)">Tắt toàn bộ nhạc cụ</button>
          <div class="mx-menu-caption">{{ midiParts.length }} track · {{ enabledPartCount }} đang bật</div>
        </div></details>
        <details name="melorix-main-menu"><summary>Nhạc cụ</summary><div class="mx-menu-pop" aria-label="Menu nhạc cụ">
          <button type="button" @click="openTrackComposer"><i class="fas fa-plus mr-2"></i> Thêm track</button>
          <button type="button" @click="openPublishedLibrary"><i class="fas fa-book-open mr-2"></i> Xem thư viện nhạc cụ</button>
        </div></details>
        <details name="melorix-main-menu"><summary>Công cụ</summary><div class="mx-menu-pop">
          <div class="mx-menu-caption">Tùy chọn nâng cao</div>
          <button type="button" @click="selectErhuFolder">Cài tiếng Erhu WAV cho web (một lần)</button>
           <div v-if="erhuWebMessage" role="status" class="mx-menu-caption">{{ erhuWebMessage }}</div>
           <button type="button" @click="openPersonalInstrumentImport">Nhập mẫu WAV riêng</button>
          <button type="button" @click="openMidiConnector"><i class="fas fa-plug mr-2"></i>Kết nối Kontakt trên Windows</button>
          <button type="button" @click="openKontaktRouter">Thiết lập kênh Kontakt</button>
          <button type="button" @click="openKontaktAudioCapture">Thu / nhập âm thanh Kontakt (MP4)</button>
          <button type="button" @click="openInstrumentTrackPanel()">Đổi tiếng của track</button>

          <button type="button" @click="showBgSettings = true">Hiệu ứng nốt rơi</button>
          <button type="button" @click="showPianoSettings = true">Bàn phím Piano</button>
          <button type="button" @click="toggleInspectorPanel">{{ isInspectorOpen ? 'Ẩn' : 'Mở' }} bảng chỉnh trực tiếp</button>
          <button type="button" @click="showOtherSettings = true">Cài đặt nâng cao / AI</button>
        </div></details>
        <details name="melorix-main-menu"><summary>Hiển thị</summary><div class="mx-menu-pop">
          <button type="button" :aria-pressed="isTimelineOpen" @click="isTimelineOpen = !isTimelineOpen">{{ isTimelineOpen ? '✓ ' : '' }}Timeline MIDI</button>
          <button type="button" :aria-pressed="isTrackPanelOpen" @click="toggleTrackPanel">{{ isTrackPanelOpen ? '✓ ' : '' }}Danh sách track bên trái</button>
          <button type="button" :aria-pressed="isInspectorOpen" @click="toggleInspectorPanel">{{ isInspectorOpen ? '✓ ' : '' }}Bảng thuộc tính bên phải</button>
          <button type="button" :aria-pressed="videoFormat === 'landscape'" @click="videoFormat = 'landscape'">{{ videoFormat === 'landscape' ? '✓ ' : '' }}Video ngang 16:9</button>
          <button type="button" :aria-pressed="videoFormat === 'portrait'" @click="videoFormat = 'portrait'">{{ videoFormat === 'portrait' ? '✓ ' : '' }}Video dọc 9:16</button>
          <button type="button" @click="toggleFullscreen">Xem toàn màn hình</button>
        </div></details>
        <details name="melorix-main-menu"><summary>Xuất</summary><div class="mx-menu-pop">
          <button type="button" :disabled="exporting" @click="showExport = true">Xuất MP4 (15 giây / 30 giây / cả bài)</button>
          <button type="button" @click="captureFrame">Lưu khung hình PNG</button>
        </div></details>
      </nav>
      <span class="mx-head-meta">MIDI · VIDEO VISUAL STUDIO</span>
    </header>

    <div v-if="!isFullscreen && uploadError" role="alert" class="mx-warning mx-error">
      {{ uploadError }} <button class="mx-track-mini" type="button" @click="uploadError = ''">{{ t('piano.dismissError') }}</button>
    </div>

    <div class="mx-workspace" :class="{ 'mx-inspector-open': isInspectorOpen, 'mx-tracks-open': isTrackPanelOpen }">
      <div v-if="!isFullscreen && (isInspectorOpen || isTrackPanelOpen)" class="mx-inspector-backdrop" @click="isInspectorOpen = false; isTrackPanelOpen = false" aria-hidden="true"></div>
      <aside v-if="!isFullscreen && isTrackPanelOpen" class="mx-track-sidebar" aria-label="Danh sách track MIDI">
        <div class="mx-inspector-top mx-track-sidebar-title">
          <i class="fas fa-layer-group"></i><span>Track MIDI</span>
          <span class="mx-track-side-count">{{ enabledPartCount }}/{{ midiParts.length }}</span>
          <button type="button" class="mx-track-add-btn" :aria-expanded="activeEditorPanel === 'track'" aria-label="Tạo track nhạc cụ mới" title="Thêm track nhạc cụ" :disabled="exporting" @click="toggleTrackComposerPreview"><i class="fas fa-plus"></i></button>
          <button type="button" class="mx-side-close" aria-label="Ẩn danh sách track" title="Ẩn track" @click="isTrackPanelOpen = false"><i class="fas fa-times"></i></button>
        </div>

        <div class="mx-track-sidebar-actions">
          <button type="button" :disabled="exporting || !midiParts.length" @click="setAllParts(true)">Bật tất cả</button>
          <button type="button" :disabled="exporting || !midiParts.length" @click="setAllParts(false)">Tắt tất cả</button>
        </div>
        <div class="mx-track-sidebar-list">
          <p v-if="!midiParts.length" class="mx-track-sidebar-empty">Chưa có track. Nhấn + để thêm nhạc cụ hoặc nhập MIDI.</p>
          <section v-for="part in timelineRows" :key="part.id" class="mx-track-side-item"
             :class="{ 'mx-track-side-item-muted': !part.enabled, 'mx-track-side-item-selected': selectedTrackId===part.id }"
             @click="selectTrack(part.id)">
            <div class="mx-track-side-top">
              <button type="button" class="mx-eye" :title="part.enabled ? 'Ẩn track' : 'Bật track'" :disabled="exporting" @click="setPartEnabled(part.id, !part.enabled)">
                <i :class="part.enabled ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
              </button>
              <span class="mx-swatch" :style="{ backgroundColor: part.color }"></span>
              <button type="button" class="mx-track-name mx-track-select"
                 :title="'Chọn '+part.name+' · nhấp đúp để mở Piano Roll'"
                 :aria-label="'Chọn track '+part.name" :aria-pressed="selectedTrackId===part.id" :disabled="exporting"
                 @click.stop="selectTrack(part.id)" @dblclick.stop="openPianoRoll(part.id)">{{ part.name }}</button>
              <button type="button" class="mx-track-mini" :aria-pressed="!part.enabled" :disabled="exporting" @click="setPartEnabled(part.id, !part.enabled)" title="Mute">M</button>
              <button type="button" class="mx-track-mini" :aria-pressed="part.enabled && enabledPartCount === 1" :disabled="exporting" @click="soloPart(part.id)" title="Solo">S</button>
               <button type="button" class="mx-track-delete" :disabled="exporting"
                 :aria-label="'Xóa track '+part.name" :title="'Xóa track '+part.name"
                 @click.stop="deleteMidiTrack(part.id)"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
            </div>
            <div class="mx-track-side-sub">
              <button type="button" class="mx-track-instrument-trigger" :aria-expanded="activeEditorPanel === 'instrument' && instrumentPreviewTrackId === part.id" :aria-label="'Chọn nhạc cụ cho ' + part.name" :title="'Thay âm sắc cho ' + part.name" :disabled="exporting" @click="toggleInstrumentPreview(part.id)">
                <span>{{ part.instrument || 'MIDI' }}</span>
                <i class="fas fa-chevron-down" aria-hidden="true"></i>
              </button>
              <button type="button" class="mx-kontakt-route-trigger" :disabled="exporting" @click="openKontaktRouter">Ch {{ kontaktChannelForTrack(part.id) }}</button>
              <span>{{ part.noteCount }} nốt</span>
              <input type="color" :value="part.color" :disabled="exporting" :aria-label="'Màu ' + part.name" @input="onPartColorInput(part.id, $event)">
            </div>
            <label class="mx-track-volume" :class="{ 'mx-track-volume-zero': trackVolumePercent(part.id) === 0 }">
              <i class="fas fa-volume-down" aria-hidden="true"></i>
              <input type="range" min="0" max="100" step="1"
                :aria-label="'Âm lượng track ' + part.name"
                :value="trackVolumePercent(part.id)" :disabled="exporting"
                @input="setTrackVolume(part.id,$event)">
              <output>{{ trackVolumePercent(part.id) }}%</output>
            </label>
            <div class="mx-track-side-minimap mx-editable-track" :aria-label="'Chọn track hoặc nhấp đúp để chỉnh từng nốt trong ' + part.name" :title="'Nhấp đúp để chỉnh Piano Roll: ' + part.name" role="button" tabindex="0" @dblclick.stop="openPianoRoll(part.id)" @keydown.enter="openPianoRoll(part.id)">
              <span v-for="(bar,idx) in part.bars" :key="idx" class="mx-track-side-mini-note" :style="{ left: bar.left + '%', width: bar.width + '%', backgroundColor: part.color }"></span>
            </div>
          </section>
        </div>
        <div class="mx-track-side-footer">
          <button type="button" @click="isTimelineOpen = !isTimelineOpen">{{ isTimelineOpen ? 'Ẩn' : 'Mở' }} timeline</button>
          <button type="button" @click="showPlaylist = !showPlaylist">Bài nhạc</button>
        </div>
      </aside>
      <div class="mx-stage">
        <section v-if="!isFullscreen && isTimelineOpen" class="mx-timeline" aria-label="Dòng thời gian MIDI">
          <div class="mx-timeline-head">
            <div class="mx-timeline-title"><i class="fas fa-stream mr-2"></i> TRACKS · {{ enabledPartCount }}/{{ midiParts.length }} đang bật</div>
            <div class="mx-ruler"><span v-for="(tick,i) in timelineTicks" :key="i">{{ tick }}</span></div>
          </div>
          <div class="mx-lanes">
            <div v-if="!midiParts.length" class="mx-empty">Đang nạp bài MIDI…</div>
            <div v-for="part in timelineRows" :key="part.id" class="mx-track-row"
               :class="{ 'mx-track-row-selected': selectedTrackId===part.id }" @click="selectTrack(part.id)">
              <div class="mx-track-controls">
                <button type="button" class="mx-eye" :title="part.enabled ? 'Ẩn track' : 'Hiện track'" :disabled="exporting" @click="setPartEnabled(part.id, !part.enabled)">
                  <i :class="part.enabled ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
                </button>
                <span class="mx-swatch" :style="{ background: part.color }"></span>
                <button type="button" class="mx-track-name mx-track-select"
                   :style="{ color: part.enabled ? part.color : '#929ba8' }"
                   :aria-label="'Chọn track '+part.name" :aria-pressed="selectedTrackId===part.id"
                   :disabled="exporting" @click.stop="selectTrack(part.id)" @dblclick.stop="openPianoRoll(part.id)"
                   :title="'Chọn '+part.name+' · nhấp đúp để mở Piano Roll'">{{ part.name }}</button>
                <button type="button" class="mx-track-mini" :aria-pressed="!part.enabled" :disabled="exporting" @click="setPartEnabled(part.id, !part.enabled)">M</button>
                <button type="button" class="mx-track-mini" :aria-pressed="part.enabled && enabledPartCount === 1" :disabled="exporting" @click="soloPart(part.id)">S</button>
                <input type="color" class="mx-track-color" :value="part.color" :disabled="exporting" :aria-label="'Màu track ' + part.name" @input="onPartColorInput(part.id, $event)">
              </div>
              <button type="button" class="mx-lane" :class="{ 'mx-lane-muted': !part.enabled }" :aria-label="'Chọn thời điểm cho ' + part.name" @click="seekFromTimeline" @dblclick.stop="openPianoRoll(part.id)">
                <span v-for="(bar,index) in part.bars" :key="index" class="mx-note" :style="{ left: bar.left + '%', width: bar.width + '%', top: bar.top + 'px', background: part.color, color: part.color }"></span>
                <span class="mx-cursor" :style="{ left: progressPct + '%' }"></span>
              </button>
            </div>
          </div>
        </section>
        <!-- Các hộp thoại cài đặt gốc giữ nguyên engine và chức năng -->
    <!-- 音符区设置 Modal -->
    <Modal v-model:show="showBgSettings" :title="t('piano.noteAreaSettings')">
      <div class="flex flex-col gap-4 p-4 text-black/85 dark:text-white/90">
        <!-- 音符颜色 -->
        <div>
          <p class="text-base font-medium text-black/80 dark:text-white/85 m-0 mb-2">{{ t('piano.noteColor') }}</p>
          <div class="flex gap-2 items-center">
            <span class="text-sm text-black/60 dark:text-white/70">{{ t('piano.activeColor') }}</span>
            <input type="color" v-model="noteActiveColor" class="w-8 h-8 rounded cursor-pointer border-0 p-0">
          </div>
        </div>
        <!-- 接触特效 -->
        <div>
          <p class="text-base font-medium text-black/80 dark:text-white/85 m-0 mb-2">{{ t('piano.noteEffect') }}</p>
          <div class="flex gap-2 flex-wrap">
            <button v-for="opt in noteEffectOptions" :key="opt.value" @click="noteEffect = opt.value"
              class="py-1.5 px-3 text-sm rounded-lg border transition-all"
              :class="noteEffect === opt.value ? 'border-primary-500/40 bg-primary-500/10 text-primary-500' : 'border-black/15 dark:border-white/15 bg-white/50 dark:bg-white/[0.06] text-black/60 dark:text-white/60 hover:bg-primary-500/10'">
              {{ opt.label }}
            </button>
          </div>
        </div>
        <div class="flex flex-col gap-2 rounded-lg border border-black/10 dark:border-white/10 p-3">
          <p class="text-sm font-medium">{{ t('piano.velocityVisualTitle') }}</p>
          <p class="text-xs opacity-65">{{ t('piano.velocityVisualHint') }}</p>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="mode in velocityModes" :key="mode" type="button" :aria-pressed="velocityMode === mode"
              class="rounded-lg border px-2 py-2 text-xs" :class="velocityMode === mode ? 'border-primary-500 bg-primary-500/15 text-primary-500' : 'border-black/15 dark:border-white/20'" @click="velocityMode = mode">
              {{ t('piano.velocityMode_' + mode) }}
            </button>
          </div>
          <label class="flex gap-2 justify-between items-center text-sm">
            <span>{{ t('piano.velocitySensitivity') }} {{ velocitySensitivity }}%</span>
            <input type="range" min="0" max="100" step="5" v-model.number="velocitySensitivity" :disabled="velocityMode === 'off'">
          </label>
          <p class="text-xs opacity-65">{{ t('piano.velocitySourceHint') }}</p>
        </div>
        <!-- 音符发光 -->
        <div class="flex flex-col gap-2">
          <label class="flex items-center justify-between gap-2 text-sm text-black/60 dark:text-white/70">
            <span>{{ t('piano.glow') }} {{ noteGlow }}px</span>
            <input type="range" min="0" max="240" v-model.number="noteGlow" class="w-28 h-1 accent-primary-500">
          </label>
          <label class="flex items-center justify-between gap-2 text-sm text-black/60 dark:text-white/70">
            <span>{{ t('piano.opacity') }} {{ noteOpacity }}%</span>
            <input type="range" min="10" max="100" v-model.number="noteOpacity" class="w-28 h-1 accent-primary-500">
          </label>
        </div>
        <!-- 背景设置 -->
        <div>
          <p class="text-base font-medium text-black/80 dark:text-white/85 m-0 mb-2">{{ t('piano.bgSettings') }}</p>
          <div class="flex gap-2 flex-wrap">
            <button v-for="p in bgPresets" :key="p.url" @click="applyBgPreset(p)"
              class="py-1.5 px-3 text-sm rounded-lg border transition-all"
              :class="bgMedia?.url === p.url ? 'border-primary-500/40 bg-primary-500/10 text-primary-500' : 'border-black/15 dark:border-white/15 bg-white/50 dark:bg-white/[0.06] text-black/60 dark:text-white/60 hover:bg-primary-500/10'">
              {{ p.name }}
            </button>
            <label class="py-1.5 px-3 text-sm rounded-lg border border-black/15 dark:border-white/15 bg-white/50 dark:bg-white/[0.06] text-primary-500 cursor-pointer transition-all hover:bg-primary-500/10 hover:border-primary-500/40">
              <i class="fas fa-plus mr-1"></i>{{ t('piano.custom') }}
              <input type="file" accept="image/*,video/*" @change="handleBgUpload" class="hidden">
            </label>
          </div>
        </div>
        <Btn @click="clearBg" type="default" size="small">
          <i class="fas fa-trash mr-1"></i>{{ t('piano.clearBg') }}
        </Btn>
      </div>
    </Modal>

    <!-- 钢琴区设置 Modal -->
    <Modal v-model:show="showPianoSettings" :title="t('piano.pianoAreaSettings')">
      <div class="flex flex-col gap-4 p-4 text-black/85 dark:text-white/90">
        <div>
          <p class="text-base font-medium text-black/80 dark:text-white/85 m-0 mb-2">{{ t('piano.whiteKey') }}</p>
          <div class="flex gap-3">
            <div class="flex gap-1.5 items-center"><span class="text-sm text-black/60 dark:text-white/70">{{ t('piano.active') }}</span><input type="color" v-model="pianoActiveColor" class="w-7 h-7 rounded cursor-pointer border-0 p-0"></div>
            <div class="flex gap-1.5 items-center"><span class="text-sm text-black/60 dark:text-white/70">{{ t('piano.inactive') }}</span><input type="color" v-model="pianoInactiveColor" class="w-7 h-7 rounded cursor-pointer border-0 p-0"></div>
          </div>
        </div>
        <div>
          <p class="text-base font-medium text-black/80 dark:text-white/85 m-0 mb-2">{{ t('piano.blackKey') }}</p>
          <div class="flex gap-3">
            <div class="flex gap-1.5 items-center"><span class="text-sm text-black/60 dark:text-white/70">{{ t('piano.active') }}</span><input type="color" v-model="pianoBlackActiveColor" class="w-7 h-7 rounded cursor-pointer border-0 p-0"></div>
            <div class="flex gap-1.5 items-center"><span class="text-sm text-black/60 dark:text-white/70">{{ t('piano.inactive') }}</span><input type="color" v-model="pianoBlackInactiveColor" class="w-7 h-7 rounded cursor-pointer border-0 p-0"></div>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <label class="flex items-center justify-between gap-2 text-sm text-black/60 dark:text-white/70">
            <span>{{ t('piano.glow') }} {{ pianoGlow }}px</span>
            <input type="range" min="0" max="240" v-model.number="pianoGlow" class="w-28 h-1 accent-primary-500">
          </label>
          <label class="flex items-center justify-between gap-2 text-sm text-black/60 dark:text-white/70">
            <span>{{ t('piano.opacity') }} {{ pianoOpacity }}%</span>
            <input type="range" min="10" max="100" v-model.number="pianoOpacity" class="w-28 h-1 accent-primary-500">
          </label>
        </div>
      </div>
    </Modal>

    <!-- 其他设置 Modal -->
    <Modal v-model:show="showOtherSettings" :title="t('piano.otherSettings')">
      <div class="flex flex-col gap-4 p-4 text-black/85 dark:text-white/90">
        <AppCheckbox v-model="hideControlsInFullscreen"><span class="text-sm text-black/70 dark:text-white/80">{{ t('piano.hideControls') }}</span></AppCheckbox>
        <div>
          <p class="text-base font-medium text-black/80 dark:text-white/85 m-0 mb-2">{{ t('piano.divider') }}</p>
          <label class="flex items-center justify-between gap-2 text-sm text-black/60 dark:text-white/70">
            <span>{{ t('piano.dividerSize') }} {{ dividerSize }}px</span>
            <input type="range" min="1" max="10" v-model.number="dividerSize" class="w-28 h-1 accent-primary-500">
          </label>
        </div>
        <div>
          <p class="text-base font-medium text-black/80 dark:text-white/85 m-0 mb-2">{{ t('piano.bpParams') }}</p>
          <p class="text-xs text-black/40 dark:text-white/50 m-0 -mt-2">{{ t('piano.bpParamsHint') }}</p>
          <div class="flex flex-col gap-3">
            <div>
              <div class="flex items-center justify-between gap-2"><span class="text-sm text-black/60 dark:text-white/70">{{ t('piano.onsetThresh') }} {{ bpSettings.onsetThresh.toFixed(2) }}</span><input type="range" min="0.1" max="0.9" v-model.number="bpSettings.onsetThresh" step="0.05" class="w-28 h-1 accent-primary-500"></div>
              <p class="text-xs text-black/30 dark:text-white/30 m-0 mt-0.5">{{ t('piano.onsetThreshHint') }}</p>
            </div>
            <div>
              <div class="flex items-center justify-between gap-2"><span class="text-sm text-black/60 dark:text-white/70">{{ t('piano.frameThresh') }} {{ bpSettings.frameThresh.toFixed(2) }}</span><input type="range" min="0.1" max="0.9" v-model.number="bpSettings.frameThresh" step="0.05" class="w-28 h-1 accent-primary-500"></div>
              <p class="text-xs text-black/30 dark:text-white/30 m-0 mt-0.5">{{ t('piano.frameThreshHint') }}</p>
            </div>
            <div>
              <div class="flex items-center justify-between gap-2"><span class="text-sm text-black/60 dark:text-white/70">{{ t('piano.minNoteLen') }} {{ bpSettings.minNoteLen }}</span><input type="range" min="1" max="20" v-model.number="bpSettings.minNoteLen" class="w-28 h-1 accent-primary-500"></div>
              <p class="text-xs text-black/30 dark:text-white/30 m-0 mt-0.5">{{ t('piano.minNoteLenHint') }}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Video format is shared by the preview canvas and the export canvas. -->
    <Modal v-model:show="showExport" :title="t('piano.exportVideo')">
      <div class="flex flex-col gap-4 p-4 text-black/85 dark:text-white/90">
        <template v-if="!exporting">
          <p class="text-sm font-medium">{{ t('piano.videoRatioLabel') }}</p>
          <div class="grid grid-cols-2 gap-2" role="group" :aria-label="t('piano.videoRatioLabel')">
            <button type="button" :aria-pressed="videoFormat === 'portrait'" @click="videoFormat = 'portrait'"
              class="rounded-xl border p-3 text-left transition-colors"
              :class="videoFormat === 'portrait' ? 'border-primary-500 bg-primary-500/10' : 'border-black/15 dark:border-white/15 hover:bg-primary-500/5'">
              <span class="block text-sm font-semibold">{{ t('piano.portraitFormat') }}</span>
              <span class="block text-xs opacity-65 mt-1">1080 × 1920 · 30 FPS</span>
            </button>
            <button type="button" :aria-pressed="videoFormat === 'landscape'" @click="videoFormat = 'landscape'"
              class="rounded-xl border p-3 text-left transition-colors"
              :class="videoFormat === 'landscape' ? 'border-primary-500 bg-primary-500/10' : 'border-black/15 dark:border-white/15 hover:bg-primary-500/5'">
              <span class="block text-sm font-semibold">{{ t('piano.landscapeFormat') }}</span>
              <span class="block text-xs opacity-65 mt-1">1920 × 1080 · 30 FPS</span>
            </button>
          </div>
          <label v-if="videoFormat === 'portrait'" class="flex flex-col gap-2 text-sm">
            <span class="font-medium">{{ t('piano.portraitKeyboardLabel') }}</span>
            <select :value="portraitKeyboard" @change="onKeyboardModeChange($event)"
              class="p-2 rounded-lg border border-black/15 dark:border-white/15 bg-white/80 text-black dark:bg-[#23232c] dark:text-white">
              <option value="auto">{{ t('piano.portraitKeyboardAuto') }}</option>
              <option value="24">C1–B4 (MIDI 24–71)</option>
              <option value="36">C2–B5 (MIDI 36–83)</option>
              <option value="48">C3–B6 (MIDI 48–95)</option>
              <option value="60">C4–B7 (MIDI 60–107)</option>
              <option value="all">{{ t('piano.portraitKeyboardAll') }}</option>
            </select>
          </label>
          <p v-if="videoFormat === 'portrait' && hiddenPortraitNotes > 0" role="status" class="text-xs text-amber-700 dark:text-amber-300">
            {{ t('piano.notesOutsideFrame', { count: hiddenPortraitNotes }) }}
          </p>
          <label class="flex flex-col gap-2 text-sm">
            <span class="font-medium">{{ t('piano.exportLength') }}</span>
            <select v-model="exportLength" class="p-2 rounded-lg border border-black/15 dark:border-white/15 bg-white/80 dark:bg-[#23232c]">
              <option value="preview15">{{ t('piano.exportPreview15') }}</option>
              <option value="preview30">{{ t('piano.exportPreview30') }}</option>
              <option value="full">{{ t('piano.exportFullSong') }}</option>
            </select>
            <span class="text-xs opacity-65">{{ t('piano.exportDurationHint', { seconds: Math.ceil(selectedExportSeconds) }) }}</span>
          </label>
          <div class="mx-kontakt-export-options">
            <label v-if="kontaktAudioBuffer" class="mx-kontakt-export-select">
              <input type="checkbox" v-model="useKontaktAudio">
              <span>Dùng âm thanh Kontakt thật: <strong>{{ kontaktAudioName }}</strong> (thay tiếng piano mặc định)</span>
            </label>
            <label v-if="kontaktAudioBuffer && useKontaktAudio" class="mx-kontakt-export-offset">
              Độ lệch tiếng so với video (giây)
              <input v-model.number="kontaktAudioOffset" type="number" step="0.1" min="-300" max="300" aria-label="Độ lệch âm thanh Kontakt (giây)">
              <small>+ làm tiếng bắt đầu trễ; − cắt đoạn đầu âm thanh thu. Thường để 0 nếu đã thu từ lúc MELORIX phát bài.</small>
            </label>
            <p v-if="hasOriginalAudio && useOriginalAudio && !useKontaktAudio" role="note">Đang giữ bản thu âm gốc khi xuất MP4. Bản thu không bị thay bằng GM và không thay đổi khi sửa nốt MIDI.</p>
            <p v-else-if="!kontaktAudioBuffer || !useKontaktAudio" role="note">MP4 dựng lại âm thanh từ MIDI bằng Piano/GM/Drums/Synth. MIDI không chứa âm sắc và hiệu ứng trong bản thu gốc.</p>
             <p v-if="exportAudioNotice" role="status">{{ exportAudioNotice }}</p>
            <button type="button" @click="openKontaktAudioCapture">{{ kontaktAudioBuffer ? 'Thay / nghe lại bản thu Kontakt' : 'Thu hoặc nhập âm thanh Kontakt' }}</button>
          </div>
          <p class="text-xs text-black/60 dark:text-white/60 m-0">{{ t('piano.exportHint') }}</p>
          <Btn @click="exportVideo" type="primary">
            <i class="fas fa-download"></i>
            {{ t('piano.startExport') }}
          </Btn>
        </template>
        <template v-else>
          <p class="text-sm text-black/70 dark:text-white/80 m-0 flex items-center gap-2">
            <i class="fas fa-spinner fa-spin text-primary-500"></i>
            <span>{{ exportPhase === 'preparing' ? t('piano.exportPreparingAudio') : t('piano.exporting') }}</span>
          </p>
          <div class="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div class="h-full bg-primary-500 transition-all duration-200" :style="{ width: Math.round(exportProgress * 100) + '%' }"></div>
          </div>
          <div class="flex justify-between text-xs text-black/60 dark:text-white/60 tabular-nums">
            <span>{{ Math.round(exportProgress * 100) }}%</span>
            <span v-if="exportEta > 0">{{ t('piano.etaPrefix') }} {{ fmtTime(Math.ceil(exportEta)) }}</span>
          </div>
        </template>
      </div>
    </Modal>

        <section class="mx-preview" :class="{ 'mx-preview-full': isFullscreen }">
          <div ref="canvasAreaRef" class="mx-preview-canvas-area">
      <canvas ref="canvasRef" class="block bg-black/95 dark:bg-black mx-auto"
        :style="{ width: fittedPreview.width + 'px', height: fittedPreview.height + 'px' }"></canvas>
          </div>

      <!-- 进度条 -->
      <div v-show="!(isFullscreen && hideControlsInFullscreen)" class="mx-preview-progress h-1.5 bg-black/10 dark:bg-white/[0.06] flex-shrink-0">
        <div class="h-full bg-primary-500/80" :style="{ width: progressPct + '%' }"></div>
      </div>

      <!-- 底部控制栏 -->
      <div v-show="!(isFullscreen && hideControlsInFullscreen)" class="mx-transport flex items-center gap-3 px-4 py-2.5 bg-white/5 dark:bg-white/[0.02] flex-shrink-0 relative">
        <!-- 播放列表按钮 -->
        <button @click="showPlaylist = !showPlaylist" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border border-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.4)] shadow-glass-light text-[#191c1e] dark:bg-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] dark:text-white/85 dark:shadow-none transition-all duration-300 hover:-translate-y-px hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.5)] hover:shadow-glass-hover-light active:translate-y-0 active:bg-[rgba(255,255,255,0.3)] dark:hover:bg-[rgba(255,255,255,0.15)] dark:hover:border-[rgba(255,255,255,0.15)] dark:active:bg-[rgba(255,255,255,0.08)]">
          <i class="fas fa-list text-xs"></i>
        </button>
        <!-- 当前曲目 -->
        <span class="text-xs text-black/50 dark:text-white/50 truncate flex-1 min-w-0">{{ currentTrack?.name || '--' }}</span>
         <label v-if="hasOriginalAudio" class="mx-original-audio-toggle"
           title="Bản thu gốc không chịu Mute/Volume của từng track. Sửa nốt MIDI không đổi bản thu. Tắt để nghe MIDI dựng lại.">
           <input type="checkbox" v-model="useOriginalAudio" :disabled="exporting" @change="onOriginalAudioModeChange">
           <i class="fas fa-wave-square" aria-hidden="true"></i>
           <span>{{ useOriginalAudio ? 'Bản thu gốc' : 'Âm thanh MIDI' }}</span>
         </label>
        <button type="button" class="mx-kontakt-live-action" :class="{ 'mx-kontakt-live-connected': kontaktMidiLive }"
          :title="kontaktMidiLive ? 'MIDI đang điều khiển Kontakt; bấm để thử nốt hoặc đổi cổng' : 'Kết nối Kontakt Standalone trên Windows'"
          @click="openMidiConnector" :aria-label="kontaktMidiLive ? 'Kontakt MIDI đang kết nối' : 'Kết nối Kontakt'">
          <i class="fas fa-plug" aria-hidden="true"></i>
          <span>{{ kontaktMidiLive ? 'Kontakt MIDI' : 'Kết nối Kontakt' }}</span>
        </button>
        <button v-if="hasNativeVst3Scanner" type="button" class="mx-kontakt-live-action"
          title="VST3/WASAPI: thử phát toàn bộ MIDI trên một track"
          @click="showVst3Browser=true">
          <i class="fas fa-puzzle-piece" aria-hidden="true"></i>
          <span>Nhạc cụ VST3</span>
        </button>
        <!-- 单曲循环 -->
        <button @click="repeat = !repeat" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-[rgba(255,255,255,0.5)] shadow-glass-light transition-all duration-300 hover:-translate-y-px hover:shadow-glass-hover-light active:translate-y-0 dark:shadow-none"
          :class="repeat
            ? 'bg-primary-500/25 border-primary-500/30 text-primary-500 dark:bg-primary-500/20 dark:border-primary-500/30 dark:text-[#6fa9ff]'
            : 'bg-[rgba(255,255,255,0.4)] text-[#191c1e] dark:bg-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] dark:text-white/85 hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.5)] active:bg-[rgba(255,255,255,0.3)] dark:hover:bg-[rgba(255,255,255,0.15)] dark:hover:border-[rgba(255,255,255,0.15)] dark:active:bg-[rgba(255,255,255,0.08)]'">
          <i class="fas fa-redo text-[0.6rem]"></i>
        </button>
        <!-- 播放控制 -->
        <button @click="stop" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.4)] shadow-glass-light text-[#191c1e] dark:bg-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] dark:text-white/85 dark:shadow-none transition-all duration-300 hover:-translate-y-px hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.5)] hover:shadow-glass-hover-light active:translate-y-0 active:bg-[rgba(255,255,255,0.3)] dark:hover:bg-[rgba(255,255,255,0.15)] dark:hover:border-[rgba(255,255,255,0.15)] dark:active:bg-[rgba(255,255,255,0.08)]">
          <i class="fas fa-stop text-[0.6rem]"></i>
        </button>
        <button @click="togglePlay" class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border border-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.4)] shadow-glass-light text-[#191c1e] dark:bg-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] dark:text-white/85 dark:shadow-none transition-all duration-300 hover:-translate-y-px hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.5)] hover:shadow-glass-hover-light active:translate-y-0 active:bg-[rgba(255,255,255,0.3)] dark:hover:bg-[rgba(255,255,255,0.15)] dark:hover:border-[rgba(255,255,255,0.15)] dark:active:bg-[rgba(255,255,255,0.08)]">
          <i :class="playState === 'playing' ? 'fas fa-pause' : 'fas fa-play'" class="text-sm"></i>
        </button>
        <button @click="nextTrack" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.4)] shadow-glass-light text-[#191c1e] dark:bg-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] dark:text-white/85 dark:shadow-none transition-all duration-300 hover:-translate-y-px hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.5)] hover:shadow-glass-hover-light active:translate-y-0 active:bg-[rgba(255,255,255,0.3)] dark:hover:bg-[rgba(255,255,255,0.15)] dark:hover:border-[rgba(255,255,255,0.15)] dark:active:bg-[rgba(255,255,255,0.08)]">
          <i class="fas fa-step-forward text-[0.65rem]"></i>
        </button>
        <!-- 时间 -->
        <span class="text-xs text-black/40 dark:text-white/50 tabular-nums flex-shrink-0 ml-auto">{{ fmtTime(currentTime) }} / {{ fmtTime(duration) }}</span>

        <!-- 播放列表 popup 点击外部关闭的遮罩 -->
        <div v-if="showPlaylist" class="fixed inset-0 z-20" @click="showPlaylist = false"></div>
        <!-- 播放列表 popup -->
        <div v-if="showPlaylist" class="absolute left-3 bottom-full mb-2 w-[220px] max-h-[200px] glass-card p-2 flex flex-col overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-30">
          <div class="overflow-y-auto overlay-scroll flex flex-col gap-0.5">
            <div v-for="(t, i) in playlist" :key="i"
              class="flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors text-sm"
              :class="i === currentTrackIdx ? 'bg-primary-500/10 text-primary-500 font-medium' : 'text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5'"
              @click="loadTrack(i); showPlaylist = false"
            >
              <i class="fas fa-music text-[0.65rem] flex-shrink-0" :class="i === currentTrackIdx ? 'text-primary-500' : 'text-black/30 dark:text-white/30'"></i>
              <span class="flex-1 truncate">{{ t.name }}</span>
            </div>
          </div>
        </div>

      </div>
        </section> <!-- preview -->
        <div v-if="!isFullscreen && pianoRollPart" class="mx-roll-divider" role="separator" aria-orientation="horizontal" title="Kéo lên/xuống để chỉnh chiều cao Piano Roll" @pointerdown="beginPianoRollResize"></div>
        <MelorixPianoRoll v-if="!isFullscreen && pianoRollPart" :key="pianoRollPart.id" :style="{ height: pianoRollHeight + 'px' }"
          :part="pianoRollPart" :notes="pianoRollNotes" :pedal="pianoRollPedal" :duration="duration" :bpm="midiTempo"
          :disabled="exporting" :current-time="currentTime / speed" :playing="playState === 'playing'" @seek="seekFromPianoRoll" @change="updatePianoRollNotes" @pedal-change="updatePianoRollPedal" @audition-start="startPianoAudition" @audition-stop="stopPianoAudition" @chord-audition="startChordAudition" @close="pianoRollTrackId = null" />
      </div> <!-- workspace stage -->
      <aside v-if="!isFullscreen && isInspectorOpen" class="mx-inspector" aria-label="Thuộc tính MELORIX">
        <div class="mx-inspector-top"><i class="fas fa-sliders-h"></i> Cài đặt <span style="margin-left:auto;font-weight:400;color:#929eae">Thuộc tính</span>
          <button type="button" class="mx-side-close" aria-label="Đóng bảng thuộc tính" @click="isInspectorOpen = false"><i class="fas fa-times"></i></button>
        </div>
        <section class="mx-panel">
          <h3><i class="fas fa-fire mr-2" style="color:#ff9c45"></i>Hiệu ứng nốt rơi</h3>
          <label class="mx-field"><span>Kiểu hiệu ứng</span><select v-model="noteEffect"><option value="smoke">Phát sáng + Hạt bụi</option><option value="diffuse">Hào quang lan tỏa</option></select></label>
          <label class="mx-field"><span>Màu nhấn nốt</span><input type="color" v-model="noteActiveColor"></label>
          <label class="mx-field"><span>Độ sáng {{ noteGlow }}</span><input type="range" min="0" max="240" v-model.number="noteGlow"></label>
          <label class="mx-field"><span>Độ đậm {{ noteOpacity }}%</span><input type="range" min="10" max="100" v-model.number="noteOpacity"></label>
          <label class="mx-field"><span>Velocity</span><select v-model="velocityMode"><option value="off">Tắt</option><option value="natural">Tự nhiên</option><option value="expressive">Nổi bật</option></select></label>
          <label class="mx-field"><span>Phản ứng {{ velocitySensitivity }}%</span><input type="range" min="0" max="100" step="5" v-model.number="velocitySensitivity" :disabled="velocityMode === 'off'"></label>
          <div class="mx-panel-actions"><button type="button" @click="showBgSettings = true">Điều chỉnh nâng cao</button></div>
        </section>
        <section class="mx-panel">
          <h3><i class="fas fa-keyboard mr-2" style="color:#ff9c45"></i>Bàn phím Piano</h3>
          <label class="mx-field"><span>Màu phím sáng</span><input type="color" v-model="pianoActiveColor"></label>
          <label class="mx-field"><span>Độ sáng {{ pianoGlow }}</span><input type="range" min="0" max="240" v-model.number="pianoGlow"></label>
          <label class="mx-field"><span>Độ đậm {{ pianoOpacity }}%</span><input type="range" min="10" max="100" v-model.number="pianoOpacity"></label>
          <div class="mx-panel-actions"><button type="button" @click="showPianoSettings = true">Thiết lập bàn phím</button></div>
        </section>
        <section class="mx-panel">
          <h3><i class="fas fa-image mr-2" style="color:#ff9c45"></i>Cảnh nền</h3>
          <div class="mx-panel-actions">
            <button v-for="preset in bgPresets" :key="preset.url" type="button" @click="applyBgPreset(preset)">{{ preset.type === 'video' ? 'Sóng biển' : 'Bầu trời sao' }}</button>
            <label>Chọn ảnh / video<input class="hidden" type="file" accept="image/*,video/*" @change="handleBgUpload"></label>
            <button type="button" @click="clearBg">Xóa nền</button>
          </div>
        </section>
        <section class="mx-panel">
          <h3><i class="fas fa-video mr-2" style="color:#ff9c45"></i>Máy quay và khung hình</h3>
          <label class="mx-field"><span>Tỉ lệ khung</span><select v-model="videoFormat"><option value="landscape">Ngang 16:9</option><option value="portrait">Dọc 9:16</option></select></label>
          <label v-if="videoFormat === 'portrait'" class="mx-field"><span>Dải phím</span><select v-model="portraitKeyboard"><option value="auto">Tự động</option><option value="24">C1–B4</option><option value="36">C2–B5</option><option value="48">C3–B6</option><option value="60">C4–B7</option><option value="all">Toàn bộ</option></select></label>
          <div class="mx-panel-muted">{{ formatDimensions.width }} × {{ formatDimensions.height }} · 30 FPS</div>
          <div class="mx-panel-actions" style="margin-top:9px"><button type="button" @click="showExport = true">Thiết lập xuất MP4</button></div>
        </section>
        <section class="mx-panel">
          <h3><i class="fas fa-folder-open mr-2" style="color:#ff9c45"></i>Thông tin dự án</h3>
          <p class="mx-panel-muted">{{ currentTrack?.name || 'Chưa chọn' }} · {{ midiParts.length }} track · {{ notes.length }} nốt · {{ fmtTime(duration) }}</p>
        </section>
      </aside>
    </div> <!-- workspace -->

    <MelorixMidiConnector v-if="showMidiConnector" :playing="playState === 'playing'"
       @kontakt-enabled="activateKontaktOnly" @close="showMidiConnector = false" />
     <MelorixVst3Browser v-if="showVst3Browser" :playing="playState === 'playing'"
       :tracks="midiParts.map(part=>({id:part.id,label:part.name}))"
       @bindings-change="onVst3BindingsChanged" @live-change="onVst3LiveChanged" @diagnostic-change="onVst3DiagnosticChange"
       @close="showVst3Browser=false" />
    <MelorixPublishedLibrary v-if="showPublishedLibrary" @close="showPublishedLibrary=false" />
    <MelorixKontaktAudioCapture :key="captureSession" :open="showKontaktAudioCapture"
     :playing="playState === 'playing'" :busy="exporting" :can-play="notes.length > 0"
     @close="showKontaktAudioCapture=false" @audio-ready="setKontaktAudio"
     @record-started="startKontaktAudioPlayback" @record-stopped="stopKontaktAudioPlayback" />
    <MelorixKontaktTrackRouter v-if="showKontaktRouter" :parts="midiParts" :routes="kontaktTrackChannels"
     :labels="kontaktTrackNames" :playing="playState === 'playing'"
     @close="showKontaktRouter=false" @auto="autoAssignKontaktTracks" @channel="setKontaktTrackChannel" @label="setKontaktTrackName" />
    <!-- Central instrument control panel: no forms inside the narrow sidebar -->
    <Teleport to="body">
      <div v-if="isControlPanelOpen" class="mx-editor-overlay" @click.self="closeControlPanel">
        <section ref="instrumentPanelRef" class="mx-editor-dialog" role="dialog" aria-modal="true"
          aria-labelledby="mx-instrument-dialog-title" tabindex="-1">
          <header class="mx-editor-dialog-header">
            <div>
              <span class="mx-editor-dialog-eyebrow">MELORIX · Bảng điều khiển chỉnh sửa</span>
              <h2 id="mx-instrument-dialog-title">{{ controlPanelTitle }}</h2>
            </div>
            <button type="button" class="mx-editor-dialog-close" title="Đóng bảng điều khiển" aria-label="Đóng bảng điều khiển"
              :disabled="sampleImportBusy" @click="closeControlPanel"><i class="fas fa-times"></i></button>
          </header>
          <div class="mx-editor-dialog-body">
        <form v-if="sampleImportOpen" class="mx-track-ui-preview mx-track-add-form" @submit.prevent="importPersonalWav">
          <div class="mx-track-ui-preview-title"><i class="fas fa-file-audio"></i> Thêm nhạc cụ của tôi</div>
          <label>Tệp âm thanh (.wav)
            <input type="file" accept=".wav,audio/wav,audio/x-wav" aria-label="Chọn mẫu WAV của bạn" :disabled="sampleImportBusy || exporting" @change="onPersonalWavChoose">
          </label>
          <label>Tên nhạc cụ
            <input v-model="sampleImportName" type="text" maxlength="45" placeholder="Tên nhạc cụ của bạn">
          </label>
          <label>Cao độ gốc của WAV
            <select v-model.number="sampleImportRoot" aria-label="Cao độ gốc của WAV">
              <option v-for="m in [48,55,57,60,62,64,65,67,69,71,72,74,76,77,79,81,84]" :key="m" :value="m">{{ midiNoteName(m) }}</option>
            </select>
          </label>
          <p>Chọn nốt gốc đúng với mẫu thu âm. MELORIX thay đổi cao độ để phát các phím MIDI khác.</p>
          <p v-if="sampleImportError" role="alert" class="mx-instrument-import-error">{{ sampleImportError }}</p>
          <div class="mx-track-form-actions">
            <button type="submit" :disabled="sampleImportBusy || exporting">{{ sampleImportBusy ? 'Đang nạp…' : 'Thêm vào thư viện' }}</button>
            <button type="button" @click="sampleImportOpen=false">Hủy</button>
          </div>
          <p>Đây là công cụ nhập WAV riêng, không liên quan đến Kontakt. Muốn dùng file .nki, mở trong Kontakt 8 thật và kết nối qua MIDI.</p>
        </form>
        <form v-if="trackComposerPreviewOpen" class="mx-track-ui-preview mx-track-add-form" @submit.prevent="createInstrumentTrack">
          <div class="mx-track-ui-preview-title"><i class="fas fa-plus-circle"></i> Tạo track nhạc cụ</div>
          <label>Tên track<input v-model="newTrackName" type="text" maxlength="60" placeholder="Nhạc cụ mới" aria-label="Tên track mới"></label>
          <label>Chọn nhạc cụ
            <select v-model="newTrackPreset" aria-label="Chọn âm sắc cho track mới">
              <option v-for="item in allInstruments" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
          </label>
          <div class="mx-track-form-actions">
            <button type="submit" :disabled="exporting"><i class="fas fa-plus"></i> Tạo và mở Piano Roll</button>
            <button type="button" @click="trackComposerPreviewOpen = false">Hủy</button>
          </div>
          <p v-if="catalogLoadError" role="status">{{ catalogLoadError }}</p>
          <p v-if="newTrackPreset==='library:erhu-hmoob-nplog' && erhuWebReady">Đã cài 7 mẫu WAV Erhu thật trên trình duyệt. Cách chơi có thể khác Kontakt NKI.</p>
           <p v-else-if="isPublishedTrackInstrument(newTrackPreset)">Tiếng web sử dụng mẫu General MIDI thay thế nếu chưa nạp WAV/NKI gốc, không phải Kontakt.</p>
        </form>

            <form v-if="activeEditorPanel==='instrument' && instrumentPreviewTrackId!==null" class="mx-track-ui-preview mx-track-add-form mx-instrument-select-form" @submit.prevent="applyInstrumentSelection">
              <label>Chọn track MIDI
                <select :value="instrumentPreviewTrackId" :disabled="exporting" aria-label="Chọn track cần sửa" @change="changeInstrumentTarget">
                  <option v-for="part in midiParts" :key="part.id" :value="part.id">{{ part.name }} — {{ part.instrument }}</option>
                </select>
              </label>
              <label>Chọn tiếng nhạc cụ
                <select v-model="instrumentEditorPreset" :disabled="exporting" aria-label="Nhạc cụ cho track hiện tại">
                  <option v-for="item in allInstruments" :key="item.id" :value="item.id">{{ item.label }}</option>
                </select>
              </label>
              <p>Chỉ đổi tiếng của track đã chọn, không thay đổi các nốt MIDI hoặc track khác.</p>
              <div class="mx-track-form-actions">
                <button type="submit" :disabled="exporting">Áp dụng nhạc cụ</button>
                <button type="button" @click="closeControlPanel">Hủy</button>
              </div>
              <p v-if="isPublishedTrackInstrument(instrumentEditorPreset)">Tiếng web dùng mẫu General MIDI thay thế nếu chưa có WAV gốc, không phải Kontakt NKI.</p>
            </form>
          </div>
        </section>
      </div>
    </Teleport>

    <!-- 隐藏视频元素用于背景渲染 -->
    <video v-if="bgMedia?.type === 'video'" ref="bgMediaEl" :src="bgMedia.url" loop muted autoplay playsinline style="position:fixed;top:-9999px;left:-9999px;pointer-events:none"></video>
  </div>
</template>
