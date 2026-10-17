<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Midi } from '@tonejs/midi'
import { extractMidiParts, filterMidiParts } from '@/util/midi-tracks'
import type { MidiNoteEvent, MidiPart } from '@/util/midi-tracks'
import { portraitKeyboardRange, videoDimensions } from '@/util/video-format'
import { velocityVisualStrength, velocityParticleCount } from '@/util/velocity-effects'
import type { VelocityVisualMode } from '@/util/velocity-effects'
import type { VideoFormat, PortraitKeyboard } from '@/util/video-format'
import { SplendidGrandPiano, renderOffline } from 'smplr'
import Btn from '@/components/Btn.vue'
import Modal from '@/components/Model.vue'
import AppCheckbox from '@/components/AppCheckbox.vue'
import { Output, Mp4OutputFormat, BufferTarget, StreamTarget, VideoSampleSource, VideoSample, AudioSampleSource, AudioSample } from 'mediabunny'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// ---- 类型 ----
type NoteEvent = MidiNoteEvent

// ---- 状态 ----
const playState = ref<'idle' | 'playing' | 'paused'>('idle')
const currentTime = ref(0)
const speed = ref(1)
const allNotes = ref<NoteEvent[]>([])
const midiParts = ref<MidiPart[]>([])
const notes = computed(() => filterMidiParts(allNotes.value, midiParts.value))
const enabledPartCount = computed(() => midiParts.value.filter(part => part.enabled).length)
const trackRgbMap = computed(() => new Map(midiParts.value.map(part => [part.id, hexRgb(part.color)] as const)))
const showTrackPanel = ref(false)
const uploadError = ref('')
const noteRange = ref({ min: 21, max: 108 })
const videoFormat = ref<VideoFormat>('portrait')
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
    playlist.value.push({ name: `${t('piano.aiTranscriptionLabel')} ${name}`, file: url })
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
interface Track { name: string; file: string }
const playlist = ref<Track[]>([
  { name: 'Canon', file: '/midi/canon.mid' },
  { name: 'Kiss The Rain', file: '/midi/Kiss%20The%20Rain.mid' },
  { name: 'Rivers Flow In You', file: '/midi/Rivers%20Flow%20In%20You.mid' },
])
const currentTrackIdx = ref(0)
const showPlaylist = ref(false)

const currentTrack = computed(() => playlist.value[currentTrackIdx.value])
const repeat = ref(false)
const isFullscreen = ref(false)
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
const showExport = ref(false)
const exporting = ref(false)

