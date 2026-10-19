export interface KontaktMidiTrack {id:number;channel:number}
export function validKontaktChannel(value:unknown):value is number {
 return typeof value==='number' && Number.isInteger(value) && value>=1 && value<=16
}
export function kontaktChannel(track:KontaktMidiTrack, routes:Readonly<Record<number,number>>):number{
 const chosen=routes[track.id]
 return validKontaktChannel(chosen)?chosen:validKontaktChannel(track.channel)?track.channel:1
}
export function kontaktChannelConflict(tracks:readonly KontaktMidiTrack[],routes:Readonly<Record<number,number>>,id:number):boolean {
 const target=tracks.find(p=>p.id===id)
 return !!target && tracks.some(p=>p.id!==id && kontaktChannel(p,routes)===kontaktChannel(target,routes))
}
export function nextKontaktChannel(tracks:readonly KontaktMidiTrack[],routes:Readonly<Record<number,number>>):number {
 const used=new Set(tracks.map(p=>kontaktChannel(p,routes)))
 for(let n=1;n<=16;n++)if(!used.has(n))return n
 return 1
}
