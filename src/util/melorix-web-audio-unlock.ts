// Browser autoplay restrictions may keep AudioContext.resume() pending.
// A blocked background load must never lock MELORIX's Play control forever.
export async function unlockWebAudio(
 ctx: Pick<AudioContext,'state'|'resume'>,
 timeoutMs=1800
):Promise<void>{
 if(ctx.state==='running')return
 if(ctx.state==='closed')throw Error('Đầu ra âm thanh đã đóng. Hãy bấm Phát lại.')
 let timer:ReturnType<typeof setTimeout>|undefined
 try{
  await Promise.race([
   ctx.resume(),
   new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>reject(Error('Trình duyệt chưa cho phép phát âm thanh. Hãy bấm Phát hoặc Thử loa để kích hoạt.')),timeoutMs)
   })
  ])
 }finally{if(timer!==undefined)clearTimeout(timer)}
 if(ctx.state!=='running')throw Error('Âm thanh vẫn đang tạm dừng. Hãy bấm Phát hoặc Thử loa.')
}
