// Static, globally published library. Files live with MELORIX builds, not in
// localStorage/IndexedDB, and are never created by an anonymous browser upload.
export type PublishedInstrumentFormat='nki'|'wav'
export interface PublishedInstrument {
 id:string
 label:string
 format:PublishedInstrumentFormat
 file:string
 license:string
 redistributionApproved:true
 rootMidi?:number
 description?:string
}
export interface InstrumentLibraryManifest {
 schemaVersion:1
 instruments:PublishedInstrument[]
}
const validId=(s:string)=>/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(s)
const validName=(s:string)=>/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(s)
export function validatePublishedInstrument(value:unknown):PublishedInstrument|null{
 if(!value||typeof value!=='object')return null
 const item=value as Record<string,unknown>
 if(typeof item.id!=='string'||!validId(item.id))return null
 if(typeof item.label!=='string'||!item.label.trim()||item.label.length>90)return null
 if(item.format!=='nki'&&item.format!=='wav')return null
 if(typeof item.file!=='string'||!validName(item.file)||!item.file.toLowerCase().endsWith('.'+item.format))return null
 if(typeof item.license!=='string'||!item.license.trim()||item.license.length>200)return null
 if(item.redistributionApproved!==true)return null
 if(item.format==='wav'&&(!Number.isInteger(item.rootMidi)||(item.rootMidi as number)<21||(item.rootMidi as number)>108))return null
 return {id:item.id,label:item.label.trim(),format:item.format,file:item.file,
  license:item.license.trim(),redistributionApproved:true,
  ...(item.format==='wav'?{rootMidi:item.rootMidi as number}:{}),
  ...(typeof item.description==='string'?{description:item.description.slice(0,250)}:{})}
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
 return '/instruments/'+item.id+'/'+encodeURIComponent(item.file)
}
export async function loadPublishedLibrary():Promise<PublishedInstrument[]>{
 const response=await fetch('/instruments/catalog.json',{cache:'no-store'})
 if(!response.ok)throw new Error('Cannot load shared instrument library')
 return parsePublishedLibrary(await response.json())
}
