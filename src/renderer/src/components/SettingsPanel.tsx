import { useEffect, useRef, useState } from 'react'
import { Check, Palette, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { defaultBrowserSettings, defaultSavedBrowserTheme, type BrowserSettings, type ImageThemeResult, type SavedBrowserTheme } from '../../../shared/contracts/browser'
import { IconButton } from './IconButton'

type Category = 'appearance' | 'browser' | 'developer' | 'workspaces'
const categories: Array<{ id: Category; label: string }> = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'browser', label: 'Browser' },
  { id: 'developer', label: 'Developer Tools' },
  { id: 'workspaces', label: 'Workspaces' }
]

type Props = {
  settings: BrowserSettings
  workspaceCount: number
  onChange: (settings: BrowserSettings) => Promise<void>
  onClose: () => void
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }): React.JSX.Element {
  return <label className="settings-row">
    <span><strong>{label}</strong><small>{description}</small></span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
  </label>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }): React.JSX.Element {
  return <label className="settings-color">
    <span>{label}</span>
    <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
}

function wallpaperPreviewStyle(value: string): React.CSSProperties {
  const source = value.trim()
  if (!source) return {}
  const normalized = /^[A-Za-z]:[\\/]/.test(source) ? `file:///${source.replaceAll('\\', '/')}` : source
  return { backgroundImage: `url("${encodeURI(normalized).replaceAll('"', '\\"')}")` }
}

function themeName(source: string): string {
  const value = source.trim()
  if (!value) return `Theme ${new Date().toLocaleDateString()}`
  const fileName = value.split(/[\\/]/).at(-1) ?? value
  const clean = fileName.split('?')[0]?.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim()
  return clean ? clean.slice(0, 80) : `Theme ${new Date().toLocaleDateString()}`
}

