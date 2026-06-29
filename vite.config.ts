import { fileURLToPath, URL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { join, extname } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 的静态文件中间件无法处理 URL 中 %23 (#) 的文件名，会 fall through 到 SPA 回退。
// 这个插件拦截 /samples/ 请求直接 serve 文件，同时适用于 dev 和 preview。
const MIME: Record<string, string> = {
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}
function serveSamples(middlewares: any) {
  middlewares.use((req: any, res: any, next: any) => {
    if (!req.url?.startsWith('/samples/')) return next()
    const filePath = join(process.cwd(), 'public', decodeURIComponent(req.url!))
    if (!existsSync(filePath)) { res.statusCode = 404; res.end(); return }
    const ext = extname(filePath).toLowerCase()
    const mime = MIME[ext] || 'application/octet-stream'
    try {
      const data = readFileSync(filePath)
      res.statusCode = 200
      res.setHeader('Content-Type', mime)
      res.setHeader('Content-Length', data.length)
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.end(data)
    } catch { res.statusCode = 500; res.end() }
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'samples-middleware',
      configureServer(server) { serveSamples(server.middlewares) },
      configurePreviewServer(server) { serveSamples(server.middlewares) },
    },
  ],
  build: {
    target: 'es2022',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
