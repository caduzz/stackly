import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Layers3, Minus, MoreHorizontal, PanelBottom, PanelLeft, Pencil, Plus, RotateCw, Sparkles, Square, Trash2, X } from 'lucide-react'
import { defaultBrowserSettings, viewportPresetSizes, type BrowserPreview, type BrowserSettings, type Environment, type ViewportPreset } from '../../shared/contracts/browser'
import { AddressBar } from './components/AddressBar'
import { CommandPalette } from './components/CommandPalette'
import { DevPanel, type DevPanelKind } from './components/DevPanel'
import { EnvironmentSwitcher } from './components/EnvironmentSwitcher'
import { IconButton } from './components/IconButton'
import { TabBar } from './components/TabBar'
import { LocalServicesPopover } from './components/LocalServicesPopover'
import { DownloadsPopover } from './components/DownloadsPopover'
import { DeviceToolbar } from './components/DeviceToolbar'
import { SettingsPanel } from './components/SettingsPanel'
import { TooltipLayer } from './components/TooltipLayer'
import { createCommands } from './commands/registry'
import { useTabsStore } from './stores/tabs'
import { useWorkspacesStore } from './stores/workspaces'

type SplitState = { environmentId: string | null; syncPath: boolean }

function Toolbar({ onOpenSettings, environments, split, onSplitChange }: { onOpenSettings: () => void; environments: Environment[]; split: SplitState; onSplitChange: (next: SplitState) => void }): React.JSX.Element {
  const [status, setStatus] = useState('')
  const activeTab = useTabsStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId))

  function runNavigation(action: () => Promise<void>): void {
    void action().then(() => setStatus('')).catch(() => setStatus('Navigation failed'))
  }

  return <header className="shell-toolbar">
    <div className="shell-brand">
      <span className="shell-brand-mark" aria-hidden="true"><Layers3 size={16} strokeWidth={1.75} /></span>
      <span>Stackly</span>
    </div>
    <div className="toolbar-navigation" aria-label="Browser controls">
      <div className="toolbar-history">
        <IconButton icon={ArrowLeft} aria-label="Back" title="Back" disabled={!activeTab?.canGoBack} onClick={() => runNavigation(window.devBrowser.navigation.back)} />
        <IconButton icon={ArrowRight} aria-label="Forward" title="Forward" disabled={!activeTab?.canGoForward} onClick={() => runNavigation(window.devBrowser.navigation.forward)} />
        <IconButton icon={RotateCw} aria-label="Reload" title="Reload" disabled={!activeTab} onClick={() => runNavigation(window.devBrowser.navigation.reload)} />
      </div>
      <AddressBar currentUrl={activeTab?.url ?? ''} onSubmit={(address) => runNavigation(async () => {
        if (!activeTab) await window.devBrowser.tabs.create()
        await window.devBrowser.navigation.navigate(address)
      })} />
      <div className="split-controls" aria-label="View layout">
        <button type="button" className={!split.environmentId ? 'is-active' : ''} onClick={() => onSplitChange({ ...split, environmentId: null })}>Single</button>
        <button type="button" className={split.environmentId ? 'is-active' : ''} disabled={environments.length < 2} onClick={() => onSplitChange({ ...split, environmentId: split.environmentId ?? environments[1]?.id ?? environments[0]?.id ?? null })}>Split</button>
        {split.environmentId && <select aria-label="Split environment" value={split.environmentId} onChange={(event) => onSplitChange({ ...split, environmentId: event.target.value })}>
          {environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
        </select>}
        {split.environmentId && <label className="split-sync"><input type="checkbox" checked={split.syncPath} onChange={(event) => onSplitChange({ ...split, syncPath: event.target.checked })} />Sync path</label>}
      </div>
      <DownloadsPopover />
      <IconButton icon={MoreHorizontal} aria-label="Settings" title="Settings" onClick={onOpenSettings} />
    </div>
    <span className="shell-build-label" aria-live="polite">{status || 'Development Build'}</span>
    <div className="shell-window-controls" aria-label="Window controls">
      <button type="button" aria-label="Minimize window" data-tooltip="Minimize" onClick={() => { void window.devBrowser.windowControls.minimize().catch(console.error) }}><Minus size={15} strokeWidth={1.75} /></button>
      <button type="button" aria-label="Maximize or restore window" data-tooltip="Maximize or restore" onClick={() => { void window.devBrowser.windowControls.toggleMaximize().catch(console.error) }}><Square size={13} strokeWidth={1.75} /></button>
      <button type="button" className="window-close" aria-label="Close window" data-tooltip="Close" onClick={() => { void window.devBrowser.windowControls.close().catch(console.error) }}><X size={15} strokeWidth={1.75} /></button>
    </div>
  </header>
}