export function SettingsPanel({ settings, workspaceCount, onChange, onClose }: Props): React.JSX.Element {
  const [category, setCategory] = useState<Category>('appearance')
  const [error, setError] = useState('')
  const [wallpaperInput, setWallpaperInput] = useState(settings.theme.backgroundImage)
  const [themePreview, setThemePreview] = useState<ImageThemeResult | null>(null)
  const [themeGenerating, setThemeGenerating] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const wallpapers = settings.theme.wallpapers ?? []
  const savedThemes = settings.theme.savedThemes ?? []

  useEffect(() => {
    void window.devBrowser.layout.setPaletteOpen(true).then(() => panelRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close settings"]')?.focus()).catch(console.error)
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      void window.devBrowser.layout.setPaletteOpen(false).catch(console.error)
    }
  }, [])

  function update(patch: Partial<BrowserSettings>): void {
    setError('')
    void onChange({ ...settings, ...patch }).catch(() => setError('Could not save settings.'))
  }

  function updateTheme(patch: Partial<BrowserSettings['theme']>): void {
    update({ theme: { ...settings.theme, ...patch } })
  }

  function confirmWallpaper(): void {
    const next = wallpaperInput.trim()
    setThemePreview(null)
    if (!next) {
      updateTheme({ backgroundImage: '' })
      return
    }
    updateTheme({ backgroundImage: next, wallpapers: [next, ...wallpapers.filter((item) => item !== next)].slice(0, 24) })
  }

  function selectWallpaper(value: string): void {
    setWallpaperInput(value)
    setThemePreview(null)
    updateTheme({ backgroundImage: value })
  }

  function removeWallpaper(value: string): void {
    const nextWallpapers = wallpapers.filter((item) => item !== value)
    updateTheme({ wallpapers: nextWallpapers, backgroundImage: settings.theme.backgroundImage === value ? nextWallpapers[0] ?? '' : settings.theme.backgroundImage })
    if (wallpaperInput === value) setWallpaperInput(nextWallpapers[0] ?? '')
  }

  function updateColor(key: keyof BrowserSettings['theme']['colors'], value: string): void {
    setThemePreview(null)
    updateTheme({ colors: { ...settings.theme.colors, [key]: value } })
  }

  function saveTheme(colors = settings.theme.colors, swatches: string[] = [], source = settings.theme.backgroundImage, name = themeName(source)): SavedBrowserTheme {
    const theme: SavedBrowserTheme = {
      id: crypto.randomUUID(),
      name,
      source,
      colors,
      swatches,
      createdAt: new Date().toISOString()
    }
    updateTheme({ savedThemes: [theme, ...savedThemes].slice(0, 24) })
    return theme
  }

  function generateTheme(): void {
    const source = wallpaperInput.trim() || settings.theme.backgroundImage.trim()
    if (!source) {
      setError('Add an image first.')
      return
    }
    setError('')
    setThemeGenerating(true)
    void window.devBrowser.settings.generateThemeFromImage(source).then((result) => {
      setThemePreview(result)
    }).catch((cause: unknown) => {
      setThemePreview(null)
      setError(cause instanceof Error ? cause.message : 'Could not generate a theme from this image.')
    }).finally(() => setThemeGenerating(false))
  }

  function applyGeneratedTheme(): void {
    if (!themePreview) return
    const source = wallpaperInput.trim()
    const nextWallpapers = source ? [source, ...wallpapers.filter((item) => item !== source)].slice(0, 24) : wallpapers
    const theme: SavedBrowserTheme = {
      id: crypto.randomUUID(),
      name: themeName(source),
      source,
      colors: themePreview.colors,
      swatches: themePreview.swatches,
      createdAt: new Date().toISOString()
    }
    updateTheme({
      colors: themePreview.colors,
      savedThemes: [theme, ...savedThemes].slice(0, 24),
      ...(source ? { backgroundImage: source, wallpapers: nextWallpapers } : {})
    })
    setThemePreview(null)
  }

  function applySavedTheme(theme: SavedBrowserTheme): void {
    setThemePreview(null)
    setWallpaperInput(theme.source || settings.theme.backgroundImage)
    const nextWallpapers = theme.source ? [theme.source, ...wallpapers.filter((item) => item !== theme.source)].slice(0, 24) : wallpapers
    updateTheme({ colors: theme.colors, ...(theme.source ? { backgroundImage: theme.source, wallpapers: nextWallpapers } : {}) })
  }

  function removeSavedTheme(id: string): void {
    updateTheme({ savedThemes: savedThemes.filter((theme) => theme.id !== id) })
  }

  function updateFeature(key: keyof BrowserSettings['features'], value: boolean): void {
    update({ features: { ...settings.features, [key]: value } })
  }

  return <div className="settings-backdrop" role="presentation">
    <section ref={panelRef} className="settings-panel" role="dialog" aria-modal="true" aria-label="Settings">
      <header><div><strong>Settings</strong><span>Stackly preferences</span></div><IconButton icon={X} aria-label="Close settings" title="Close settings" onClick={onClose} /></header>
      <div className="settings-layout">
        <nav aria-label="Settings categories">{categories.map((item) => <button type="button" key={item.id} className={item.id === category ? 'is-active' : ''} aria-current={item.id === category ? 'page' : undefined} onClick={() => setCategory(item.id)}>{item.label}</button>)}</nav>
        <div className="settings-content">
          <h2>{categories.find((item) => item.id === category)?.label}</h2>
          {category === 'appearance' && <>
            <Toggle label="Show sidebar by default" description="Show the workspace sidebar when the app starts." checked={settings.sidebarDefault} onChange={(checked) => update({ sidebarDefault: checked })} />
            <div className="settings-field">
              <label htmlFor="background-image">Background image</label>
              <small>Shown on the empty browser screen. Confirm to save it in your wallpaper previews.</small>
              <div className="settings-wallpaper-input">
                <input id="background-image" type="text" placeholder="https://images.example/background.jpg" value={wallpaperInput} onChange={(event) => setWallpaperInput(event.target.value)} />
                <button type="button" onClick={confirmWallpaper}><Check size={14} aria-hidden="true" />Confirm</button>
              </div>
            </div>
            <div className="settings-theme-generator">
              <div>
                <strong>Image theme</strong>
                <small>Generate colors from the current image, then apply if it feels right.</small>
              </div>
              <button type="button" disabled={themeGenerating} onClick={generateTheme}><Palette size={14} aria-hidden="true" />{themeGenerating ? 'Generating' : 'Generate'}</button>
              {themePreview && <div className="settings-theme-preview">
                <div className="settings-theme-preview-surface" style={{
                  background: themePreview.colors.bgPrimary,
                  borderColor: themePreview.colors.border,
                  color: themePreview.colors.textPrimary
                }}>
                  <span style={{ background: themePreview.colors.bgSecondary }}>Panel</span>
                  <strong style={{ color: themePreview.colors.textPrimary }}>Theme preview</strong>
                  <small style={{ color: themePreview.colors.textMuted }}>Generated from image</small>
                  <em style={{ background: themePreview.colors.selection, color: themePreview.colors.textPrimary }}>Accent</em>
                </div>
                <div className="settings-theme-swatches">{themePreview.swatches.map((color) => <span key={color} title={color} style={{ background: color }} />)}</div>
                <div className="settings-theme-preview-actions">
                  <button type="button" onClick={applyGeneratedTheme}>Apply theme</button>
                  <button type="button" onClick={() => setThemePreview(null)}>Discard</button>
                </div>
              </div>}
            </div>
            <div className="settings-wallpapers" aria-label="Saved wallpapers">
              {wallpapers.length === 0
                ? <p>No wallpapers added yet.</p>
                : wallpapers.map((wallpaper) => <div className={`settings-wallpaper${wallpaper === settings.theme.backgroundImage ? ' is-active' : ''}`} key={wallpaper}>
                  <button type="button" className="settings-wallpaper-preview" style={wallpaperPreviewStyle(wallpaper)} aria-label="Use wallpaper" onClick={() => selectWallpaper(wallpaper)}><span>{wallpaper}</span></button>
                  <button type="button" className="settings-wallpaper-remove" aria-label="Remove wallpaper" onClick={() => removeWallpaper(wallpaper)}><Trash2 size={13} aria-hidden="true" /></button>
                </div>)}
            </div>
            <div className="settings-theme-header">
              <strong>Theme colors</strong>
              <div>
                <button type="button" onClick={() => saveTheme()}><Save size={14} aria-hidden="true" />Save current</button>
                <button type="button" onClick={() => updateTheme({ ...defaultBrowserSettings.theme, savedThemes })}><RotateCcw size={14} aria-hidden="true" />Reset theme</button>
              </div>
            </div>
            <div className="settings-saved-themes" aria-label="Saved themes">
              {savedThemes.length === 0
                ? <p>No themes saved yet.</p>
                : savedThemes.map((theme) => <div className="settings-saved-theme" key={theme.id}>
                  <button type="button" className="settings-saved-theme-main" onClick={() => applySavedTheme(theme)}>
                    <span className="settings-saved-theme-colors">{Object.entries(theme.colors).slice(0, 5).map(([key, color]) => <i key={key} style={{ background: color }} />)}</span>
                    <strong title={theme.name}>{theme.name}</strong>
                    <small title={theme.source || undefined}>{theme.source || 'Manual theme'}</small>
                  </button>
                  {theme.id !== defaultSavedBrowserTheme.id && <button type="button" className="settings-saved-theme-remove" aria-label={`Remove ${theme.name}`} onClick={() => removeSavedTheme(theme.id)}><Trash2 size={13} aria-hidden="true" /></button>}
                </div>)}
            </div>
            <div className="settings-color-grid">
              <ColorField label="Background" value={settings.theme.colors.bgPrimary} onChange={(value) => updateColor('bgPrimary', value)} />
              <ColorField label="Panels" value={settings.theme.colors.bgSecondary} onChange={(value) => updateColor('bgSecondary', value)} />
              <ColorField label="Surface" value={settings.theme.colors.surface} onChange={(value) => updateColor('surface', value)} />
              <ColorField label="Text" value={settings.theme.colors.textPrimary} onChange={(value) => updateColor('textPrimary', value)} />
              <ColorField label="Muted text" value={settings.theme.colors.textMuted} onChange={(value) => updateColor('textMuted', value)} />
              <ColorField label="Accent" value={settings.theme.colors.accent} onChange={(value) => updateColor('accent', value)} />
              <ColorField label="Selection" value={settings.theme.colors.selection} onChange={(value) => updateColor('selection', value)} />
              <ColorField label="Border" value={settings.theme.colors.border} onChange={(value) => updateColor('border', value)} />
            </div>
          </>}
          {category === 'browser' && <>
            <Toggle label="Restore tabs" description="Reopen workspace tabs from the last session." checked={settings.restoreTabs} onChange={(checked) => update({ restoreTabs: checked })} />
            <Toggle label="Navigation buttons" description="Show back, forward, and reload controls." checked={settings.features.showNavigationControls} onChange={(checked) => updateFeature('showNavigationControls', checked)} />
            <Toggle label="Split controls" description="Show controls for side-by-side environments." checked={settings.features.showSplitControls} onChange={(checked) => updateFeature('showSplitControls', checked)} />
            <Toggle label="Downloads button" description="Show the downloads popover in the toolbar." checked={settings.features.showDownloads} onChange={(checked) => updateFeature('showDownloads', checked)} />
            <Toggle label="Local services button" description="Show the localhost scanner shortcut in the sidebar tools." checked={settings.features.showLocalServices} onChange={(checked) => updateFeature('showLocalServices', checked)} />
            <Toggle label="Git summary in sidebar" description="Show the compact repository summary under environments." checked={settings.features.showSourceControlSummary} onChange={(checked) => updateFeature('showSourceControlSummary', checked)} />
            <Toggle label="Device toolbar" description="Show viewport preset controls above the browser when Dev Panel is open." checked={settings.features.showDeviceToolbar} onChange={(checked) => updateFeature('showDeviceToolbar', checked)} />
          </>}
          {category === 'developer' && <>
            <Toggle label="Open Dev Panel by default" description="Show developer tools when the app starts." checked={settings.devPanelDefault} onChange={(checked) => update({ devPanelDefault: checked })} />
            <Toggle label="Preserve Network log" description="Keep requests across page navigations." checked={settings.networkPreserveLog} onChange={(checked) => update({ networkPreserveLog: checked })} />
            <Toggle label="Preserve Console log" description="Keep messages across page navigations." checked={settings.consolePreserveLog} onChange={(checked) => update({ consolePreserveLog: checked })} />
          </>}
          {category === 'workspaces' && <div className="settings-field"><label htmlFor="default-environment">Default environment</label><small>Preferred environment type when available in a workspace.</small><select id="default-environment" value={settings.defaultEnvironment ?? ''} onChange={(event) => update({ defaultEnvironment: event.target.value ? event.target.value as NonNullable<BrowserSettings['defaultEnvironment']> : null })}><option value="">None</option><option value="local">Local</option><option value="staging">Staging</option><option value="production">Production</option><option value="custom">Custom</option></select><p>{workspaceCount} workspace{workspaceCount === 1 ? '' : 's'} configured</p></div>}
          {error && <p className="settings-error" role="alert">{error}</p>}
        </div>
      </div>
    </section>
  </div>
}
