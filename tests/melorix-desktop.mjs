import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const main = readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8')
const builder = readFileSync(new URL('../electron-builder.yml', import.meta.url), 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const registered = []
const fakeElectron = {
  protocol: { registerSchemesAsPrivileged: (schemes) => registered.push(...schemes) },
  app: { setAppUserModelId() {}, whenReady: () => new Promise(() => {}), on() {} },
  BrowserWindow: {},
  session: {},
  shell: {},
}
const context = {
  require: (name) => name === 'electron' ? fakeElectron : require(name),
  console, URL, Response, process,
}
vm.runInNewContext(main + '\nglobalThis.__tests = { isTrustedAppUrl, allowedFilePath, isAppOrigin }', context, {filename:'main.cjs'})
const { isTrustedAppUrl, allowedFilePath } = context.__tests
assert.equal(registered.length, 1)
assert.equal(registered[0].scheme, 'melorix')
assert.equal(registered[0].privileges.standard, true)
assert.equal(registered[0].privileges.secure, true)
assert.equal(registered[0].privileges.supportFetchAPI, true)
assert.equal(isTrustedAppUrl('melorix://app/index.html'), true)
assert.equal(isTrustedAppUrl('melorix://evil/index.html'), false)
assert.equal(isTrustedAppUrl('file:///C:/Windows/system32/calc.exe'), false)
assert.equal(isTrustedAppUrl('https://example.com'), false)
assert.equal(isTrustedAppUrl('javascript:alert(1)'), false)
const dir = path.resolve('dist')
assert.equal(allowedFilePath(dir, '/'), path.join(dir,'index.html'))
assert.equal(allowedFilePath(dir, '/assets/index.js'), path.join(dir,'assets','index.js'))
assert.equal(allowedFilePath(dir, '/../../outside.json'), null)
assert.equal(allowedFilePath(dir, '/%5CWindows%5Csystem32'), null)
assert.match(main,/contextIsolation:\s*true/)
assert.match(main,/nodeIntegration:\s*false/)
assert.match(main,/sandbox:\s*true/)
assert.match(main,/webSecurity:\s*true/)
assert.match(main,/permission === 'midi'/)
assert.match(main,/win\.loadURL\(ORIGIN \+ '\/index\.html'\)/)
assert.equal(pkg.main, 'desktop/main.cjs')
assert.match(builder,/target: portable/)
assert.match(builder,/target: nsis/)
assert.match(builder,/electronVersion: 37\.2\.0/)
assert.match(builder,/appId: vn\.lunor\.melorix/)
console.log('PASS: Electron security origin, local assets, Win64 Setup/Portable packaging')
