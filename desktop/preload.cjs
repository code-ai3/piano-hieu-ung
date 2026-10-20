'use strict'
// MELORIX Desktop secure VST3 discovery bridge.
// The renderer never gets Node, child_process or arbitrary filesystem access.
const {contextBridge,ipcRenderer}=require('electron')
contextBridge.exposeInMainWorld('melorixDesktop',Object.freeze({
  environment:'desktop',
  scanVst3:()=>ipcRenderer.invoke('melorix:vst3:scan'),
}))
