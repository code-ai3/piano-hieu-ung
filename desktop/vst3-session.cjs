'use strict'
// MELORIX Stage 3A — confined persistent native VST3 session.
// Commands and JSON replies travel only through the child process' stdio.
// The Electron renderer receives no Node APIs, arbitrary shell access or DLL loading.
// No audio stream, ASIO/WASAPI device or plugin editor is provided at this stage.
const {spawn}=require('node:child_process')
const path=require('node:path')

class Vst3Session {
 constructor(binaryPath){
  this.binaryPath=binaryPath
  this.child=null
  this.buffer=''
  this.pending=[]
  this.current=null
  this.stopping=false
 }
 start(){
  if(this.child)return
  if(process.platform!=='win32')throw new Error('VST3 Host chỉ hỗ trợ Windows x64')
  const child=spawn(this.binaryPath,[],{
   shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],
  })
  this.child=child
  child.stdout.setEncoding('utf8')
  child.stdout.on('data',chunk=>{
   this.buffer+=chunk
   if(this.buffer.length>8*1024*1024){this.failAll(new Error('Phản hồi VST3 quá lớn'));return}
   while(this.buffer.includes('\n')){
    const pos=this.buffer.indexOf('\n')
    const raw=this.buffer.slice(0,pos).trim()
    this.buffer=this.buffer.slice(pos+1)
    if(!this.current){this.failAll(new Error('VST3 gửi phản hồi ngoài yêu cầu'));return}
    let data
    try{
     data=JSON.parse(raw)
     if(data.schema!==3||typeof data.ok!=='boolean')throw Error('schema')
    }catch{
     this.failAll(new Error('Phản hồi VST3 không hợp lệ'));return
    }
    const job=this.current;this.current=null
    clearTimeout(job.timeout)
    if(data.ok)job.resolve(data)
    else job.reject(new Error(data.error||'Plugin VST3 không thể khởi tạo'))
    this.pump()
   }
  })
  child.stderr.on('data',data=>console.warn('MELORIX VST3 native:',String(data).slice(0,500)))
  child.once('error',error=>this.failAll(new Error('Không mở được bộ VST3 native: '+error.message)))
  child.once('exit',(code,signal)=>{
   if(this.child!==child)return
   this.child=null
   this.failAll(new Error('Bộ VST3 dừng bất ngờ ('+(signal||code)+')'))
  })
 }
 request(command){
  if(this.stopping) return Promise.reject(new Error('Bộ VST3 đang đóng'))
  if(typeof command!=='string'||!command||command.includes('\n')||command.includes('\r')||
      command.length>8192)return Promise.reject(new Error('Lệnh VST3 không hợp lệ'))
  try{this.start()}catch(error){return Promise.reject(error)}
  return new Promise((resolve,reject)=>{
   this.pending.push({command,resolve,reject,timeout:null})
   this.pump()
  })
 }
 pump(){
  if(this.current||!this.pending.length||!this.child)return
  const job=this.pending.shift()
  this.current=job
  job.timeout=setTimeout(()=>this.failAll(new Error('VST3 không phản hồi trong 30 giây')),30000)
  this.child.stdin.write(job.command+'\n',error=>{
   if(error)this.failAll(new Error('Không gửi được lệnh VST3: '+error.message))
  })
 }
 failAll(error){
  if(this.current){
   clearTimeout(this.current.timeout)
   this.current.reject(error)
   this.current=null
  }
  for(const job of this.pending)job.reject(error)
  this.pending=[]
  if(this.child){const child=this.child;this.child=null;child.kill()}
  this.buffer=''
 }
 shutdown(){
  this.stopping=true
  this.failAll(new Error('MELORIX đang đóng'))
 }
}
function validTrackId(id){
 return Number.isSafeInteger(id)&&id>=0&&id<=10000000
}
function approvedPluginPath(value,approved){
 if(typeof value!=='string'||value.length>4096||/[\r\n\t]/.test(value)||
   path.win32.extname(value).toLowerCase()!=='.vst3')return null
 const normalized=path.win32.normalize(value).toLowerCase()
 return approved.has(normalized)?value:null
}
module.exports={Vst3Session,validTrackId,approvedPluginPath}
