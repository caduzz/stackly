import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { BrowserSettings } from '../../../shared/contracts/browser'
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

export function SettingsPanel({ settings, workspaceCount, onChange, onClose }: Props): React.JSX.Element {
  const [category, setCategory] = useState<Category>('appearance')
  const [error, setError] = useState('')
  const panelRef = useRef<HTMLElement>(null)

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

  return <div className="settings-backdrop" role="presentation">
    <section ref={panelRef} className="settings-panel" role="dialog" aria-modal="true" aria-label="Settings">
      <header><div><strong>Settings</strong><span>Stackly preferences</span></div><IconButton icon={X} aria-label="Close settings" title="Close settings" onClick={onClose} /></header>
      <div className="settings-layout">
        <nav aria-label="Settings categories">{categories.map((item) => <button type="button" key={item.id} className={item.id === category ? 'is-active' : ''} aria-current={item.id === category ? 'page' : undefined} onClick={() => setCategory(item.id)}>{item.label}</button>)}</nav>
        <div className="settings-content">
          <h2>{categories.find((item) => item.id === category)?.label}</h2>
          {category === 'appearance' && <Toggle label="Show sidebar by default" description="Show the workspace sidebar when the app starts." checked={settings.sidebarDefault} onChange={(checked) => update({ sidebarDefault: checked })} />}
          {category === 'browser' && <Toggle label="Restore tabs" description="Keep this preference for session restoration support." checked={settings.restoreTabs} onChange={(checked) => update({ restoreTabs: checked })} />}
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
