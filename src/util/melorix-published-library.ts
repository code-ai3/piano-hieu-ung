// Shared, owner-published catalog shipped with MELORIX deployments.
// Some large Kontakt sample libraries live in externally linked Drive folders.
// Browsers do not load NKI: Kontakt 8 must open these presets itself.
export type PublishedInstrumentFormat='nki'|'wav'|'nkm'
export type PublishedInstrumentDelivery='bundled'|'drive'
export interface PublishedInstrument {
 id:string
 label:string
 format:PublishedInstrumentFormat
 file:string
 license:string
 redistributionApproved:true
 delivery?:PublishedInstrumentDelivery
 sourceUrl?:string
 samplesUrl?:string
 family?:string
 rootMidi?:number
 description?:string
}
export interface InstrumentLibraryManifest {
 schemaVersion:1
 instruments:PublishedInstrument[]
}
const validId=(s:string)=>/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(s)
// Only one safe filename component; no slashes or path escapes.
const validName=(s:string)=>/^[A-Za-z0-9][A-Za-z0-9._ ()+#-]{0,119}$/.test(s)
const validDriveFile=(s:string)=>/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view$/.test(s)
const validDriveFolder=(s:string)=>/^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+$/.test(s)
export function validatePublishedInstrument(value:unknown):PublishedInstrument|null{
 if(!value||typeof value!=='object')return null
 const item=value as Record<string,unknown>
 if(typeof item.id!=='string'||!validId(item.id))return null
 if(typeof item.label!=='string'||!item.label.trim()||item.label.length>90)return null
 if(item.format!=='nki'&&item.format!=='wav'&&item.format!=='nkm')return null
 if(typeof item.file!=='string'||!validName(item.file)||!item.file.toLowerCase().endsWith('.'+item.format))return null
 if(typeof item.license!=='string'||!item.license.trim()||item.license.length>200)return null
 if(item.redistributionApproved!==true)return null
 if(item.format==='wav'&&(!Number.isInteger(item.rootMidi)||(item.rootMidi as number)<21||(item.rootMidi as number)>108))return null
 const delivery=item.delivery===undefined?'bundled':item.delivery
 if(delivery!=='bundled'&&delivery!=='drive')return null
 if(delivery==='drive'&&(item.format==='wav'||typeof item.sourceUrl!=='string'||!validDriveFile(item.sourceUrl)))return null
 if(delivery==='bundled'&&item.sourceUrl!==undefined)return null
 if(item.samplesUrl!==undefined&&(typeof item.samplesUrl!=='string'||!validDriveFolder(item.samplesUrl)))return null
 if(item.family!==undefined&&(typeof item.family!=='string'||item.family.length>70))return null
 return {
  id:item.id,label:item.label.trim(),format:item.format,file:item.file,
  license:item.license.trim(),redistributionApproved:true,delivery,
  ...(delivery==='drive'?{sourceUrl:item.sourceUrl as string}:{}),
  ...(typeof item.samplesUrl==='string'?{samplesUrl:item.samplesUrl}:{}),
  ...(typeof item.family==='string'?{family:item.family}:{}),
  ...(item.format==='wav'?{rootMidi:item.rootMidi as number}:{}),
  ...(typeof item.description==='string'?{description:item.description.slice(0,250)}:{})
 }
}
export function parsePublishedLibrary(value:unknown):PublishedInstrument[]{
 if(!value||typeof value!=='object')return []
 const manifest=value as Record<string,unknown>
 if(manifest.schemaVersion!==1||!Array.isArray(manifest.instruments))return []
 const seen=new Set<string>()
 const valid:PublishedInstrument[]=[]
 for(const entry of manifest.instruments.slice(0,300)){
  const item=validatePublishedInstrument(entry)
  if(!item||seen.has(item.id))continue
  seen.add(item.id)
  valid.push(item)
 }
 return valid
}
export function publishedInstrumentUrl(item:PublishedInstrument):string{
 if(item.delivery==='drive'&&item.sourceUrl)return item.sourceUrl
 return '/instruments/'+item.id+'/'+encodeURIComponent(item.file)
}
export async function loadPublishedLibrary():Promise<PublishedInstrument[]>{
 const response=await fetch('/instruments/catalog.json',{cache:'no-store'})
 if(!response.ok)throw new Error('Cannot load shared instrument library')
 return parsePublishedLibrary(await response.json())
}
