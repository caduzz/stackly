import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { defaultStartupConfig, startupConfigSchema, type BrowserSettings, type StartupConfig } from '../../shared/contracts/browser'

const STARTUP_CONFIG_FILE = 'startup-config.json'

export class StartupConfigRepository {
  private readonly path: string

  constructor(directory = app.getPath('userData')) {
    this.path = join(directory, STARTUP_CONFIG_FILE)
  }

  read(): StartupConfig {
    try {
      const parsed = startupConfigSchema.safeParse(JSON.parse(readFileSync(this.path, 'utf8')))
      if (parsed.success) return parsed.data
    } catch { /* Missing or corrupt startup config falls back to defaults. */ }
    return defaultStartupConfig
  }

  syncBrowserSettings(browserSettings: BrowserSettings): StartupConfig {
    return this.write({ version: 1, browserSettings })
  }

  private write(config: StartupConfig): StartupConfig {
    const parsed = startupConfigSchema.parse(config)
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
    return parsed
  }
}