function Sidebar({ collapsed, devPanelOpen, onToggle, onToggleDevPanel }: { collapsed: boolean; devPanelOpen: boolean; onToggle: () => void; onToggleDevPanel: () => void }): React.JSX.Element {
  const workspaces = useWorkspacesStore((state) => state.workspaces)
  const activeWorkspaceId = useWorkspacesStore((state) => state.activeWorkspaceId)
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId)
  const currentUrl = useTabsStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId)?.url ?? '')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  function renameWorkspace(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!editingId) return
    void window.devBrowser.workspaces.rename(editingId, name).then(() => { setEditingId(null); setError('') }).catch(() => setError('Enter a workspace name.'))
  }

  function deleteWorkspace(id: string, workspaceName: string): void {
    if (!window.confirm(`Delete workspace “${workspaceName}” and its browser session?`)) return
    void window.devBrowser.workspaces.delete(id).then(() => setError('')).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not delete workspace.'))
  }

  return <aside className={`shell-sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label="Sidebar">
    <div className="shell-section-heading">
      <IconButton icon={PanelLeft} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={onToggle} />
      <span>Workspaces</span>
      <IconButton className="workspace-create" icon={Plus} aria-label="Create workspace" title="Create workspace" onClick={() => {
        void window.devBrowser.workspaces.create().catch((error: unknown) => console.error('Failed to create workspace', error))
      }} />
    </div>
    <nav className="workspace-list" aria-label="Workspaces">
      {workspaces.map((workspace) => editingId === workspace.id
        ? <form className="workspace-edit" key={workspace.id} onSubmit={renameWorkspace}><input autoFocus aria-label="Workspace name" value={name} onChange={(event) => setName(event.target.value)} /><button type="submit" aria-label="Save workspace name" data-tooltip="Save"><Check size={14} /></button><button type="button" aria-label="Cancel workspace edit" data-tooltip="Cancel" onClick={() => setEditingId(null)}><X size={14} /></button></form>
        : <div className={`workspace-row${workspace.id === activeWorkspaceId ? ' is-active' : ''}`} key={workspace.id}>
          <button type="button" className="workspace-item" aria-label={collapsed ? workspace.name : undefined} data-tooltip={collapsed ? workspace.name : undefined} aria-current={workspace.id === activeWorkspaceId ? 'page' : undefined} onClick={() => { void window.devBrowser.workspaces.select(workspace.id).catch((cause: unknown) => console.error('Failed to select workspace', cause)) }}>{collapsed ? workspace.name.trim().charAt(0).toLocaleUpperCase() : workspace.name}</button>
          <button type="button" className="workspace-action" aria-label={`Edit ${workspace.name}`} data-tooltip="Edit workspace" onClick={() => { setEditingId(workspace.id); setName(workspace.name); setError('') }}><Pencil size={13} /></button>
          <button type="button" className="workspace-action workspace-action--delete" aria-label={`Delete ${workspace.name}`} data-tooltip={workspaces.length === 1 ? 'The last workspace cannot be deleted' : 'Delete workspace'} disabled={workspaces.length === 1} onClick={() => deleteWorkspace(workspace.id, workspace.name)}><Trash2 size={13} /></button>
        </div>)}
    </nav>
    {error && <p className="workspace-error" role="alert">{error}</p>}
    <EnvironmentSwitcher key={activeWorkspaceId} workspace={activeWorkspace} currentUrl={currentUrl} />
    <section className="sidebar-tools" aria-label="Tools">
      <span className="sidebar-tools-heading">Tools</span>
      <div className="sidebar-tools-actions">
        <IconButton icon={PanelBottom} aria-label={devPanelOpen ? 'Hide Dev Panel' : 'Show Dev Panel'} title={devPanelOpen ? 'Hide Dev Panel' : 'Show Dev Panel'} aria-expanded={devPanelOpen} onClick={onToggleDevPanel} />
        <LocalServicesPopover />
      </div>
    </section>
    <div className="shell-sidebar-footer">Workspace sessions are isolated.</div>
  </aside>
}

function BrowserArea({ empty, primaryLabel, secondaryLabel, preview, preset, showDeviceToolbar, onPresetChange }: { empty: boolean; primaryLabel: string; secondaryLabel: string | null; preview: BrowserPreview | null; preset: ViewportPreset; showDeviceToolbar: boolean; onPresetChange: (preset: ViewportPreset) => void }): React.JSX.Element {
  const areaRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const area = areaRef.current
    if (!area) return

    function reportBounds(): void {
      const currentArea = areaRef.current
      if (!currentArea) return
      const rect = currentArea.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const availableWidth = secondaryLabel ? Math.floor((rect.width - 1) / 2) : rect.width
      const requested = preset === 'responsive' ? null : viewportPresetSizes[preset]
      setDimensions({ width: Math.round(Math.min(availableWidth, requested?.width ?? availableWidth)), height: Math.round(Math.min(rect.height, requested?.height ?? rect.height)) })
      void window.devBrowser.layout.setBrowserBounds({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }).catch((error: unknown) => console.error('Failed to position browser view', error))
    }

    const observer = new ResizeObserver(reportBounds)
    observer.observe(area)
    window.addEventListener('resize', reportBounds)
    reportBounds()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reportBounds)
    }
  }, [preset, secondaryLabel])

  return <section className={`shell-browser-frame${secondaryLabel ? ' is-split' : ''}`} aria-label="Browser area">
    {showDeviceToolbar && !empty && <DeviceToolbar preset={preset} dimensions={dimensions} onChange={onPresetChange} />}
    {secondaryLabel && !empty && <div className="split-labels" aria-label="Split environments"><span>{primaryLabel}</span><span>{secondaryLabel}</span></div>}
    <div ref={areaRef} className="shell-browser">
      {empty ? <div className="browser-empty-state">
        <span className="browser-empty-icon" aria-hidden="true"><Sparkles size={26} strokeWidth={1.5} /></span>
        <div><h2>Estamos prontos</h2><p>Abra uma nova aba para começar a navegar.</p></div>
        <button type="button" onClick={() => { void window.devBrowser.tabs.create().catch(console.error) }}><Plus size={15} strokeWidth={1.75} aria-hidden="true" />Nova aba</button>
      </div> : preview && <div className={`browser-preview${preview.secondary ? ' is-split' : ''}`} aria-hidden="true">
        <div className="browser-preview-cell"><img src={preview.primary} alt="" /></div>
        {preview.secondary && <div className="browser-preview-cell"><img src={preview.secondary} alt="" /></div>}
      </div>}
    </div>
  </section>
}

export default function App(): React.JSX.Element {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [browserPreview, setBrowserPreview] = useState<BrowserPreview | null>(null)
  const [browserSettings, setBrowserSettings] = useState<BrowserSettings>(defaultBrowserSettings)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!defaultBrowserSettings.sidebarDefault)
  const [devPanelOpen, setDevPanelOpen] = useState(true)
  const [activePanel, setActivePanel] = useState<DevPanelKind>('network')
  const [panelHeight, setPanelHeight] = useState(240)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const workspaces = useWorkspacesStore((state) => state.workspaces)
  const activeWorkspaceId = useWorkspacesStore((state) => state.activeWorkspaceId)
  const [split, setSplit] = useState<SplitState>({ environmentId: null, syncPath: true })
  const [viewportPreset, setViewportPreset] = useState<ViewportPreset>('responsive')
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId)
  const currentUrl = useTabsStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId)?.url ?? '')
  const currentOrigin = (() => { try { return new URL(currentUrl).origin } catch { return '' } })()
  const primaryEnvironment = activeWorkspace?.environments.find((environment) => new URL(environment.baseUrl).origin === currentOrigin)
  const secondaryEnvironment = activeWorkspace?.environments.find((environment) => environment.id === split.environmentId)

  function updateSplit(next: SplitState): void {
    setSplit(next)
    void window.devBrowser.layout.setSplitView(next.environmentId, next.syncPath).catch((error: unknown) => console.error('Failed to update split view', error))
  }

  function updateViewportPreset(preset: ViewportPreset): void {
    setViewportPreset(preset)
    void window.devBrowser.layout.setViewportPreset(preset).catch((error: unknown) => console.error('Failed to update viewport preset', error))
  }

  useEffect(() => window.devBrowser.layout.onPreviewChange(setBrowserPreview), [])

  useEffect(() => {
    void window.devBrowser.settings.get().then((settings) => {
      setBrowserSettings(settings)
      setSidebarCollapsed(!settings.sidebarDefault)
      setDevPanelOpen(settings.devPanelDefault)
    }).catch((error: unknown) => console.error('Failed to read settings', error))
  }, [])

  useEffect(() => {
    setSplit({ environmentId: null, syncPath: true })
    void window.devBrowser.layout.setSplitView(null, true).catch(console.error)
  }, [activeWorkspaceId])

  useEffect(() => {
    if (split.environmentId && activeWorkspace && !activeWorkspace.environments.some((environment) => environment.id === split.environmentId)) {
      updateSplit({ environmentId: null, syncPath: split.syncPath })
    }
  }, [activeWorkspace, split.environmentId])

  useEffect(() => {
    const unsubscribe = window.devBrowser.palette.onToggle(() => setPaletteOpen((open) => !open))
    const unsubscribeClose = window.devBrowser.palette.onClose(() => setPaletteOpen(false))
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { unsubscribe(); unsubscribeClose(); document.removeEventListener('keydown', onKeyDown) }
  }, [])

  useEffect(() => {
    const applySnapshot = useTabsStore.getState().applySnapshot
    const unsubscribe = window.devBrowser.tabs.onStateChange(applySnapshot)
    void window.devBrowser.tabs.getState().then(applySnapshot).catch((error: unknown) => {
      console.error('Failed to read tabs state', error)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const applySnapshot = useWorkspacesStore.getState().applySnapshot
    const unsubscribe = window.devBrowser.workspaces.onStateChange(applySnapshot)
    void window.devBrowser.workspaces.getState().then(applySnapshot).catch((error: unknown) => {
      console.error('Failed to read workspaces state', error)
    })
    return unsubscribe
  }, [])

  const commands = createCommands({
    activeTabId,
    workspaces,
    activeWorkspaceId,
    toggleDevPanel: () => setDevPanelOpen((open) => !open),
    openPanel: (next) => { setActivePanel(next); setDevPanelOpen(true) },
    openSettings: () => setSettingsOpen(true)
  })

  async function updateSettings(next: BrowserSettings): Promise<void> {
    const saved = await window.devBrowser.settings.update(next)
    if (saved.sidebarDefault !== browserSettings.sidebarDefault) setSidebarCollapsed(!saved.sidebarDefault)
    if (saved.devPanelDefault !== browserSettings.devPanelDefault) setDevPanelOpen(saved.devPanelDefault)
    setBrowserSettings(saved)
  }

  return <main className="shell">
    <Toolbar onOpenSettings={() => setSettingsOpen(true)} environments={activeWorkspace?.environments ?? []} split={split} onSplitChange={updateSplit} />
    <div className="shell-workspace">
      <Sidebar collapsed={sidebarCollapsed} devPanelOpen={devPanelOpen} onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)} onToggleDevPanel={() => setDevPanelOpen((open) => !open)} />
      <div className="shell-content">
        <TabBar />
        <BrowserArea empty={!activeTabId} primaryLabel={primaryEnvironment?.name ?? 'Primary'} secondaryLabel={secondaryEnvironment?.name ?? null} preview={browserPreview} preset={viewportPreset} showDeviceToolbar={devPanelOpen} onPresetChange={updateViewportPreset} />
        {devPanelOpen && activeTabId && <DevPanel height={panelHeight} onHeightChange={setPanelHeight} activePanel={activePanel} onPanelChange={setActivePanel} onClose={() => setDevPanelOpen(false)} networkKey={`${activeWorkspaceId}:${activeTabId}`} />}
      </div>
    </div>
    {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
    {settingsOpen && <SettingsPanel settings={browserSettings} workspaceCount={workspaces.length} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />}
    <TooltipLayer />
  </main>
}
