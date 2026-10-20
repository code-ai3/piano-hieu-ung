'use strict'

// MELORIX Desktop: secure, locally served Vue/Vite application.
// No remote site or Node APIs are exposed to the renderer.
const { app, BrowserWindow, protocol, session, shell } = require('electron')
const path = require('node:path')
const { readFile } = require('node:fs/promises')

const ORIGIN = 'melorix://app'
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
  if (url.origin !== ORIGIN || !['GET', 'HEAD'].includes(request.method)) {
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
    return url.origin === ORIGIN
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
  // Ask only for unsandboxed MIDI device access; Kontakt is still an external app.
  // SysEx and other unrelated permissions are intentionally not granted.
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(permission === 'midi' && isTrustedAppUrl(contents.getURL()))
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch(error => {
  console.error('MELORIX startup failed:', error)
  app.exit(1)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
