// Stage F.2: conservative *estimate*, not a measurement of the browser RSS.
// Prevent a large offline mix + its encoded copy from exhausting modest devices.
export type ExportKind='wav'|'mp4'
export type ExportBudget={
 estimatedMiB:number
 budgetMiB:number
 audioMiB:number
 encodedMiB:number
 streamToDisk:boolean
}
const MIB=1024*1024
export function estimateExportBudget(
 seconds:number,
 kind:ExportKind,
 deviceGb?:number,
 streamToDisk=false,
 sampleRate=44100,
 channels=2
):ExportBudget{
 if(!Number.isFinite(seconds)||seconds<=0||seconds>86400||
    !Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000||
    !Number.isInteger(channels)||channels<1||channels>8)
  throw Error('Thông số thời lượng hoặc âm thanh không hợp lệ')
 const audioMiB=Math.ceil(seconds*sampleRate*channels*4/MIB*10)/10
 // MP4 targets ~8 Mb/s H.264 and 256 kb/s AAC; the in-memory BufferTarget
 // duplicates some bytes. StreamTarget bypasses the accumulated MP4 file.
 const encodedMiB=kind==='wav'
  ?seconds*sampleRate*channels*2/MIB
  :streamToDisk?0:seconds*(8_000_000+256_000)/8/MIB
 // Copies during encode, WASM encoder, video canvas and frame staging.
 const estimatedMiB=Math.ceil(audioMiB*(kind==='mp4'?2.1:1.4)+encodedMiB*1.15+96)
 const gb=Number.isFinite(deviceGb)&&Number(deviceGb)>0?Number(deviceGb):4
 const budgetMiB=Math.round(Math.max(384,Math.min(1024,gb*1024*.18)))
 return {estimatedMiB,budgetMiB,audioMiB,encodedMiB:Math.ceil(encodedMiB),streamToDisk}
}
export function enforceExportBudget(input:Parameters<typeof estimateExportBudget>):ExportBudget{
 const estimate=estimateExportBudget(...input)
 if(estimate.estimatedMiB>estimate.budgetMiB)
  throw Error(`Bài xuất có thể cần khoảng ${estimate.estimatedMiB} MB bộ nhớ, vượt mức an toàn ${estimate.budgetMiB} MB. Hãy chọn bản 15/30 giây, giảm thời lượng hoặc dùng trình duyệt trên máy có nhiều RAM hơn.`)
 return estimate
}
