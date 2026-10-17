// MELORIX Erhu Hmoob Nplog sample map, measured from the user's actual WAV files.
// WAVs stay on the user's device. No Kontakt files or copyrighted samples in the repository.
export const ERHU_ROOTS = { 'G.wav':67, 'A.wav':69, 'B.wav':71, 'C.wav':72, 'D.wav':74, 'E.wav':76, 'F.wav':77 } as const
export type ErhuSampleName=keyof typeof ERHU_ROOTS
export const ERHU_SAMPLE_NAMES=Object.keys(ERHU_ROOTS) as ErhuSampleName[]
export function erhuSampleFileName(name:string):ErhuSampleName|null {
 const plain=name.split(/[\\/]/).pop()||''
 const entry=ERHU_SAMPLE_NAMES.find(n=>n.toLowerCase()===plain.toLowerCase())
 return entry??null
}
export function validateErhuSampleNames(names:readonly string[]):{ok:boolean;missing:ErhuSampleName[];duplicates:string[];unknown:string[]}{
 const found=new Set<ErhuSampleName>(),duplicates:string[]=[],unknown:string[]=[]
 for(const name of names){
  const key=erhuSampleFileName(name)
  if(!key){unknown.push(name);continue}
  if(found.has(key))duplicates.push(name)
  found.add(key)
 }
 return {ok:found.size===ERHU_SAMPLE_NAMES.length&&!duplicates.length&&!unknown.length,
  missing:ERHU_SAMPLE_NAMES.filter(k=>!found.has(k)),duplicates,unknown}
}
const normalizedClass=(pitch:number)=>((Math.round(pitch)%12)+12)%12
// Favor a sample recorded at the exact pitch class, even if an octave away.
// For accidentals, prefer the closest sampled pitch class; ties favor
// a sample needing less actual pitch-shifting.
export function nearestErhuSample(midi:number):{name:ErhuSampleName;rootMidi:number;playbackRate:number}{
 const target=Number.isFinite(midi)?Math.round(midi):69
 let best:ErhuSampleName='A.wav',bestClassDistance=13,bestAbsoluteDistance=Infinity
 for(const name of ERHU_SAMPLE_NAMES){
  const recorded=ERHU_ROOTS[name],d=Math.abs(normalizedClass(target)-normalizedClass(recorded))
  const classDistance=Math.min(d,12-d),absoluteDistance=Math.abs(target-recorded)
  if(classDistance<bestClassDistance||(classDistance===bestClassDistance&&absoluteDistance<bestAbsoluteDistance)){
   best=name;bestClassDistance=classDistance;bestAbsoluteDistance=absoluteDistance
  }
 }
 const rootMidi=ERHU_ROOTS[best]
 return {name:best,rootMidi,playbackRate:Math.pow(2,(target-rootMidi)/12)}
}
