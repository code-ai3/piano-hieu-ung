// PCM16 WAV for WebAudio-only rendered MIDI mix. No proprietary encoder/network.
export function audioBufferToWav(buffer:Pick<AudioBuffer,'length'|'numberOfChannels'|'sampleRate'|'getChannelData'>):ArrayBuffer{
 const frames=buffer.length
 const channels=buffer.numberOfChannels
 if(!Number.isInteger(frames)||frames<0||channels<1||channels>2)throw Error('WAV chỉ hỗ trợ mono/stereo')
 if(!Number.isFinite(buffer.sampleRate)||buffer.sampleRate<8000||buffer.sampleRate>192000)throw Error('Sample rate không hợp lệ')
 const byteLength=frames*channels*2
 if(byteLength>0x7fffffff)throw Error('Tệp WAV quá lớn')
 const result=new ArrayBuffer(44+byteLength),view=new DataView(result)
 const str=(off:number,text:string)=>{for(let i=0;i<text.length;i++)view.setUint8(off+i,text.charCodeAt(i))}
 str(0,'RIFF');view.setUint32(4,36+byteLength,true);str(8,'WAVE')
 str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true)
 view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true)
 view.setUint32(28,buffer.sampleRate*channels*2,true)
 view.setUint16(32,channels*2,true);view.setUint16(34,16,true)
 str(36,'data');view.setUint32(40,byteLength,true)
 const data=Array.from({length:channels},(_,ch)=>buffer.getChannelData(ch))
 let offset=44
 for(let i=0;i<frames;i++)for(let ch=0;ch<channels;ch++){
  const value=data[ch][i]
  const amplitude=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0
  view.setInt16(offset,amplitude<0?Math.round(amplitude*32768):Math.round(amplitude*32767),true)
  offset+=2
 }
 return result
}
