import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const builder = await readFile(new URL('../electron-builder.yml', import.meta.url), 'utf8')
const html = await readFile(new URL('../src/renderer/index.html', import.meta.url), 'utf8')
const main = await readFile(new URL('../src/main/index.ts', import.meta.url), 'utf8')

test('distribution scripts and targets are configured', () => {
  for (const script of ['dev', 'build', 'typecheck', 'test', 'package']) assert.equal(typeof packageJson.scripts[script], 'string')
  assert.equal(packageJson.desktopName, 'Stackly')
  assert.match(packageJson.author.email, /@/)
  for (const target of ['AppImage', 'nsis', 'dmg']) assert.match(builder, new RegExp(target))
  assert.match(packageJson.scripts['package:deb'], /--linux deb/)
})

test('prebuilt native modules are unpacked from ASAR', () => {
  assert.match(builder, /asar: true/)
  assert.match(builder, /node_modules\/better-sqlite3/)
  assert.match(builder, /node_modules\/node-pty/)
  assert.match(builder, /npmRebuild: false/)
  assert.match(builder, /!\*\*\/\*\.map/)
  assert.equal(packageJson.scripts.postinstall, 'node scripts/verify-native-prebuilds.mjs')
})

test('production shell is local and has a restrictive CSP', () => {
  assert.match(main, /!app\.isPackaged && process\.env\.ELECTRON_RENDERER_URL/)
  assert.doesNotMatch(html, /unsafe-eval/)
  assert.doesNotMatch(html, /ws:\/\/(localhost|127\.0\.0\.1)/)
  assert.match(html, /script-src 'self'/)
})

test('package configuration contains no development machine path', () => {
  assert.doesNotMatch(JSON.stringify(packageJson) + builder + main, /\/home\/|[A-Z]:\\Users\\/)
})
