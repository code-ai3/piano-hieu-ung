// Kontakt NKI binary is not executable in a web browser.
// Recognize the Kontakt 4/5-era container and map separately provided WAV
// samples conservatively; the Kontakt zone/scripting engine is NOT decoded.
export interface KontaktNkiInspection { supportedContainer:boolean;name:string;format:string;note:string }
const ERHU_ROOTS:Readonly<Record<string,number>>={
 'g.wav':67,'a.wav':69,'b.wav':71,'c.wav':72,'d.wav':74,'e.wav':76,'f.wav':77
}
export function inspectKontaktNki(data:ArrayBuffer,fileName:string):KontaktNkiInspection{
 const bytes=new Uint8Array(data)
 const name=fileName.replace(/\.nki$/i,'').trim().slice(0,70)||'Kontakt'
 if(!/\.nki$/i.test(fileName))return {supportedContainer:false,name,format:'Không phải NKI',note:'Chọn tệp .nki'}
 if(bytes.length<96)return {supportedContainer:false,name,format:'Tệp NKI không hợp lệ',note:'Tệp không đầy đủ'}
 const text=new TextDecoder('latin1').decode(bytes.subarray(0,Math.min(bytes.length,1024*1024)))
 const recognized=text.includes('4KIN')&&text.includes('DSIN')
 return recognized?{
  supportedContainer:true,name,format:'Kontakt NKI nhị phân',
  note:'Đã nhận dạng cấu trúc tệp; không thể giải mã bản đồ vùng phím, hiệu ứng hoặc script gốc'
 }:{
  supportedContainer:false,name,format:'Phiên bản NKI chưa tương thích',
  note:'Cấu trúc không được nhận diện; có thể là phiên bản được nén/mã hóa'
 }
}
const MIDI_CLASSES:Readonly<Record<string,number>>={C:0,D:2,E:4,F:5,G:7,A:9,B:11}
export function inferKontaktWavRoot(nkiName:string,fileName:string):number|null{
 const name=(fileName.split(/[\\/]/).pop()||'').trim()
 if(/^erhu hmoob nplog\.nki$/i.test(nkiName)){
  const known=ERHU_ROOTS[name.toLowerCase()]
  if(known!==undefined)return known
 }
 const base=name.replace(/\.wav$/i,'')
 const m=base.match(/(?:^|[^a-z0-9])([A-Ga-g])([#b♯♭]?)(-?\d)(?=$|[^\d])/)
 if(!m)return null
 const offset=m[2]==='#'||m[2]==='♯'?1:m[2]==='b'||m[2]==='♭'?-1:0
 const midi=(Number(m[3])+1)*12+MIDI_CLASSES[m[1].toUpperCase()]+offset
 return midi>=21&&midi<=108?midi:null
}
export function kontaktImportCheck(roots:readonly (number|null)[],sampleCount:number):{ok:boolean;unmapped:number}{
 const unmapped=roots.filter(x=>x===null||!Number.isInteger(x)||x<21||x>108).length
 return {ok:sampleCount>0&&roots.length===sampleCount&&unmapped===0,unmapped}
}
export function closestKontaktSample<T extends {rootMidi:number}>(samples:readonly T[],midi:number):T|null{
 if(!samples.length)return null
 const cls=(v:number)=>((v%12)+12)%12
 const target=Math.round(midi)
 return samples.reduce((best,c)=>{
  const a=Math.abs(cls(c.rootMidi)-cls(target)),b=Math.abs(cls(best.rootMidi)-cls(target))
  const da=Math.min(a,12-a),db=Math.min(b,12-b)
  return da<db||(da===db&&Math.abs(c.rootMidi-target)<Math.abs(best.rootMidi-target))?c:best
 })
}
