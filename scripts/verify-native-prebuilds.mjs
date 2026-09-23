import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)

function verifyElectronRuntime() {
  const electronPath = require('electron')
  if (typeof electronPath !== 'string' || !existsSync(electronPath)) {
    console.error('Electron runtime is unavailable. Run npm install again to download Electron for this platform.')
    process.exitCode = 1
    return
  }
  console.log(`Electron runtime verified at ${electronPath}.`)
}

verifyElectronRuntime()

const target = `${process.platform}-${process.arch}`
const required = [
  join('node_modules', 'node-pty', 'prebuilds', target, process.platform === 'win32' ? 'conpty.node' : 'pty.node')
]

const missing = required.filter((path) => !existsSync(path))
if (missing.length > 0) {
  console.error(`Native prebuilds are unavailable for ${target}:\n${missing.join('\n')}`)
  console.error('Install the platform toolchain and enable npmRebuild in electron-builder.yml for this target.')
  process.exitCode = 1
} else {
  console.log(`Native prebuilds verified for ${target}.`)
}
