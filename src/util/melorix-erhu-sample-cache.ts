// Locally cached original Erhu WAVs. Does not parse Kontakt NKI and never uploads samples.
export type WebSample = { rootMidi: number; bytes: ArrayBuffer }
export type SampleBank = { id: string; samples: WebSample[] }
const ROOTS:Record<string,number>={G:67,A:69,B:71,C:72,D:74,E:76,F:77}
export function erhuRoot(name:string):number|null{
 const note=/^([A-G])\.wav$/i.exec(name)?.[1].toUpperCase()
 return note ? ROOTS[note] : null
}
export function nearestErhuSample(target:number,roots:readonly number[]):number|null{
 if(!Number.isFinite(target))return null
 const valid=roots.filter(root=>Number.isInteger(root)&&root>=0&&root<=127)
 return valid.length?[...valid].sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||a-b)[0]:null
}
export function validateErhuSamples(files:readonly Pick<File,'name'|'size'>[]):string|null{
 if(files.length!==7)return 'Cần đủ 7 tệp A.wav đến G.wav.'
 const used=new Set<number>();let total=0
 for(const file of files){
  const midi=erhuRoot(file.name)
  if(midi===null||used.has(midi))return 'Tên file WAV sai hoặc bị trùng.'
  if(file.size<44||file.size>25*1024*1024)return 'File WAV không hợp lệ hoặc quá 25MB.'
  used.add(midi);total+=file.size
 }
 return total>96*1024*1024?'Bộ mẫu vượt giới hạn 96MB.':null
}
function openStore():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('IndexedDB unavailable'));return}
  const req=indexedDB.open('melorix-local-samples-v1',1)
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('banks'))req.result.createObjectStore('banks',{keyPath:'id'})}
  req.onerror=()=>reject(req.error||Error('Storage unavailable'))
  req.onsuccess=()=>resolve(req.result)
 })
}
export async function storeErhuSamples(files:readonly File[]):Promise<void>{
 const error=validateErhuSamples(files)
 if(error)throw Error(error)
 const samples:WebSample[]=await Promise.all(files.map(async file=>({rootMidi:erhuRoot(file.name)!,bytes:await file.arrayBuffer()})))
 const db=await openStore()
 try{
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('banks','readwrite')
   tx.oncomplete=()=>resolve()
   tx.onerror=()=>reject(tx.error||Error('WAV save failed'))
   tx.onabort=()=>reject(tx.error||Error('WAV save aborted'))
   tx.objectStore('banks').put({id:'erhu-hmoob-nplog',samples} satisfies SampleBank)
  })
 }finally{db.close()}
}
export async function readErhuSamples():Promise<SampleBank|null>{
 const db=await openStore()
 try{
  return await new Promise((resolve,reject)=>{
   const req=db.transaction('banks','readonly').objectStore('banks').get('erhu-hmoob-nplog')
   req.onsuccess=()=>resolve(req.result??null)
   req.onerror=()=>reject(req.error||Error('WAV read failed'))
  })
 }finally{db.close()}
}
