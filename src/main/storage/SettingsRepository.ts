import { browserSettingsSchema, defaultBrowserSettings, defaultSavedBrowserTheme, savedBrowserThemeSchema, type BrowserSettings, type SavedBrowserTheme } from '../../shared/contracts/browser'
import { githubConnectionMetadataSchema, type GitHubConnectionMetadata } from '../../shared/contracts/github'
import type { StacklyDatabase } from './database'
import type { StartupConfigRepository } from './StartupConfigRepository'

const BROWSER_SETTINGS_KEY = 'browserSettings'
const GITHUB_METADATA_KEY = 'githubConnectionMetadata'

function includeDefaultTheme(themes: SavedBrowserTheme[]): SavedBrowserTheme[] {
  const withoutDefault = themes.filter((theme) => theme.id !== defaultSavedBrowserTheme.id)
  return [defaultSavedBrowserTheme, ...withoutDefault].slice(0, 24)
}

function mergeBrowserSettings(raw: unknown): BrowserSettings {
  const stored = raw && typeof raw === 'object' ? raw as Partial<BrowserSettings> : {}
  const storedTheme = stored.theme && typeof stored.theme === 'object' ? stored.theme as Partial<BrowserSettings['theme']> : {}
  const storedColors = storedTheme.colors && typeof storedTheme.colors === 'object' ? storedTheme.colors as Partial<BrowserSettings['theme']['colors']> : {}
  const storedFeatures = stored.features && typeof stored.features === 'object' ? stored.features as Partial<BrowserSettings['features']> : {}
  const backgroundImage = typeof storedTheme.backgroundImage === 'string' ? storedTheme.backgroundImage : defaultBrowserSettings.theme.backgroundImage
  const storedWallpapers = Array.isArray(storedTheme.wallpapers) ? storedTheme.wallpapers.filter((item): item is string => typeof item === 'string') : []
  const storedThemes = Array.isArray(storedTheme.savedThemes)
    ? storedTheme.savedThemes.flatMap((item): SavedBrowserTheme[] => {
      const parsed = savedBrowserThemeSchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })
    : []
  const wallpapers = [...new Set([backgroundImage, ...storedWallpapers].filter(Boolean))].slice(0, 24)
  return browserSettingsSchema.parse({
    sidebarDefault: typeof stored.sidebarDefault === 'boolean' ? stored.sidebarDefault : defaultBrowserSettings.sidebarDefault,
    devPanelDefault: typeof stored.devPanelDefault === 'boolean' ? stored.devPanelDefault : defaultBrowserSettings.devPanelDefault,
    restoreTabs: typeof stored.restoreTabs === 'boolean' ? stored.restoreTabs : defaultBrowserSettings.restoreTabs,
    defaultEnvironment: stored.defaultEnvironment ?? defaultBrowserSettings.defaultEnvironment,
    networkPreserveLog: typeof stored.networkPreserveLog === 'boolean' ? stored.networkPreserveLog : defaultBrowserSettings.networkPreserveLog,
    consolePreserveLog: typeof stored.consolePreserveLog === 'boolean' ? stored.consolePreserveLog : defaultBrowserSettings.consolePreserveLog,
    theme: {
      backgroundImage,
      wallpapers,
      savedThemes: includeDefaultTheme(storedThemes),
      colors: {
        ...defaultBrowserSettings.theme.colors,
        ...storedColors
      }
    },
    features: {
      ...defaultBrowserSettings.features,
      ...storedFeatures
    }
  })
}

export class SettingsRepository {
  constructor(private readonly database: StacklyDatabase, private readonly startupConfig?: StartupConfigRepository) {}

  get(key: string): string | null {
    const row = this.database.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  set(key: string, value: string): void {
    this.database.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  }

  delete(key: string): void {
    this.database.prepare('DELETE FROM settings WHERE key = ?').run(key)
  }

  getBrowserSettings(): BrowserSettings {
    const stored = this.get(BROWSER_SETTINGS_KEY)
    if (!stored) return browserSettingsSchema.parse(defaultBrowserSettings)
    try {
      return mergeBrowserSettings(JSON.parse(stored))
    } catch { return browserSettingsSchema.parse(defaultBrowserSettings) }
  }

  setBrowserSettings(value: BrowserSettings): BrowserSettings {
    const settings = browserSettingsSchema.parse(value)
    this.set(BROWSER_SETTINGS_KEY, JSON.stringify(settings))
    this.startupConfig?.syncBrowserSettings(settings)
    return settings
  }

  getGitHubConnectionMetadata(): GitHubConnectionMetadata | null {
    const stored = this.get(GITHUB_METADATA_KEY)
    if (!stored) return null
    try {
      const parsed = githubConnectionMetadataSchema.safeParse(JSON.parse(stored))
      return parsed.success ? parsed.data : null
    } catch { return null }
  }

  setGitHubConnectionMetadata(value: GitHubConnectionMetadata): GitHubConnectionMetadata {
    const metadata = githubConnectionMetadataSchema.parse(value)
    this.set(GITHUB_METADATA_KEY, JSON.stringify(metadata))
    return metadata
  }

  deleteGitHubConnectionMetadata(): void {
    this.delete(GITHUB_METADATA_KEY)
  }
}
