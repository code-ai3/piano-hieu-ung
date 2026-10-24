// One decoded GM sample source for WebAudio playback and offline WAV/MP4.
// smplr SampleLoader intentionally accepts AudioBuffers from a live context in
// renderOffline; sharing prevents the two paths re-downloading different data.
import {CacheStorage,SampleLoader} from 'smplr'

export type GmSampleLoader=ReturnType<typeof SampleLoader>
const loaders=new WeakMap<BaseAudioContext,GmSampleLoader>()
let storage:ReturnType<typeof CacheStorage>|undefined
export function gmSampleStorage():ReturnType<typeof CacheStorage>|undefined{
 // Secure Cloudflare and localhost can use Cache API, without shipping any
 // third-party sample library or copying content into our repository.
 if(typeof caches==='undefined')return undefined
 try{return storage??=CacheStorage()}catch{return undefined}
}
export function gmSampleLoader(ctx:BaseAudioContext):GmSampleLoader{
 let loader=loaders.get(ctx)
 if(!loader){
  loader=SampleLoader(ctx)
  loaders.set(ctx,loader)
 }
 return loader
}
