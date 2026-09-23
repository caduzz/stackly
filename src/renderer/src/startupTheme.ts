import { defaultStartupConfig, startupConfigSchema, type BrowserSettings, type StartupConfig } from '../../shared/contracts/browser'

const colorVarNames: Record<keyof BrowserSettings['theme']['colors'], `--${string}`> = {
  bgPrimary: '--color-bg-primary',
  bgSecondary: '--color-bg-secondary',
  surface: '--color-surface',
  textPrimary: '--color-text-primary',
  textMuted: '--color-text-muted',
  accent: '--color-accent',
  selection: '--color-selection',
  border: '--color-border'
}

export function startupConfig(): StartupConfig {
  const parsed = startupConfigSchema.safeParse(window.devBrowser.startupConfig)
  return parsed.success ? parsed.data : defaultStartupConfig
}

export function applyStartupTheme(config = startupConfig()): void {
  const root = document.documentElement
  root.dataset.theme = 'dark'
  for (const [key, variable] of Object.entries(colorVarNames) as Array<[keyof BrowserSettings['theme']['colors'], `--${string}`]>) {
    root.style.setProperty(variable, config.browserSettings.theme.colors[key])
  }
  root.style.backgroundColor = config.browserSettings.theme.colors.bgPrimary
  document.body.style.backgroundColor = config.browserSettings.theme.colors.bgPrimary
}
