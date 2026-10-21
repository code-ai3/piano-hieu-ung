import {makeInstrumentTrack,INSTRUMENT_PRESETS} from './melorix-instruments'
import {TRACK_COLORS} from './midi-tracks'
import type {MidiPart} from './midi-tracks'

export interface NativeInstrumentRequest {pluginPath:string;pluginName:string;name:string;count:number}
export interface BoundNativeInstrument {part:MidiPart;pluginPath:string}
export type NativeBinder={bindVst3Track:(id:number,path:string)=>Promise<unknown>;unbindVst3Track:(id:number)=>Promise<unknown>}

// Bind first, then publish all new track rows as one update. A failed plugin
// instance rolls back every new LOAD so the UI never promises an unbound track.
export async function prepareInstrumentTracks(parts:readonly MidiPart[],request:NativeInstrumentRequest,api:NativeBinder,reservedIds:readonly number[]=[]):Promise<BoundNativeInstrument[]>{
 if(!Number.isInteger(request.count)||request.count<1||request.count>4)throw Error('Số track cần từ 1 đến 4')
 if(!request.pluginPath||!request.pluginName||request.pluginName.length>150)throw Error('Plugin VST3 không hợp lệ')
 const pending:BoundNativeInstrument[]=[]
 const used=new Set([...parts.map(p=>p.id),...reservedIds])
 for(let i=0;i<request.count;i++){
  const proposed=makeInstrumentTrack([...parts,...pending.map(item=>item.part)],
   INSTRUMENT_PRESETS[0].id,
   request.name?(request.count>1?request.name+' '+(i+1):request.name):request.pluginName,
   TRACK_COLORS[(parts.length+i)%TRACK_COLORS.length])
  proposed.id=Math.max(-1,...used)+1
  used.add(proposed.id)
  proposed.instrument=request.pluginName
  pending.push({part:proposed,pluginPath:request.pluginPath})
 }
 const bound:number[]=[]
 try{
  for(const item of pending){
   const result=await api.bindVst3Track(item.part.id,item.pluginPath)
   // The native host replies {ok:true,componentInitialized:true}; never
   // label this a working instrument if the plugin rejected initialization.
   if(!result||typeof result!=='object'||(result as {ok?:boolean;componentInitialized?:boolean}).ok!==true||
      (result as {componentInitialized?:boolean}).componentInitialized!==true)
     throw Error('Plugin VST3 không xác nhận đã khởi tạo')
   bound.push(item.part.id)
  }
  return pending
 }catch(error){
  for(const id of bound.reverse()){
   try{await api.unbindVst3Track(id)}catch{}
  }
  throw error
 }
}
