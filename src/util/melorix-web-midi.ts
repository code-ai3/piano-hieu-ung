// Web MIDI helpers shared by MELORIX and deterministic unit tests.
// Channels are ZERO-based here (0-15); the track UI stores them as 1-16.
export function midiByte(value:number):number{
 return Number.isFinite(value)?Math.max(0,Math.min(127,Math.round(value))):0
}
export function midiChannel(value:number):number{
 return Number.isFinite(value)?Math.max(0,Math.min(15,Math.floor(value))):0
}
export function trackMidiChannel(trackChannel:number):number {
 return midiChannel(trackChannel-1)
}
export function midiNoteOn(note:number,velocity:number,channel:number):number[]{
 return [0x90|midiChannel(channel),midiByte(note),Math.max(1,midiByte(velocity))]
}
export function midiNoteOff(note:number,channel:number):number[]{
 return [0x80|midiChannel(channel),midiByte(note),0]
}
export function midiPanicMessages():number[][]{
 const messages:number[][]=[]
 for(let channel=0;channel<16;channel++){
  messages.push([0xb0|channel,64,0]) // sustain pedal off
  messages.push([0xb0|channel,123,0]) // all notes off
  messages.push([0xb0|channel,120,0]) // all sound off
 }
 return messages
}
export interface MidiOutputPort {
 id:string
 name?:string|null
 manufacturer?:string|null
 state?:string
 send(data:number[]|Uint8Array,timestamp?:number):void
 clear?():void
}
export interface MidiAccessPort {
 outputs:Map<string,MidiOutputPort>
 onstatechange:((event:Event)=>void)|null
}
export function availableMidiOutputs(access:MidiAccessPort):{id:string;label:string}[]{
 return Array.from(access.outputs.values()).filter(p=>p.state!=='disconnected').map((p,index)=>({
  id:p.id,label:p.name?.trim()||'Cổng MIDI '+(index+1)
 }))
}
export function sendMidiNote(port:MidiOutputPort,note:number,velocity:number,channel:number,startMs:number,lengthMs:number){
 const start=Math.max(0,startMs)
 const duration=Math.max(40,Number.isFinite(lengthMs)?lengthMs:250)
 port.send(midiNoteOn(note,velocity,channel),start)
 port.send(midiNoteOff(note,channel),start+duration)
}
export function panicMidi(port:MidiOutputPort){
 port.clear?.()
 for(const message of midiPanicMessages())port.send(message)
}
