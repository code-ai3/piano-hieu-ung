'use strict'
// MELORIX Desktop secure VST3 discovery bridge.
// The renderer never gets Node, child_process or arbitrary filesystem access.
const {contextBridge,ipcRenderer}=require('electron')
contextBridge.exposeInMainWorld('melorixDesktop',Object.freeze({
  environment:'desktop',
  scanVst3:()=>ipcRenderer.invoke('melorix:vst3:scan'),
  bindVst3Track:(trackId,pluginPath)=>ipcRenderer.invoke('melorix:vst3:bind',trackId,pluginPath),
  unbindVst3Track:(trackId)=>ipcRenderer.invoke('melorix:vst3:unbind',trackId),
  listVst3Tracks:()=>ipcRenderer.invoke('melorix:vst3:tracks'),
  openVst3Editor:(trackId)=>ipcRenderer.invoke('melorix:vst3:editor-open',trackId),
  closeVst3Editor:(trackId)=>ipcRenderer.invoke('melorix:vst3:editor-close',trackId),
  auditionVst3Note:(trackId,pitch,velocity,durationMs)=>ipcRenderer.invoke('melorix:vst3:audition',trackId,pitch,velocity,durationMs),
  startLiveVst3Track:(trackId)=>ipcRenderer.invoke('melorix:vst3:live-start',trackId),
  stopLiveVst3:()=>ipcRenderer.invoke('melorix:vst3:live-stop'),
  sendLiveVst3Note:(trackId,pitch,velocity)=>ipcRenderer.invoke('melorix:vst3:live-note',trackId,pitch,velocity),
}))
