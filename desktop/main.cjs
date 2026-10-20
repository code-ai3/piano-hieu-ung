'use strict'

// MELORIX Desktop: secure, locally served Vue/Vite application.
// No remote site or Node APIs are exposed to the renderer.
const { app, BrowserWindow, protocol, session, shell, ipcMain } = require('electron')
const { execFile } = require('node:child_process')
const path = require('node:path')
const { readFile } = require('node:fs/promises')
const { Vst3Session, validTrackId, approvedPluginPath }=require('./vst3-session.cjs')
const vst3Approvals=new Map()
let vst3Session=null
function trustedNativeSender(event){
 return event.senderFrame && event.senderFrame===event.sender.mainFrame &&
   isTrustedAppUrl(event.senderFrame.url)
}
function getVst3Session(){
 if(!vst3Session)vst3Session=new Vst3Session(path.join(
  process.resourcesPath,'vst3','melorix-vst3-session.exe'))
 return vst3Session
}

const ORIGIN = 'melorix://app'
function isAppOrigin(url) {
  // Node's WHATWG URL.origin is "null" for custom schemes, even if
  // Chromium registered them as standard, so compare protocol/host instead.
  return url.protocol === 'melorix:' && url.hostname === 'app' &&
    !url.username && !url.password && !url.port
}
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
})

protocol.registerSchemesAsPrivileged([{
  scheme: 'melorix',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
  },
}])

function allowedFilePath(root, pathname) {
  let decoded
  try { decoded = decodeURIComponent(pathname) }
  catch { return null }
  if (decoded.includes('\\') || decoded.includes('\0')) return null
  const relativePath = decoded === '/' ? '/index.html' : decoded
  const full = path.resolve(root, '.' + relativePath)
  if (!full.startsWith(root + path.sep)) return null
  return full
}

async function handleLocalAsset(request) {
  const url = new URL(request.url)
  if (!isAppOrigin(url) || !['GET', 'HEAD'].includes(request.method)) {
    return new Response('Not allowed', { status: 403 })
  }
  const root = path.resolve(app.getAppPath(), 'dist')
  const full = allowedFilePath(root, url.pathname)
  if (!full) return new Response('Invalid asset path', { status: 400 })
  try {
    // fs.readFile supports files packed into Electron's app.asar archive.
    const bytes = await readFile(full)
    const mime = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream'
    return new Response(request.method === 'HEAD' ? null : new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return new Response('Missing packaged asset: ' + url.pathname, { status: 404 })
    }
    console.error('MELORIX asset read failed:', error)
    return new Response('Local asset error', { status: 500 })
  }
}

function isTrustedAppUrl(raw) {
  try {
    const url = new URL(raw)
    return isAppOrigin(url)
  } catch { return false }
}

function maybeOpenExternal(raw) {
  try {
    const url = new URL(raw)
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      void shell.openExternal(url.href).catch(error =>
        console.warn('Could not open browser:', error))
    }
  } catch { /* Never open arbitrary local, javascript, or custom schemes. */ }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 900,
    minWidth: 920,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#101722',
    icon: path.join(app.getAppPath(), 'dist', 'favicon.ico'),
    title: 'MELORIX — MIDI Studio',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'desktop', 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedAppUrl(url)) maybeOpenExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (isTrustedAppUrl(url)) return
    event.preventDefault()
    maybeOpenExternal(url)
  })
  void win.loadURL(ORIGIN + '/index.html').catch(error => {
    console.error('MELORIX Desktop cannot open local assets:', error)
    win.show()
  })
}

app.setAppUserModelId('vn.lunor.melorix')

