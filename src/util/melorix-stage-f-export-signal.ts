// Stage F: deterministic safety checks on fully rendered PCM.
// Does NOT amplify quiet audio. Applies uniform attenuation only if peak
// would exceed a safe headroom, preserving relative dynamics and stereo.
export type ExportAudioStats={
 peakBefore:number
 peakAfter:number
 gain:number
 invalidSamples:number
 samplesOverFullScale:number
 durationSeconds:number
}
export function prepareExportAudio(
 audio:Pick<AudioBuffer,'numberOfChannels'|'length'|'sampleRate'|'getChannelData'>,
 headroom=0.98
):ExportAudioStats{
 if(!Number.isFinite(headroom)||headroom<=0||headroom>1)throw Error('Export headroom must be 0–1')
 if(!Number.isInteger(audio.numberOfChannels)||audio.numberOfChannels<1||audio.numberOfChannels>8||
   !Number.isFinite(audio.sampleRate)||audio.sampleRate<=0||
   !Number.isInteger(audio.length)||audio.length<1)throw Error('Bộ đệm âm thanh xuất không hợp lệ')
 let peak=0,invalid=0,over=0
 for(let channel=0;channel<audio.numberOfChannels;channel++){
  const data=audio.getChannelData(channel)
  if(data.length!==audio.length)throw Error('Độ dài kênh âm thanh xuất không khớp')
  for(let i=0;i<data.length;i++){
   const v=data[i]
   if(!Number.isFinite(v)){data[i]=0;invalid++;continue}
   const magnitude=Math.abs(v)
   if(magnitude>peak)peak=magnitude
   if(magnitude>=1)over++
  }
 }
 // A source can contain notes yet render absolute silence due to missing
 // samples or Mute/Volume=0; report it rather than exporting a broken MP4.
 if(peak<.00001)throw Error('Không có tín hiệu âm thanh trong bản phối. Kiểm tra Mute, Volume và nhạc cụ của từng track trước khi xuất.')
 const gain=peak>headroom?headroom/peak:1
 if(gain<1)for(let channel=0;channel<audio.numberOfChannels;channel++){
  const data=audio.getChannelData(channel)
  for(let i=0;i<data.length;i++)data[i]*=gain
 }
 return {peakBefore:peak,peakAfter:peak*gain,gain,invalidSamples:invalid,
  samplesOverFullScale:over,durationSeconds:audio.length/audio.sampleRate}
}
// Video timestamps are frame/fps (starting at 0) and audio begins at 0.
// Rendered audio must cover the requested musical window, within one sample.
// Video may contain at most one extra fractional frame on the end.
export function verifyExportSync(audioSeconds:number,musicalSeconds:number,fps:number):{frameCount:number;videoSeconds:number;driftSeconds:number}{
 if(!Number.isFinite(audioSeconds)||!Number.isFinite(musicalSeconds)||!Number.isFinite(fps)||
  audioSeconds<=0||musicalSeconds<=0||fps<=0)throw Error('Thời lượng xuất không hợp lệ')
 const frameCount=Math.ceil(musicalSeconds*fps)
 const videoSeconds=frameCount/fps
 const driftSeconds=videoSeconds-audioSeconds
 if(Math.abs(audioSeconds-musicalSeconds)>0.02||driftSeconds < -0.02||driftSeconds>1/fps+.02)
  throw Error('Lệch thời gian giữa âm thanh và khung hình MP4. Hủy xuất để tránh video sai đồng bộ.')
 return {frameCount,videoSeconds,driftSeconds}
}
