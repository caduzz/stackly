import type Database from 'better-sqlite3'
import { browserSettingsSchema, defaultBrowserSettings, type BrowserSettings } from '../../shared/contracts/browser'

const BROWSER_SETTINGS_KEY = 'browserSettings'

export class SettingsRepository {
  constructor(private readonly database: Database.Database) {}

  get(key: string): string | null {
    const row = this.database.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  set(key: string, value: string): void {
    this.database.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  }

  getBrowserSettings(): BrowserSettings {
    const stored = this.get(BROWSER_SETTINGS_KEY)
    if (!stored) return { ...defaultBrowserSettings }
    try {
      const parsed = browserSettingsSchema.safeParse(JSON.parse(stored))
      return parsed.success ? parsed.data : { ...defaultBrowserSettings }
    } catch { return { ...defaultBrowserSettings } }
  }

  setBrowserSettings(value: BrowserSettings): BrowserSettings {
    const settings = browserSettingsSchema.parse(value)
    this.set(BROWSER_SETTINGS_KEY, JSON.stringify(settings))
    return settings
  }
}