app.whenReady().then(() => {
  protocol.handle('melorix', handleLocalAsset)
  ipcMain.handle('melorix:vst3:scan', async (event) => {
    // Only the main-frame MELORIX origin may access native plugin discovery.
    if (!trustedNativeSender(event)) {
      throw new Error('Không được phép truy cập danh sách VST3')
    }
    const exe=path.join(process.resourcesPath,'vst3','melorix-vst3-scan.exe')
    return await new Promise((resolve,reject)=>{
      execFile(exe,[],{
        windowsHide:true,timeout:20000,maxBuffer:2*1024*1024,
      },(error,stdout)=>{
        if(error){reject(new Error('Không thể quét VST3 đã cài: '+error.message));return}
        try{
          const result=JSON.parse(stdout)
          if(result.schema!==1||result.engine!=='discovery-only'||!Array.isArray(result.plugins)){
            reject(new Error('Kết quả quét VST3 không hợp lệ'));return
          }
          // Store a per-window explicit scan allowlist. A renderer may not
          // send arbitrary DLL paths or pretend discovery means plugin loaded.
          vst3Approvals.set(event.sender.id,new Set(
            result.plugins.filter(p=>p.hasBinary&&typeof p.path==='string')
              .map(p=>path.win32.normalize(p.path).toLowerCase())))
          resolve(result)
        }catch(parseError){reject(new Error('Không đọc được kết quả VST3: '+parseError.message))}
      })
    })
  })
  ipcMain.handle('melorix:vst3:bind',async(event,trackId,pluginPath)=>{
    if(!trustedNativeSender(event))throw new Error('Nguồn gọi VST3 không được phép')
    if(!validTrackId(trackId))throw new Error('Track MIDI không hợp lệ')
    const selected=approvedPluginPath(pluginPath,
      vst3Approvals.get(event.sender.id)||new Set())
    if(!selected)throw new Error('Hãy quét VST3 rồi chọn plugin đã được tìm thấy')
    return getVst3Session().request('LOAD\t'+trackId+'\t'+selected)
  })
  ipcMain.handle('melorix:vst3:unbind',async(event,trackId)=>{
    if(!trustedNativeSender(event))throw new Error('Nguồn gọi VST3 không được phép')
    if(!validTrackId(trackId))throw new Error('Track MIDI không hợp lệ')
    return getVst3Session().request('UNLOAD\t'+trackId)
  })
  ipcMain.handle('melorix:vst3:audition',async(event,trackId,pitch,velocity,durationMs)=>{
    if(!trustedNativeSender(event))throw new Error('Nguồn gọi VST3 không được phép')
    if(!validTrackId(trackId)||!Number.isInteger(pitch)||pitch<0||pitch>127||
       !Number.isInteger(velocity)||velocity<1||velocity>127||
       !Number.isInteger(durationMs)||durationMs<100||durationMs>3000){
      throw new Error('Thông số MIDI VST3 không hợp lệ')
    }
    const result=await getVst3Session().request(
      'AUDITION\t'+trackId+'\t'+pitch+'\t'+velocity+'\t'+durationMs)
    if(result.operation!=='audition'||result.realVst3Pcm!==true||
       result.format!=='wav-f32'||typeof result.wavBase64!=='string'||
       result.wavBase64.length>5*1024*1024||!Number.isFinite(result.peak)){
      throw new Error('Âm thanh VST3 không hợp lệ')
    }
    return {audioBase64:result.wavBase64,peak:result.peak,
      nonzeroSamples:result.nonzeroSamples,track:trackId,
      format:'wav-f32',source:'vst3-process'}
  })
  ipcMain.handle('melorix:vst3:editor-open',async(event,trackId)=>{
    if(!trustedNativeSender(event))throw new Error('Nguồn mở editor VST3 không hợp lệ')
    if(!validTrackId(trackId))throw new Error('Track không hợp lệ')
    const win=BrowserWindow.fromWebContents(event.sender)
    if(!win||win.isDestroyed())throw new Error('Cửa sổ MELORIX đã đóng')
    const handle=win.getNativeWindowHandle()
    if(!Buffer.isBuffer(handle)||handle.length<8)throw new Error('Không nhận diện được HWND của MELORIX')
    // HWND of real Electron parent, never accepted from untrusted renderer.
    const owner=handle.readBigUInt64LE(0).toString(16)
    return getVst3Session().request('EDITOR_OPEN\t'+trackId+'\t'+owner)
  })
  ipcMain.handle('melorix:vst3:editor-close',async(event,trackId)=>{
    if(!trustedNativeSender(event))throw new Error('Nguồn đóng editor VST3 không hợp lệ')
    if(!validTrackId(trackId))throw new Error('Track không hợp lệ')
    return getVst3Session().request('EDITOR_CLOSE\t'+trackId)
  })
  ipcMain.handle('melorix:vst3:tracks',async(event)=>{
    if(!trustedNativeSender(event))throw new Error('Nguồn gọi VST3 không được phép')
    return getVst3Session().request('LIST')
  })
  // Ask only for unsandboxed MIDI device access; Kontakt is still an external app.
  // SysEx and other unrelated permissions are intentionally not granted.
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const url = details?.requestingUrl || contents.getURL()
    callback(permission === 'midi' && isTrustedAppUrl(url))
  })
  // Electron requires both the check and request handlers for many Web APIs.
  // Only the local app origin can access MIDI, and SysEx stays denied.
  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) => {
    if (permission !== 'midi') return false
    return isTrustedAppUrl(requestingOrigin) ||
      Boolean(contents && isTrustedAppUrl(contents.getURL()))
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch(error => {
  console.error('MELORIX startup failed:', error)
  app.exit(1)
})

app.on('before-quit',()=>{
  vst3Session?.shutdown()
  vst3Approvals.clear()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