const supportsFsApi = 'showSaveFilePicker' in window
const exportProgress = ref(0)
const exportEta = ref(0)   // 剩余秒数

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
  try {
    const { width: w, height: h, fps } = formatDimensions.value
    const totalFrames = Math.ceil(duration.value * fps)
    const fileName = `${currentTrack.value?.name || 'piano'}-${videoFormat.value === 'portrait' ? '9x16' : '16x9'}.mp4`

    // 选保存位置（支持时走流式写盘，省内存）
    let fileHandle: any = null
    let fileWriter: FileSystemWritableFileStream | null = null
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

    // 音频：smplr renderOffline（fetch 拦截后走本地采样）
    const result = await renderOffline(async (ctx) => {
      const safeStorage = { fetch: (url: string) => fetch(url.replace('#', '%23')) }
      const offPiano = SplendidGrandPiano(ctx, {
        volume: 100, baseUrl: '/samples/sfzinstruments-splendid-grand-piano/samples',
        storage: safeStorage as any,
        scheduler: { schedule(e: any, cb: any) { cb(e); return () => {} }, stop() {} },
      } as any)
      await offPiano.load
      for (const n of notes.value) {
        offPiano.start({ note: n.name, velocity: n.velocity * 127, time: n.time })
      }
    }, { duration: duration.value })
    const audioBuf = result.audioBuffer
    const sr = audioBuf.sampleRate

    // mediabunny output：流式写盘用 StreamTarget，否则用 BufferTarget
    const target: any = fileWriter
      ? new StreamTarget(new WritableStream<{ type: 'write', data: Uint8Array, position: number }>({
          write: async chunk => { await fileWriter!.write({ type: 'write', position: chunk.position, data: chunk.data } as any) },
        }))
      : new BufferTarget()
    const output = new Output({ format: new Mp4OutputFormat(fileWriter ? { fastStart: 'fragmented' } : { fastStart: 'in-memory' }), target })

    const vs = new VideoSampleSource({ codec: 'avc', bitrate: 8_000_000 })
    output.addVideoTrack(vs)
    const as = new AudioSampleSource({ codec: 'aac', bitrate: 128000 })
    output.addAudioTrack(as)
    await output.start()

    // 整段音频送入
    const fullSample = new AudioSample({ format: 'f32-planar', sampleRate: sr, numberOfFrames: audioBuf.length, numberOfChannels: 1, timestamp: 0, data: audioBuf.getChannelData(0) })
    await as.add(fullSample)
    fullSample.close(); as.close()

    // 离屏 canvas 渲染（独立于 DOM）+ 边渲边编码
    const offCanvas = document.createElement('canvas')
    const t0 = performance.now()
    for (let frame = 0; frame < totalFrames; frame++) {
      currentTime.value = frame / fps
      const t2 = currentTime.value / speed.value
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
      exportProgress.value = (frame + 1) / totalFrames
      const elapsed = (performance.now() - t0) / 1000
      exportEta.value = elapsed * (totalFrames - frame - 1) / (frame + 1)
    }
    vs.close()
    await output.finalize()

    if (fileWriter) {
      await fileWriter.close()
    } else {
      // BufferTarget：把 buffer 当下载
      const buf = (target as InstanceType<typeof BufferTarget>).buffer!
      const blob = new Blob([buf], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    }
  } catch (e) {
    console.error(e)
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
  void loadMidi(playlist.value[idx].file).then(ok => { if (ok) void play() })
}

function nextTrack() {
  const next = currentTrackIdx.value + 1
  loadTrack(next >= playlist.value.length ? 0 : next)
}

// ---- smplr 钢琴引擎（baseUrl 指向本地采样） ----
let pianoLoading = false

let initPianoPromise: Promise<void> | null = null
async function initPiano() {
  if (piano) return
  if (initPianoPromise) { await initPianoPromise; return }
  initPianoPromise = (async () => {
    const ctx = new AudioContext()
    // 自定义 storage：修复文件名中 # 被浏览器当 hash 截断的问题
    const safeStorage = { fetch: (url: string) => fetch(url.replace('#', '%23')) }
    piano = SplendidGrandPiano(ctx, {
      volume: 100,
      baseUrl: '/samples/sfzinstruments-splendid-grand-piano/samples',
      decayTime: 0.5,
      storage: safeStorage as any,
    })
    await piano.load
    audioCtx.value = ctx
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
  const parsed = extractMidiParts(midi)
  midiParts.value = parsed.parts
  allNotes.value = parsed.events
  duration.value = midi.duration || parsed.events.reduce((end, n) => Math.max(end, n.time + n.duration), 0)
  currentTime.value = 0
  playState.value = 'idle'
  lastScheduledIdx = 0
  keyState.value = {}
  updateNoteRange()
}
function resetAfterTrackChange() {
  // Audio is scheduled ahead of time; stop that schedule before changing a track mix.
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

// ---- 音频调度器（smplr） ----
let lastScheduledIdx = 0
const audioCtx = ref<AudioContext | null>(null)

function scheduleAll() {
  const ctx = audioCtx.value
  if (!piano || !ctx) return
  const targetTime = currentTime.value / speed.value
  for (let i = lastScheduledIdx; i < notes.value.length; i++) {
    const n = notes.value[i]
    if (n.time < targetTime - 0.02) { lastScheduledIdx = i + 1; continue }
    const delay = (n.time - targetTime) * speed.value
    const t = ctx.currentTime + Math.max(0.003, delay)
    piano.start({ note: n.name, velocity: n.velocity * 127, time: t })
  }
}

// ---- 播放控制 ----
async function play() {
  if (!notes.value.length || pianoLoading) return
  if (playState.value === 'playing') return
  pianoLoading = true
  try {
    await initPiano()
    await audioCtx.value?.resume()
    lastScheduledIdx = 0; lastFrameTime = performance.now()
    scheduleAll()
    playState.value = 'playing'
  } finally { pianoLoading = false }
}

function resetPiano() {
  piano?.stop(); piano = null
  audioCtx.value?.close(); audioCtx.value = null
  pianoLoaded.value = false; initPianoPromise = null
}

function pause() { playState.value = 'paused'; audioCtx.value?.suspend(); piano?.stop() }
function stop() {
  playState.value = 'idle'; currentTime.value = 0
  lastScheduledIdx = 0; pianoLoading = false
  resetPiano(); initPiano()
}
function togglePlay() { playState.value === 'playing' ? pause() : play() }

// ---- Canvas 渲染 ----
function draw(targetCanvas?: HTMLCanvasElement, targetW?: number, targetH?: number) {
  const canvas = targetCanvas || canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  let cw: number, ch: number
  if (targetCanvas && targetW && targetH) {
    // 离屏导出：固定尺寸，1:1 像素，不缩放
    canvas.width = targetW; canvas.height = targetH
    cw = targetW; ch = targetH
  } else {
    canvas.width = canvas.offsetWidth * devicePixelRatio
    canvas.height = canvas.offsetHeight * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    cw = canvas.width / devicePixelRatio
    ch = canvas.height / devicePixelRatio
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
  for (const n of notes.value) {
    if (n.time <= targetTime && n.time > (latestPress[n.midi] || 0)) latestPress[n.midi] = n.time
  }
  // 白键
  const whiteKeysArr = getWhiteKeys(min, max)
  for (let i = 0; i < whiteKeysArr.length; i++) {
    const midi = whiteKeysArr[i]
    const x = i * keyW
    const active = keyState.value[midi]
    if (active) {
      const age = targetTime - (latestPress[midi] || 0)
      const pulse = Math.max(0, 1 - age / 0.3) * Math.exp(-age * 5)
      const c = pianoActiveColor.value
      const pr = parseInt(c.slice(1,3), 16), pg = parseInt(c.slice(3,5), 16), pb = parseInt(c.slice(5,7), 16)
      const a = pianoOpacity.value / 100
      ctx.fillStyle = `rgba(${pr},${pg},${pb},${a})`
      ctx.fillRect(x, notesAreaH, keyW - 1, actualPianoH)
      if (pulse > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.5})`
        ctx.fillRect(x, notesAreaH, keyW - 1, actualPianoH)
      }
      ctx.shadowColor = `rgba(${pr},${pg},${pb},${a + pulse * 0.5})`
      ctx.shadowBlur = pianoGlow.value + pulse * 40
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
      const age = targetTime - (latestPress[bMidi] || 0)
      const pulse = Math.max(0, 1 - age / 0.3) * Math.exp(-age * 5)
      const c = pianoBlackActiveColor.value
      const pr = parseInt(c.slice(1,3), 16), pg = parseInt(c.slice(3,5), 16), pb = parseInt(c.slice(5,7), 16)
      const a = pianoOpacity.value / 100
      ctx.fillStyle = `rgba(${pr},${pg},${pb},${a})`
      ctx.fillRect(x, notesAreaH, bw, bh)
      if (pulse > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.5})`
        ctx.fillRect(x, notesAreaH, bw, bh)
      }
      ctx.shadowColor = `rgba(${pr},${pg},${pb},${a + pulse * 0.5})`
      ctx.shadowBlur = Math.round(pianoGlow.value * 0.7) + pulse * 30
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
    currentTime.value += (performance.now() - lastFrameTime) / 1000
    if (currentTime.value >= duration.value) {
      if (repeat.value) { currentTime.value = 0; lastScheduledIdx = 0; piano?.stop(); scheduleAll() }
      else { nextTrack() }
    }
  }
  lastFrameTime = performance.now()
  draw()
  rafId = requestAnimationFrame(loop)
}
let lastFrameTime = performance.now()

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space') { e.preventDefault(); togglePlay() }
}

// ---- 生命周期 ----

onMounted(() => {
  initPiano()
  rafId = requestAnimationFrame(loop)
  // 预加载默认背景
  const def = bgPresets[0]
  const img = new Image(); img.src = def.url; bgImage.value = img
  if (playlist.value.length) loadMidi(playlist.value[0].file)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
  cancelAnimationFrame(rafId)
  resetPiano()
})

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
  <div :class="['w-full max-w-[1000px] mx-auto p-4 text-black/85 dark:text-white/90 flex flex-col max-xl:p-3.5 max-sm:p-2.5', isFullscreen ? '!max-w-none !w-full h-screen !p-0' : '']">
    <!-- 标题 -->
    <div v-if="!isFullscreen" class="text-center mb-4 flex-shrink-0">
      <h1 class="text-[1.6rem] font-semibold mb-[0.2rem] text-black/85 dark:text-white/95 flex items-center justify-center gap-2 max-xl:text-[1.4rem] max-sm:text-[1.3rem]">
        <i class="fas fa-music text-[1.4rem] text-primary-500"></i>
        {{ t('piano.title') }}
      </h1>
      <p class="text-sm text-black/60 dark:text-white/70 m-0 max-xl:text-[0.85rem]">{{ t('piano.subtitle') }}</p>
    </div>

    <!-- 设置区域 -->
    <div v-if="!isFullscreen" class="glass-card p-4 mb-4 flex-shrink-0 max-sm:p-3">
      <div class="flex items-center gap-3 flex-wrap justify-between">
        <div class="flex items-center gap-3 flex-wrap">
          <label v-if="!loadingMidi && !converting" class="inline-flex items-center gap-1.5 py-2 px-3.5 text-sm rounded-lg border border-black/15 dark:border-white/15 bg-white/50 dark:bg-white/[0.06] text-primary-500 cursor-pointer transition-all duration-200 hover:bg-primary-500/10 hover:border-primary-500/40 dark:hover:bg-primary-500/[0.1] max-sm:text-xs">
            <i class="fas fa-upload"></i>{{ t('piano.uploadMidiMusic') }}
            <input type="file" accept=".mid,.midi,audio/*" @change="onFileUpload" class="hidden">
          </label>
          <span v-else class="inline-flex items-center gap-1.5 py-2 px-3.5 text-sm rounded-lg border border-black/15 dark:border-white/15 bg-white/50 dark:bg-white/[0.06] text-primary-500">
            <i class="fas fa-spinner fa-spin"></i>{{ loadingMidi ? t('piano.loading') : t('piano.converting') }}
          </span>
          <Btn @click="showTrackPanel = !showTrackPanel" size="small" type="default">
             <i class="fas fa-layer-group"></i>{{ t('piano.trackMixer') }} ({{ midiParts.length }})
           </Btn>
           <Btn @click="showBgSettings = !showBgSettings" size="small" type="default">
            <i class="fas fa-music"></i>{{ t('piano.noteAreaSettings') }}
          </Btn>
          <Btn @click="showPianoSettings = !showPianoSettings" size="small" type="default">
            <svg class="w-4 h-4 inline-block" viewBox="0 0 16 12"><rect x="0" y="0" width="3.5" height="12" rx="0.5" fill="currentColor" opacity="0.9"/><rect x="3.5" y="0" width="2" height="7" rx="0.3" fill="currentColor" opacity="0.3"/><rect x="4" y="0" width="3.5" height="12" rx="0.5" fill="currentColor" opacity="0.9"/><rect x="8" y="0" width="3.5" height="12" rx="0.5" fill="currentColor" opacity="0.9"/><rect x="11.5" y="0" width="2" height="7" rx="0.3" fill="currentColor" opacity="0.3"/><rect x="12" y="0" width="3.5" height="12" rx="0.5" fill="currentColor" opacity="0.9"/></svg> {{ t('piano.pianoAreaSettings') }}
          </Btn>
          <Btn @click="showOtherSettings = !showOtherSettings" size="small" type="default">
            <i class="fas fa-cog"></i>{{ t('piano.otherSettings') }}
          </Btn>
        </div>
        <div class="flex items-center gap-3">
          <Btn @click="toggleFullscreen" size="small" type="default">
            <i :class="isFullscreen ? 'fas fa-compress' : 'fas fa-expand'"></i>
          </Btn>
          <Btn @click="showExport = true" size="small" type="default" :status="exporting ? 'loading' : 'normal'">
            <i :class="exporting ? 'fas fa-spinner fa-spin' : 'fas fa-video'"></i>
            {{ exporting ? t('piano.exporting') : t('piano.exportVideo') }}
          </Btn>
        </div>
      </div>
    </div>

    <div v-if="!isFullscreen && uploadError" role="alert" class="rounded-lg px-4 py-3 mb-3 text-sm bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200 flex items-center justify-between gap-3">
      <span>{{ uploadError }}</span>
      <button type="button" class="underline font-semibold" @click="uploadError = ''">{{ t('piano.dismissError') }}</button>
    </div>
    <!-- MIDI tracks from Cakewalk, NeuralNote or Tsumugi. All rendering, playback and export share notes. -->
    <section v-if="!isFullscreen && showTrackPanel" class="glass-card p-4 mb-4" :aria-label="t('piano.trackMixer')">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 class="font-semibold text-base">{{ t('piano.trackMixer') }}</h2>
          <p class="text-xs opacity-65">{{ t('piano.trackMixerHelp') }}</p>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="opacity-70">{{ enabledPartCount }}/{{ midiParts.length }}</span>
          <button type="button" :disabled="exporting" class="px-3 py-1.5 rounded-lg border border-black/15 dark:border-white/20 hover:bg-primary-500/10 disabled:opacity-40" @click="setAllParts(true)">{{ t('piano.enableAllTracks') }}</button>
          <button type="button" :disabled="exporting" class="px-3 py-1.5 rounded-lg border border-black/15 dark:border-white/20 hover:bg-primary-500/10 disabled:opacity-40" @click="setAllParts(false)">{{ t('piano.disableAllTracks') }}</button>
        </div>
      </div>
      <p v-if="midiParts.length === 0" class="text-sm opacity-70">{{ t('piano.noMidiTracks') }}</p>
      <p v-else-if="enabledPartCount === 0" class="text-sm text-amber-600 dark:text-amber-300 mb-2" role="status">{{ t('piano.noActiveTrack') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto">
        <div v-for="part in midiParts" :key="part.id" class="flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/15 bg-white/40 dark:bg-white/5 px-3 py-2">
          <input type="checkbox" :checked="part.enabled" :disabled="exporting" @change="onPartToggle(part.id, $event)" :aria-label="part.name" class="accent-primary-500 w-4 h-4">
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium" :title="part.name">{{ part.name }}</div>
            <div class="text-xs opacity-60">{{ part.noteCount }} {{ t('piano.noteCount') }} · MIDI #{{ part.id + 1 }}</div>
          </div>
          <input type="color" :value="part.color" :disabled="exporting" @input="onPartColorInput(part.id, $event)" :aria-label="t('piano.trackColor') + ': ' + part.name" class="w-8 h-8 rounded border-0 bg-transparent cursor-pointer">
          <button type="button" :disabled="exporting" class="text-xs px-2.5 py-1.5 rounded-lg border border-black/15 dark:border-white/20 disabled:opacity-40" @click="soloPart(part.id)">{{ t('piano.soloTrack') }}</button>
        </div>
      </div>
    </section>

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
          <p class="text-xs text-black/60 dark:text-white/60 m-0">{{ t('piano.exportHint') }}</p>
          <Btn @click="exportVideo" type="primary">
            <i class="fas fa-download"></i>
            {{ t('piano.startExport') }}
          </Btn>
        </template>
        <template v-else>
          <p class="text-sm text-black/70 dark:text-white/80 m-0 flex items-center gap-2">
            <i class="fas fa-spinner fa-spin text-primary-500"></i>
            <span>{{ t('piano.exporting') }}</span>
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

    <p v-if="!isFullscreen" class="text-xs opacity-65 text-center mb-2">{{ videoFormat === 'portrait' ? t('piano.portraitFormat') : t('piano.landscapeFormat') }} · {{ formatDimensions.width }} × {{ formatDimensions.height }} · 30 FPS</p>
    <!-- 展示区域 -->
    <div :class="['glass-card overflow-hidden flex-1 flex flex-col min-h-0 relative', isFullscreen ? '!rounded-none !border-0' : '']">
      <canvas ref="canvasRef" class="block bg-black/95 dark:bg-black mx-auto"
        :class="isFullscreen && videoFormat === 'landscape' ? 'flex-1 w-full' : 'flex-shrink-0'"
        :style="videoFormat === 'portrait'
          ? { aspectRatio: '9 / 16', width: isFullscreen ? 'min(100%, 50.625vh)' : 'min(100%, 414px)', height: 'auto' }
          : (isFullscreen ? {} : { width: '100%', height: CANVAS_H + 'px' })"></canvas>

      <!-- 进度条 -->
      <div v-show="!(isFullscreen && hideControlsInFullscreen)" class="h-1.5 bg-black/10 dark:bg-white/[0.06] flex-shrink-0">
        <div class="h-full bg-primary-500/80" :style="{ width: progressPct + '%' }"></div>
      </div>

      <!-- 底部控制栏 -->
      <div v-show="!(isFullscreen && hideControlsInFullscreen)" class="flex items-center gap-3 px-4 py-2.5 bg-white/5 dark:bg-white/[0.02] flex-shrink-0 relative">
        <!-- 播放列表按钮 -->
        <button @click="showPlaylist = !showPlaylist" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border border-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.4)] shadow-glass-light text-[#191c1e] dark:bg-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] dark:text-white/85 dark:shadow-none transition-all duration-300 hover:-translate-y-px hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.5)] hover:shadow-glass-hover-light active:translate-y-0 active:bg-[rgba(255,255,255,0.3)] dark:hover:bg-[rgba(255,255,255,0.15)] dark:hover:border-[rgba(255,255,255,0.15)] dark:active:bg-[rgba(255,255,255,0.08)]">
          <i class="fas fa-list text-xs"></i>
        </button>
        <!-- 当前曲目 -->
        <span class="text-xs text-black/50 dark:text-white/50 truncate flex-1 min-w-0">{{ currentTrack?.name || '--' }}</span>
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
    </div>
    <!-- 隐藏视频元素用于背景渲染 -->
    <video v-if="bgMedia?.type === 'video'" ref="bgMediaEl" :src="bgMedia.url" loop muted autoplay playsinline style="position:fixed;top:-9999px;left:-9999px;pointer-events:none"></video>
  </div>
</template>
