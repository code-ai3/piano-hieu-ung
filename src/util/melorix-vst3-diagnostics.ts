// MELORIX Stage 3D: local opt-in VST3/NKI audio diagnostic.
// Never store or upload plugin files, NKI paths, samples or PCM recordings.
// Technical MIDI acceptance is NOT evidence of audible licensed Kontakt.
export type NativeTrackState={track:number;componentInitialized:boolean;editorOpened?:boolean}
export type NativeTrackSnapshot={audioConnected:boolean;liveTrack?:number;tracks:NativeTrackState[]}
export type NativeQAPort={
 listVst3Tracks:()=>Promise<NativeTrackSnapshot>
 startLiveVst3Track:(track:number)=>Promise<unknown>
 sendLiveVst3Note:(track:number,pitch:number,velocity:number)=>Promise<unknown>
 stopLiveVst3:()=>Promise<unknown>
}
export type LocalVst3QaReport={
 track:number;loaded:boolean;editorOpened:boolean;pcmPeak:number|null;
 pcmNonzeroSamples:number|null;hasPcm:boolean;wasapiConnected:boolean;
 noteOnAccepted:boolean;noteOffAccepted:boolean;cleanStop:boolean;
 errors:string[];complete:boolean
}
const object=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'?v as Record<string,unknown>:null
const errorText=(v:unknown)=>v instanceof Error?v.message:String(v)
export async function diagnoseLocalVst3(
 api:NativeQAPort,track:number,
 audition:(id:number)=>Promise<{peak:number;nonzeroSamples:number}>,
 wait:(ms:number)=>Promise<void>=(ms)=>new Promise(resolve=>setTimeout(resolve,ms))
):Promise<LocalVst3QaReport>{
 const report:LocalVst3QaReport={
  track,loaded:false,editorOpened:false,pcmPeak:null,pcmNonzeroSamples:null,
  hasPcm:false,wasapiConnected:false,noteOnAccepted:false,
  noteOffAccepted:false,cleanStop:false,errors:[],complete:false
 }
 if(!Number.isSafeInteger(track)||track<0){report.errors.push('Track MIDI không hợp lệ');return report}
 let snapshot:NativeTrackSnapshot
 try{snapshot=await api.listVst3Tracks()}
 catch(e){report.errors.push('Không đọc được native VST3: '+errorText(e));return report}
 if(!Array.isArray(snapshot.tracks)){report.errors.push('Trạng thái native VST3 không hợp lệ');return report}
 const slot=snapshot.tracks.find(e=>e.track===track&&e.componentInitialized)
 if(!slot){report.errors.push('Track chưa nạp VST3 thành công');return report}
 report.loaded=true;report.editorOpened=!!slot.editorOpened
 if(snapshot.audioConnected){
  report.errors.push('Tắt WASAPI đang hoạt động trước khi chẩn đoán để không gián đoạn âm thanh')
  return report
 }
 try{
  const pcm=await audition(track)
  if(!Number.isFinite(pcm.peak)||!Number.isFinite(pcm.nonzeroSamples)||pcm.nonzeroSamples<0)
   throw Error('PCM VST3 không hợp lệ')
  report.pcmPeak=pcm.peak;report.pcmNonzeroSamples=pcm.nonzeroSamples
  report.hasPcm=pcm.peak>.001&&pcm.nonzeroSamples>0
  if(!report.hasPcm)report.errors.push('VST3 chưa có PCM: kiểm tra đã nạp NKI và âm lượng plugin')
  await wait(750)
 }catch(e){report.errors.push('Không render được PCM từ plugin: '+errorText(e))}
 let streamStarted=false,needsOff=false
 try{
  const live=object(await api.startLiveVst3Track(track))
  if(live?.ok!==true||live.audioConnected!==true||live.driver!=='wasapi-shared')
   throw Error('Native host chưa xác nhận WASAPI đã mở')
  streamStarted=true;report.wasapiConnected=true
  const on=object(await api.sendLiveVst3Note(track,60,100))
  if(on?.ok!==true||on.noteOn!==true||on.track!==track)throw Error('Lệnh Note On chưa được xác nhận')
  report.noteOnAccepted=true;needsOff=true
  await wait(450)
  const off=object(await api.sendLiveVst3Note(track,60,0))
  if(off?.ok!==true||off.noteOn!==false||off.track!==track)throw Error('Lệnh Note Off chưa được xác nhận')
  report.noteOffAccepted=true;needsOff=false
 }catch(e){report.errors.push('Kiểm tra WASAPI/MIDI: '+errorText(e))}
 finally{
  if(needsOff)try{
   const off=object(await api.sendLiveVst3Note(track,60,0))
   report.noteOffAccepted=off?.ok===true&&off.noteOn===false
  }catch(e){report.errors.push('Không gửi được Note Off dọn dẹp: '+errorText(e))}
  if(streamStarted)try{
   const stop=object(await api.stopLiveVst3())
   report.cleanStop=stop?.ok===true&&stop.audioConnected===false
   if(!report.cleanStop)report.errors.push('Không xác nhận được WASAPI đã dừng')
  }catch(e){report.errors.push('Không dừng được WASAPI: '+errorText(e))}
 }
 report.complete=report.loaded&&report.hasPcm&&report.wasapiConnected&&
  report.noteOnAccepted&&report.noteOffAccepted&&report.cleanStop&&report.errors.length===0
 return report
}
