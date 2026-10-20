import {availableMidiOutputs,sendMidiNote,midiNoteOn,midiNoteOff,midiControlChange,midiVolume,panicMidi} from './melorix-web-midi'
import type {MidiAccessPort,MidiOutputPort} from './melorix-web-midi'

// A single optional Web MIDI output shared by the UI and the Piano Roll.
// No sysex, no Kontakt files or local filesystem access.
let access:MidiAccessPort|null=null
let output:MidiOutputPort|null=null
let selectedId=''
let status='Chưa kết nối MIDI ngoài.'
let playback=false
let externalOnly=false
let held:{note:number;channel:number;port:MidiOutputPort}[]=[]
const listeners=new Set<()=>void>()
function publish(){for(const listener of listeners)listener()}
function panic(){
 if(output)try{panicMidi(output)}catch(error){console.warn('MIDI panic:',error)}
 held=[]
}
function refreshPorts(){
 if(output&&(!access?.outputs.has(selectedId)||output.state==='disconnected')){
  panic();output=null;selectedId='';playback=false;externalOnly=false
  status='Cổng MIDI đã ngắt. Vui lòng chọn lại.'
 }
 publish()
}
export const midiBridge={
 get supported(){return typeof navigator!=='undefined'&&
  typeof (navigator as unknown as {requestMIDIAccess?:unknown}).requestMIDIAccess==='function'},
 get granted(){return access!==null},
 get outputs(){return access?availableMidiOutputs(access):[]},
 get connected(){return output!==null},
 get selectedId(){return selectedId},
 get status(){return status},
 get playbackEnabled(){return playback},
 get externalOnly(){return externalOnly&&output!==null},
 subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}},
 async requestAccess(){
  if(!window.isSecureContext){status='Web MIDI cần HTTPS.';publish();return}
  const browser=navigator as unknown as {requestMIDIAccess?:(o:{sysex:boolean})=>Promise<MidiAccessPort>}
  if(!browser.requestMIDIAccess){status='Web MIDI không hỗ trợ trong trình duyệt này. Hãy dùng Chrome/Edge Windows.';publish();return}
  try{
   if(access)access.onstatechange=null
   access=await browser.requestMIDIAccess({sysex:false})
   access.onstatechange=refreshPorts
   // Refresh native Windows MIDI output handles after requesting the port list.
   // Old MIDIPort objects may be stale when loopMIDI is restarted.
   if(selectedId){
    output=access.outputs.get(selectedId)??null
    if(!output||output.state==='disconnected'){
     output=null;selectedId='';playback=false;externalOnly=false
    }
   }
   status=midiBridge.outputs.length?'Đã cấp quyền MIDI. Hãy chọn cổng đầu ra.'
    :'Chưa có cổng MIDI đầu ra. Giai đoạn 2 sẽ thiết lập cổng ảo để Kontakt 8 nhận MIDI.'
  }catch(error){
   console.warn('Web MIDI permission:',error)
   status='Không được cấp quyền MIDI. Kiểm tra quyền trang web.'
  }
  publish()
 },
 selectPort(id:string){
  panic();output=null;selectedId='';playback=false;externalOnly=false
  if(id){
   const port=access?.outputs.get(id)
   if(port&&port.state!=='disconnected'){
    output=port;selectedId=id
    status='Đã chọn '+(port.name||'cổng MIDI')+'. Thử gửi nốt để xác nhận tín hiệu.'
   }else status='Cổng đã ngắt. Hãy tải lại danh sách.'
  }else status='Đã ngắt kết nối MIDI ngoài.'
  publish()
 },
 setPlayback(enabled:boolean){playback=enabled&&output!==null;if(!playback){externalOnly=false;panic()}publish()},
 setExternalOnly(enabled:boolean){externalOnly=enabled&&output!==null;if(externalOnly)playback=true;publish()},
 setChannelVolume(channel:number,percent:number){
  if(!output||!playback)return
  try{output.send(midiControlChange(7,midiVolume(percent),channel))}
  catch(error){console.warn('Kontakt CC7 volume:',error);status='Không gửi được Volume đến Kontakt.';publish()}
 },
 test(note:number,channel:number){
  if(!output)return
  try{
   sendMidiNote(output,note,100,channel,performance.now()+10,380)
   status='Đã gửi Note On/Off. Kiểm tra ứng dụng nhận MIDI.'
  }catch(error){console.warn('MIDI test send:',error);status='Không gửi được MIDI.'}
  publish()
 },
 auditionStart(notes:number[],channel:number){
  midiBridge.auditionStop()
  if(!output)return
  try{
   for(const note of notes){
    output.send(midiNoteOn(note,95,channel))
    held.push({note,channel,port:output})
   }
  }catch(error){console.warn('MIDI audition:',error);midiBridge.auditionStop()}
 },
 auditionStop(){
  const notes=held;held=[]
  for(const item of notes)try{item.port.send(midiNoteOff(item.note,item.channel))}catch{}
 },
 schedule(note:number,velocity:number,channel:number,delaySeconds:number,durationSeconds:number,clockMs=performance.now()){
  if(!output||!playback)return
  try{
   sendMidiNote(output,note,velocity,channel,clockMs+Math.max(0,delaySeconds)*1000,
    Math.max(.04,durationSeconds)*1000)
  }catch(error){
   console.warn('MIDI playback:',error)
   status='Gửi MIDI thất bại. Kiểm tra cổng.';midiBridge.setPlayback(false)
  }
 },
 stopAll(){panic()},
 disconnect(){midiBridge.selectPort('')},
 cleanup(){panic();if(access)access.onstatechange=null;access=null;output=null;playback=false;externalOnly=false;selectedId='';listeners.clear()}
}
