import { Midi } from '@tonejs/midi'

export interface AudioToMidiOptions {
  onsetThresh?: number    // 起音阈值 0~1，默认 0.5
  frameThresh?: number    // 帧阈值 0~1，默认 0.3
  minNoteLen?: number     // 最短音符帧数，默认 5
  onProgress?: (p: number) => void  // 0~1
}

/**
 * 用 Spotify Basic Pitch 把音频文件转录为 MIDI 字节数组。
 * 输入：浏览器能 decodeAudioData 的任意音频（mp3/m4a/wav/ogg-vorbis/flac）。
 * 输出：Uint8Array（标准 MIDI 文件字节，可直接 download 或 Midi.fromUrl 加载）。
 */
export async function audioFileToMidi(file: File, options: AudioToMidiOptions = {}): Promise<Uint8Array> {
  const onsetThresh = options.onsetThresh ?? 0.5
  const frameThresh = options.frameThresh ?? 0.3
  const minNoteLen = options.minNoteLen ?? 5
  const onProgress = options.onProgress

  const [{ BasicPitch, outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime }, tf] = await Promise.all([
    import('@spotify/basic-pitch'),
    import('@tensorflow/tfjs-core'),
  ])
  await import('@tensorflow/tfjs-backend-webgl')  // 注册 WebGL 后端
  await tf.ready()
  const bp = new BasicPitch('/models/basic-pitch/model.json')

  // 解码并重采样到 22050Hz（basic-pitch 模型要求）
  const audioCtx = new AudioContext()
  const buf = await file.arrayBuffer()
  const rawBuffer = await audioCtx.decodeAudioData(buf)
  const offline = new OfflineAudioContext(1, Math.ceil(rawBuffer.duration * 22050), 22050)
  const src = offline.createBufferSource()
  src.buffer = rawBuffer
  src.connect(offline.destination)
  src.start()
  const audioBuffer = await offline.startRendering()
  audioCtx.close()

  const frames: number[][] = []; const onsets: number[][] = []; const contours: number[][] = []
  await bp.evaluateModel(
    audioBuffer,
    (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c) },
    (p: number) => { onProgress?.(p) },
  )

  const notesOut = noteFramesToTime(
    addPitchBendsToNoteEvents(contours,
      outputToNotesPoly(frames, onsets, onsetThresh, frameThresh, minNoteLen))
  )

  const midi = new Midi()
  const track = midi.addTrack()
  for (const n of notesOut) {
    if (n.pitchMidi == null) continue
    const vel = typeof n.amplitude === 'number' ? n.amplitude : 0.7
    track.addNote({ midi: n.pitchMidi, time: n.startTimeSeconds, duration: n.durationSeconds, velocity: vel })
  }
  return new Uint8Array(midi.toArray())
}
