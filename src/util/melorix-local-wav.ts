// Browser-only personal instrument import. The original WAV is never uploaded.
// One sample is transposed by semitone; multisampling / Kontakt articulation are
// deliberately left for a later phase.
export const LOCAL_WAV_LIMIT_BYTES=25*1024*1024
export type LocalInstrumentId = `user:${number}`
export type LocalSampleSpec = { id:LocalInstrumentId; label:string; rootMidi:number }
export function validLocalWavFile(name:string,size:number){
 return /\.wav$/i.test(name)&&Number.isFinite(size)&&size>44&&size<=LOCAL_WAV_LIMIT_BYTES
}
export function localWavLabel(name:string){
 return (name.replace(/\.wav$/i,'').trim().slice(0,45)||'Nhạc cụ cá nhân')
}
export function samplePitchRate(target:number,recorded:number){
 const midi=Math.max(21,Math.min(108,Math.round(Number.isFinite(target)?target:60)))
 const root=Math.max(21,Math.min(108,Math.round(Number.isFinite(recorded)?recorded:60)))
 return Math.pow(2,(midi-root)/12)
}
export function createLocalSampleSpec(n:number,name:string,rootMidi:number):LocalSampleSpec{
 return {id:`user:${Math.max(1,Math.round(n))}`,label:localWavLabel(name),rootMidi:Math.max(21,Math.min(108,Math.round(rootMidi)))}
}
