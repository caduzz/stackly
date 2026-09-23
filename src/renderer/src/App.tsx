import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, Clock, ExternalLink, GitBranch, Layers3, Minus, MonitorSmartphone, MoreHorizontal, PanelBottom, PanelLeft, Pencil, Plus, RotateCw, Search, Settings, Sparkles, Square, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { z } from 'zod'
import { defaultBrowserSettings, viewportPresetSizes, type BrowserPreview, type BrowserSettings, type DevicesCanvasLayout, type Environment, type TabState, type ViewportPreset, type Workspace } from '../../shared/contracts/browser'
import { shortcutIdForKeyboardEvent } from '../../shared/shortcuts'
import { AddressBar } from './components/AddressBar'
import { CommandPalette } from './components/CommandPalette'
import { DevPanel, type DevPanelKind } from './components/DevPanel'
import { EnvironmentSwitcher } from './components/EnvironmentSwitcher'
import { IconButton } from './components/IconButton'
import { TabBar, type InternalTab } from './components/TabBar'
import { LocalServicesPopover } from './components/LocalServicesPopover'
import { DownloadsPopover } from './components/DownloadsPopover'
import { DeviceToolbar } from './components/DeviceToolbar'
import { HistoryPanel } from './components/HistoryPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { TooltipLayer } from './components/TooltipLayer'
import { createCommands } from './commands/registry'
import { CommitPage } from './features/source-control/components/CommitPage'
import { DiffPage } from './features/source-control/components/DiffPage'
import { SourceControlPanel } from './features/source-control/components/SourceControlPanel'
import { SourceControlSummary } from './features/source-control/components/SourceControlSummary'
import type { GitCommit, GitFileDiff } from './features/source-control/types'
import { normalizeAddress } from './normalizeAddress'
import { browserDom, setBrowserDomController } from './browserDomController'
import { devicePresetCategories, devicePresetsByCategory, instantiateDeviceFromPreset, type DevicePreset } from './devices/presets'
import { applyStartupTheme, startupConfig } from './startupTheme'
import { useDevicesCanvasStore, type VirtualDevice } from './stores/devicesCanvas'
import { useTabsStore } from './stores/tabs'
import { useWorkspacesStore } from './stores/workspaces'

type SplitState = { environmentId: string | null; syncPath: boolean }
type WorkspaceViewContext = { split: SplitState; viewportPresetByTab: Record<string, ViewportPreset> }
type InternalPage = { kind: 'commit'; commit: GitCommit } | { kind: 'diff'; diff: GitFileDiff }
type MountedWorkspace = { workspace: Workspace; tabs: TabState[]; activeTabId: string | null }
type ThemeStyle = CSSProperties & Record<`--${string}`, string>
type BrowserWebviewElement = HTMLElement & {
  loadURL: (url: string) => Promise<void>
  getURL: () => string
  getTitle: () => string
  isLoading: () => boolean
  canGoBack: () => boolean
  canGoForward: () => boolean
  goBack: () => void
  goForward: () => void
  reload: () => void
  stop: () => void
  getWebContentsId: () => number
  setAudioMuted: (muted: boolean) => void
  capturePage?: () => Promise<{ toDataURL: () => string }>
}
type WebviewFaviconEvent = Event & { favicons?: string[] }
type WebviewNewWindowEvent = Event & { url?: string; disposition?: string }
type WebviewFailLoadEvent = Event & { errorCode?: number; errorDescription?: string; validatedURL?: string; isMainFrame?: boolean }
type LoadFailure = { url: string; description: string }
const deviceSettingsSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  viewportWidth: z.number().int().min(240).max(2560),
  viewportHeight: z.number().int().min(240).max(2560),
  orientation: z.enum(['portrait', 'landscape'])
})

function defaultWorkspaceViewContext(): WorkspaceViewContext {
  return { split: { environmentId: null, syncPath: true }, viewportPresetByTab: {} }
}

function backgroundImageStyle(value: string): CSSProperties {
  const source = value.trim()
  if (!source) return {}
  const normalized = /^[A-Za-z]:[\\/]/.test(source) ? `file:///${source.replaceAll('\\', '/')}` : source
  const escaped = encodeURI(normalized).replaceAll('"', '\\"')
  return { backgroundImage: `linear-gradient(color-mix(in srgb, var(--color-bg-primary) 60%, transparent), color-mix(in srgb, var(--color-bg-primary) 74%, transparent)), url("${escaped}")` }
}

function themeStyle(settings: BrowserSettings): ThemeStyle {
  const { colors } = settings.theme
  return {
    '--color-bg-primary': colors.bgPrimary,
    '--color-bg-secondary': colors.bgSecondary,
    '--color-surface': colors.surface,
    '--color-text-primary': colors.textPrimary,
    '--color-text-muted': colors.textMuted,
    '--color-accent': colors.accent,
    '--color-selection': colors.selection,
    '--color-border': colors.border
  }
}

function Toolbar({ settings, onOpenHistory, onOpenSettings }: { settings: BrowserSettings; onOpenHistory: () => void; onOpenSettings: () => void }): React.JSX.Element {
  const [status, setStatus] = useState('')
  const activeTab = useTabsStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId))
  const selectedDevice = useDevicesCanvasStore((state) => state.devices.find((device) => device.id === state.selectedDeviceId))
  const currentUrl = activeTab?.kind === 'device' ? selectedDevice?.url ?? activeTab.url : activeTab?.url ?? ''

  function runNavigation(action: () => Promise<void>): void {
    void action().then(() => setStatus('')).catch(() => setStatus('Navigation failed'))
  }

  return <header className="shell-toolbar">
    <div className="shell-brand">
      <span className="shell-brand-mark" aria-hidden="true"><Layers3 size={16} strokeWidth={1.75} /></span>
      <span>Stackly</span>
    </div>
    <div className="toolbar-navigation" aria-label="Browser controls">
      {settings.features.showNavigationControls && <div className="toolbar-history">
        <IconButton icon={ArrowLeft} aria-label="Back" title="Back" disabled={!activeTab?.canGoBack} onClick={() => runNavigation(browserDom.back)} />
        <IconButton icon={ArrowRight} aria-label="Forward" title="Forward" disabled={!activeTab?.canGoForward} onClick={() => runNavigation(browserDom.forward)} />
        <IconButton icon={RotateCw} aria-label="Reload" title="Reload" disabled={!activeTab} onClick={() => runNavigation(browserDom.reload)} />
      </div>}
      <AddressBar currentUrl={currentUrl} onSubmit={(address) => runNavigation(async () => {
        if (!activeTab) await window.devBrowser.tabs.create()
        await browserDom.navigate(address)
      })} />
      {settings.features.showDownloads && <DownloadsPopover />}
      <IconButton icon={ExternalLink} aria-label="Open in system browser" title="Open in system browser" disabled={!currentUrl} onClick={() => {
        if (!currentUrl) return
        void window.devBrowser.navigation.openExternal(currentUrl).catch(() => setStatus('Could not open system browser'))
      }} />
      <IconButton icon={Clock} aria-label="History" title="History" onClick={onOpenHistory} />
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

function Sidebar({ collapsed, settings, environments, split, devPanelOpen, sourceControlOpen, onToggle, onToggleDevPanel, onToggleSourceControl, onSplitChange }: { collapsed: boolean; settings: BrowserSettings; environments: Environment[]; split: SplitState; devPanelOpen: boolean; sourceControlOpen: boolean; onToggle: () => void; onToggleDevPanel: () => void; onToggleSourceControl: () => void; onSplitChange: (next: SplitState) => void }): React.JSX.Element {
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
    {!collapsed && <div className="sidebar-scroll-region">
      <EnvironmentSwitcher key={activeWorkspaceId} workspace={activeWorkspace} currentUrl={currentUrl} />
      {settings.features.showSplitControls && <section className="sidebar-split" aria-label="View layout">
        <div className="sidebar-split-heading">
          <span>View</span>
          <div className="split-controls">
            <button type="button" className={!split.environmentId ? 'is-active' : ''} onClick={() => onSplitChange({ ...split, environmentId: null })}>Single</button>
            <button type="button" className={split.environmentId ? 'is-active' : ''} disabled={environments.length < 2} onClick={() => onSplitChange({ ...split, environmentId: split.environmentId ?? environments[1]?.id ?? environments[0]?.id ?? null })}>Split</button>
          </div>
        </div>
        {split.environmentId && <select aria-label="Split environment" value={split.environmentId} onChange={(event) => onSplitChange({ ...split, environmentId: event.target.value })}>
          {environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
        </select>}
        {split.environmentId && <label className="split-sync"><input type="checkbox" checked={split.syncPath} onChange={(event) => onSplitChange({ ...split, syncPath: event.target.checked })} />Sync path</label>}
      </section>}
      {settings.features.showSourceControlSummary && <SourceControlSummary key={`summary:${activeWorkspaceId}`} onOpen={onToggleSourceControl} />}
    </div>}
    <section className="sidebar-tools" aria-label="Tools">
      <span className="sidebar-tools-heading">Tools</span>
      <div className="sidebar-tools-actions">
        <IconButton icon={PanelBottom} aria-label={devPanelOpen ? 'Hide Dev Panel' : 'Show Dev Panel'} title={devPanelOpen ? 'Hide Dev Panel' : 'Show Dev Panel'} aria-expanded={devPanelOpen} onClick={onToggleDevPanel} />
        <IconButton className={sourceControlOpen ? 'is-active' : ''} icon={GitBranch} aria-label={sourceControlOpen ? 'Hide Source Control' : 'Show Source Control'} title={sourceControlOpen ? 'Hide Source Control' : 'Show Source Control'} aria-expanded={sourceControlOpen} onClick={onToggleSourceControl} />
        {settings.features.showLocalServices && <LocalServicesPopover />}
      </div>
    </section>
    <div className="shell-sidebar-footer">Workspace sessions are isolated.</div>
  </aside>
}

function SourceControlDrawer({ activeWorkspaceId, onClose, onOpenCommit, onOpenDiff }: { activeWorkspaceId: string; onClose: () => void; onOpenCommit: (commit: GitCommit) => void; onOpenDiff: (diff: GitFileDiff) => void }): React.JSX.Element {
  return <aside className="source-control-drawer" aria-label="Source Control">
    <div className="source-control-drawer-header">
      <div>
        <span>Repository</span>
        <strong>Git & GitHub</strong>
      </div>
      <IconButton icon={X} aria-label="Close Source Control" title="Close Source Control" onClick={onClose} />
    </div>
    <SourceControlPanel key={activeWorkspaceId} onOpenCommit={onOpenCommit} onOpenDiff={onOpenDiff} />
  </aside>
}

function EmptyBrowserState({ backgroundImage, hasActiveTab }: { backgroundImage: string; hasActiveTab: boolean }): React.JSX.Element {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('')

  function submitSearch(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const address = normalizeAddress(value)
    if (!address) return
    const ready = hasActiveTab ? Promise.resolve() : window.devBrowser.tabs.create()
    void ready.then(() => browserDom.navigate(address)).then(() => {
      setStatus('')
    }).catch((error: unknown) => {
      console.error('Failed to navigate from empty state', error)
      setStatus('Não foi possível abrir esse endereço.')
    })
  }

  return <div className={`browser-empty-state${backgroundImage.trim() ? ' has-background-image' : ''}`} style={backgroundImageStyle(backgroundImage)}>
    <span className="browser-empty-icon" aria-hidden="true"><Sparkles size={26} strokeWidth={1.5} /></span>
    <form className="browser-empty-search" onSubmit={submitSearch}>
      <Search size={17} strokeWidth={1.75} aria-hidden="true" />
      <input autoFocus aria-label="Pesquisar ou digitar endereço" placeholder="Pesquisar no Google ou digitar URL" value={value} onChange={(event) => setValue(event.target.value)} />
      <button type="submit">Abrir</button>
    </form>
    {status && <p className="browser-empty-error" role="alert">{status}</p>}
  </div>
}

function webviewSource(url: string): string {
  return url || 'about:blank'
}

function isIntentionalNavigationCancel(error: unknown): boolean {
  return error instanceof Error && (error.message.includes('ERR_ABORTED') || error.message.includes('ERR_FAILED'))
}

function failureMessage(description: unknown): string {
  return typeof description === 'string' && description.trim() ? description : 'The page could not be loaded.'
}

function BrowserWebview({ workspaceId, tabId, url, active, partition, register }: { workspaceId: string; tabId: string; url: string; active: boolean; partition: string; register: (id: string, view: BrowserWebviewElement | null) => void }): React.JSX.Element {
  const ref = useRef<BrowserWebviewElement>(null)
  const desiredUrl = useRef(url)
  const wasActive = useRef(false)
  const navigationSeq = useRef(0)
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<LoadFailure | null>(null)
  const viewKey = `${workspaceId}:${tabId}`

  function retryFailedNavigation(targetUrl: string): void {
    const view = ref.current
    if (!view) return
    try {
      if (view.isLoading()) view.stop()
    } catch { /* Webview may not be ready to stop yet. */ }
    setFailure(null)
    const navigationId = String(++navigationSeq.current)
    view.dataset.stacklyTargetUrl = targetUrl
    view.dataset.stacklyLoadingUrl = targetUrl
    view.dataset.stacklyNavigationId = navigationId
    void window.devBrowser.tabs.updateState({ id: tabId, url: targetUrl, title: new URL(targetUrl).hostname, isLoading: true }).catch(console.error)
    void view.loadURL(targetUrl).catch((error: unknown) => {
      if (view.dataset.stacklyNavigationId !== navigationId) return
      delete view.dataset.stacklyLoadingUrl
      delete view.dataset.stacklyTargetUrl
      delete view.dataset.stacklyNavigationId
      if (!isIntentionalNavigationCancel(error)) setFailure({ url: targetUrl, description: failureMessage(error) })
      void window.devBrowser.tabs.updateState({ id: tabId, url: targetUrl, title: new URL(targetUrl).hostname, isLoading: false }).catch(console.error)
      if (!isIntentionalNavigationCancel(error)) console.warn('Failed to retry browser webview URL', error)
    })
  }

  useEffect(() => {
    desiredUrl.current = url
  }, [url])

  useEffect(() => {
    const view = ref.current
    if (!view) return
    const webview = view
    webview.removeAttribute('allowpopups')

    function navigationTarget(): string {
      return webview.dataset.stacklyTargetUrl || desiredUrl.current
    }

    function isCurrentWorkspace(): boolean {
      return useWorkspacesStore.getState().activeWorkspaceId === workspaceId
    }

    function currentNavigationId(): string {
      return webview.dataset.stacklyNavigationId ?? ''
    }

    function reportLoadFailure(targetUrl: string, error: unknown, navigationId = currentNavigationId()): void {
      if (navigationId && currentNavigationId() && navigationId !== currentNavigationId()) return
      if (targetUrl !== navigationTarget() && targetUrl !== webview.dataset.stacklyLoadingUrl) return
      delete webview.dataset.stacklyLoadingUrl
      delete webview.dataset.stacklyTargetUrl
      delete webview.dataset.stacklyNavigationId
      if (!isCurrentWorkspace()) return
      const cancelled = isIntentionalNavigationCancel(error)
      if (!cancelled) setFailure({ url: targetUrl, description: failureMessage(error) })
      void window.devBrowser.tabs.updateState({
        id: tabId,
        url: targetUrl,
        title: new URL(targetUrl).hostname,
        isLoading: false
      }).catch(console.error)
      if (cancelled) return
      console.warn('Failed to load browser webview URL', error)
    }

    function loadTargetUrl(targetUrl: string): void {
      if (!targetUrl || webview.dataset.stacklyLoadingUrl === targetUrl) return
      let currentUrl = ''
      try {
        currentUrl = webview.getURL() === 'about:blank' ? '' : webview.getURL()
      } catch {
        currentUrl = ''
      }
      if (currentUrl === targetUrl) {
        delete webview.dataset.stacklyTargetUrl
        delete webview.dataset.stacklyLoadingUrl
        return
      }
      try {
        if (webview.isLoading()) webview.stop()
      } catch { /* Webview may not be ready to stop yet. */ }
      setFailure(null)
      const navigationId = String(++navigationSeq.current)
      webview.dataset.stacklyTargetUrl = targetUrl
      webview.dataset.stacklyLoadingUrl = targetUrl
      webview.dataset.stacklyNavigationId = navigationId
      void webview.loadURL(targetUrl).catch((error: unknown) => {
        reportLoadFailure(targetUrl, error, navigationId)
      })
    }

    function readState(isLoading?: boolean): { url: string; title: string; isLoading: boolean; canGoBack: boolean; canGoForward: boolean } | null {
      try {
        const currentUrl = webview.getURL()
        const pendingUrl = navigationTarget()
        const stateUrl = currentUrl === 'about:blank' ? pendingUrl : currentUrl
        if (pendingUrl && (currentUrl === 'about:blank' || (currentUrl !== pendingUrl && webview.dataset.stacklyTargetUrl))) {
          return {
            url: pendingUrl,
            title: new URL(pendingUrl).hostname,
            isLoading: true,
            canGoBack: webview.canGoBack(),
            canGoForward: webview.canGoForward()
          }
        }
        return {
          url: stateUrl,
          title: webview.getTitle() == 'about:blank' ? 'New Tab' : webview.getTitle(),
          isLoading: isLoading ?? webview.isLoading(),
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward()
        }
      } catch {
        return null
      }
    }

    function statePatch(isLoading?: boolean): void {
      if (!isCurrentWorkspace()) return
      const state = readState(isLoading)
      if (!state) return
      void window.devBrowser.tabs.updateState({
        id: tabId,
        ...state
      }).catch(console.error)
    }

    const domReady = (): void => {
      setReady(true)
      register(viewKey, webview)
      const pendingUrl = desiredUrl.current
      if (pendingUrl) {
        let currentUrl = ''
        try {
          currentUrl = webview.getURL() === 'about:blank' ? '' : webview.getURL()
        } catch {
          currentUrl = ''
        }
        if (currentUrl) statePatch()
        else loadTargetUrl(pendingUrl)
      } else statePatch()
    }
    const start = (): void => statePatch(true)
    const stop = (): void => statePatch(false)
    const navigate = (): void => {
      try {
        const currentUrl = webview.getURL()
        if (currentUrl && currentUrl !== 'about:blank') {
          delete webview.dataset.stacklyTargetUrl
          delete webview.dataset.stacklyLoadingUrl
          delete webview.dataset.stacklyNavigationId
          setFailure(null)
        }
      } catch { /* The webview may still be attaching. */ }
      statePatch()
    }
    const title = (): void => statePatch()
    const favicon = (event: WebviewFaviconEvent): void => {
      if (!isCurrentWorkspace()) return
      void window.devBrowser.tabs.updateState({ id: tabId, favicon: event.favicons?.[0] }).catch(console.error)
    }
    const failLoad = (event: WebviewFailLoadEvent): void => {
      if (event.isMainFrame === false || event.errorCode === -3) return
      const failedUrl = event.validatedURL || navigationTarget()
      if (!failedUrl) return
      reportLoadFailure(failedUrl, event.errorDescription ?? `Navigation failed (${event.errorCode ?? 'unknown'})`)
    }
    const newWindow = (event: WebviewNewWindowEvent): void => {
      event.preventDefault()
      if (!isCurrentWorkspace()) return
      if (!event.url || !/^https?:\/\//i.test(event.url)) return
      void window.devBrowser.tabs.create(event.url, event.disposition !== 'background-tab').catch(console.error)
    }

    webview.addEventListener('dom-ready', domReady)
    webview.addEventListener('did-start-loading', start)
    webview.addEventListener('did-stop-loading', stop)
    webview.addEventListener('did-navigate', navigate)
    webview.addEventListener('did-navigate-in-page', navigate)
    webview.addEventListener('page-title-updated', title)
    webview.addEventListener('page-favicon-updated', favicon)
    webview.addEventListener('did-fail-load', failLoad)
    webview.addEventListener('did-fail-provisional-load', failLoad)
    webview.addEventListener('new-window', newWindow)
    return () => {
      setReady(false)
      register(viewKey, null)
      if (isCurrentWorkspace()) void window.devBrowser.tabs.setWebContentsTarget({ tabId, webContentsId: null }).catch(console.error)
      webview.removeEventListener('dom-ready', domReady)
      webview.removeEventListener('did-start-loading', start)
      webview.removeEventListener('did-stop-loading', stop)
      webview.removeEventListener('did-navigate', navigate)
      webview.removeEventListener('did-navigate-in-page', navigate)
      webview.removeEventListener('page-title-updated', title)
      webview.removeEventListener('page-favicon-updated', favicon)
      webview.removeEventListener('did-fail-load', failLoad)
      webview.removeEventListener('did-fail-provisional-load', failLoad)
      webview.removeEventListener('new-window', newWindow)
    }
  }, [register, tabId, viewKey, workspaceId])

  useEffect(() => {
    const view = ref.current
    if (!view || !active || !ready) return
    let webContentsId: number
    try {
      webContentsId = view.getWebContentsId()
    } catch {
      return
    }
    void window.devBrowser.tabs.setWebContentsTarget({ tabId, webContentsId }).catch(console.error)
    try {
      const currentUrl = view.getURL() === 'about:blank' ? '' : view.getURL()
      if (currentUrl) void window.devBrowser.tabs.updateState({ id: tabId, url: currentUrl, title: view.getTitle() || new URL(currentUrl).hostname, isLoading: view.isLoading(), canGoBack: view.canGoBack(), canGoForward: view.canGoForward() }).catch(console.error)
    } catch { /* Webview state is best-effort while Electron attaches it. */ }
  }, [active, ready, tabId])

  useEffect(() => {
    const view = ref.current
    const becameActive = active && !wasActive.current
    wasActive.current = active
    if (!view || !active || !ready) return
    let current = ''
    try {
      current = view.getURL() === 'about:blank' ? '' : view.getURL()
    } catch {
      return
    }
    if (url && current !== url && view.dataset.stacklyLoadingUrl !== url) {
      if (becameActive && current) {
        void window.devBrowser.tabs.updateState({ id: tabId, url: current, title: view.getTitle() || new URL(current).hostname, isLoading: view.isLoading(), canGoBack: view.canGoBack(), canGoForward: view.canGoForward() }).catch(console.error)
        return
      }
      try {
        if (view.isLoading()) view.stop()
      } catch { /* Webview may not be ready to stop yet. */ }
      setFailure(null)
      const navigationId = String(++navigationSeq.current)
      view.dataset.stacklyTargetUrl = url
      view.dataset.stacklyLoadingUrl = url
      view.dataset.stacklyNavigationId = navigationId
      void view.loadURL(url).catch((error: unknown) => {
        if (view.dataset.stacklyNavigationId !== navigationId) return
        delete view.dataset.stacklyLoadingUrl
        delete view.dataset.stacklyTargetUrl
        delete view.dataset.stacklyNavigationId
        if (!isIntentionalNavigationCancel(error)) setFailure({ url, description: failureMessage(error) })
        void window.devBrowser.tabs.updateState({ id: tabId, url, title: new URL(url).hostname, isLoading: false }).catch(console.error)
        if (isIntentionalNavigationCancel(error)) return
        console.warn('Failed to load active browser webview URL', error)
      })
    }
  }, [active, ready, url])

  return <>
    <webview ref={ref} className={`browser-webview${active ? ' is-active' : ''}`} src={webviewSource('')} partition={partition} webpreferences="contextIsolation=yes,sandbox=yes" />
    {active && failure && <div className="browser-load-error" role="alert">
      <strong>This page could not be reached</strong>
      <span>{failure.url}</span>
      <p>{failure.description}</p>
      <button type="button" onClick={() => retryFailedNavigation(failure.url)}>Try again</button>
    </div>}
  </>
}

function splitUrl(primaryUrl: string, baseUrl: string | null): string {
  if (!baseUrl) return ''
  const base = new URL(baseUrl)
  try {
    const primary = new URL(primaryUrl)
    base.pathname = primary.pathname
    base.search = primary.search
    base.hash = primary.hash
  } catch { /* Blank primary tab opens the environment root. */ }
  return base.href
}

function AddDevicePopover({ onSelect }: { onSelect: (preset: DevicePreset) => void }): React.JSX.Element {
  return <div className="devices-add-popover" role="menu" aria-label="Add device">
    {devicePresetCategories.map((category) => {
      const presets = devicePresetsByCategory(category)
      return <section key={category}>
        <h3>{category}</h3>
        {presets.map((preset) => <button key={preset.id} type="button" role="menuitem" onClick={() => onSelect(preset)}>
          <span>{preset.name}</span>
          <small>{preset.viewportWidth} × {preset.viewportHeight}</small>
        </button>)}
      </section>
    })}
  </div>
}

function CanvasToolbar({ addOpen, syncNavigation, zoom, onAddClick, onFitToScreen, onPresetSelect, onResponsive, onResetView, onResetZoom, onSyncNavigationChange, onZoomIn, onZoomOut }: { addOpen: boolean; syncNavigation: boolean; zoom: number; onAddClick: () => void; onFitToScreen: () => void; onPresetSelect: (preset: DevicePreset) => void; onResponsive: () => void; onResetView: () => void; onResetZoom: () => void; onSyncNavigationChange: (enabled: boolean) => void; onZoomIn: () => void; onZoomOut: () => void }): React.JSX.Element {
  return <div className="devices-canvas-toolbar" aria-label="Devices Canvas toolbar">
    <div className="devices-canvas-title">
      <MonitorSmartphone size={15} strokeWidth={1.7} aria-hidden="true" />
      <strong>Devices Canvas</strong>
    </div>
    <div className="devices-sync-controls" aria-label="Device navigation mode">
      <button type="button" className={!syncNavigation ? 'is-active' : ''} aria-pressed={!syncNavigation} onClick={() => onSyncNavigationChange(false)}>Independent</button>
      <button type="button" className={syncNavigation ? 'is-active' : ''} aria-pressed={syncNavigation} onClick={() => onSyncNavigationChange(true)}>Sync Navigation</button>
    </div>
    <div className="devices-zoom-controls" aria-label="Canvas zoom controls">
      <button type="button" className="devices-canvas-icon-button" aria-label="Zoom out" onClick={onZoomOut}><ZoomOut size={14} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" className="devices-canvas-zoom" aria-label="Reset zoom" onClick={onResetZoom}>{Math.round(zoom * 100)}%</button>
      <button type="button" className="devices-canvas-icon-button" aria-label="Zoom in" onClick={onZoomIn}><ZoomIn size={14} strokeWidth={1.8} aria-hidden="true" /></button>
    </div>
    <div className="devices-add">
      <button type="button" className="devices-canvas-button" aria-expanded={addOpen} onClick={onAddClick}><Plus size={15} strokeWidth={1.8} aria-hidden="true" /> Add Device</button>
      {addOpen && <AddDevicePopover onSelect={onPresetSelect} />}
    </div>
    <button type="button" className="devices-canvas-button is-secondary" onClick={onFitToScreen}>Fit to Screen</button>
    <button type="button" className="devices-canvas-button is-secondary" onClick={onResetView}>Reset View</button>
    <button type="button" className="devices-canvas-button is-secondary" onClick={onResponsive}>Responsive</button>
  </div>
}

function DevicesCanvasEmptyState({ onAddClick }: { onAddClick: () => void }): React.JSX.Element {
  return <div className="devices-canvas-empty">
    <span className="devices-canvas-icon" aria-hidden="true"><MonitorSmartphone size={28} strokeWidth={1.6} /></span>
    <div>
      <h2>Devices Canvas</h2>
      <p>Preview your application across multiple devices.</p>
    </div>
    <button type="button" className="devices-canvas-button" onClick={onAddClick}><Plus size={16} strokeWidth={1.8} aria-hidden="true" /> Add Device</button>
  </div>
}

function deviceViewportSize(device: VirtualDevice): { width: number; height: number } {
  return device.orientation === 'landscape'
    ? { width: device.viewportHeight, height: device.viewportWidth }
    : { width: device.viewportWidth, height: device.viewportHeight }
}

function deviceViewportVisualSize(device: VirtualDevice): { width: number; height: number } {
  const viewport = deviceViewportSize(device)
  const baseMax = device.type === 'tablet' ? 340 : 240
  const baseScale = Math.min(0.38, baseMax / Math.max(viewport.width, viewport.height))
  const scale = baseScale * (device.displayScale ?? 1)
  return {
    width: Math.max(76, Math.round(viewport.width * scale)),
    height: Math.max(104, Math.round(viewport.height * scale))
  }
}

function visualDeviceFrameSize(device: VirtualDevice): { width: number; height: number } {
  const viewport = deviceViewportVisualSize(device)
  return {
    width: viewport.width + (device.type === 'tablet' ? 66 : 56),
    height: viewport.height + (device.type === 'tablet' ? 62 : 52)
  }
}

function deviceEnvironmentUrl(currentUrl: string, environment: Environment | null): string {
  if (!environment) return currentUrl
  const base = new URL(environment.baseUrl)
  try {
    const current = new URL(currentUrl)
    if (current.protocol === 'http:' || current.protocol === 'https:') {
      base.pathname = current.pathname
      base.search = current.search
      base.hash = current.hash
    }
  } catch { /* Blank devices open the environment root. */ }
  return base.href
}

function deviceRouteDestination(currentUrl: string, sourceUrl: string): string | null {
  try {
    const source = new URL(sourceUrl)
    const destination = new URL(currentUrl)
    destination.pathname = source.pathname
    destination.search = source.search
    destination.hash = source.hash
    return destination.href
  } catch {
    return null
  }
}

function DeviceSettingsPopover({ device, environments, onApply, onClose }: { device: VirtualDevice; environments: Environment[]; onApply: (id: string, patch: Partial<Omit<VirtualDevice, 'id'>>) => void; onClose: () => void }): React.JSX.Element {
  const [name, setName] = useState(device.name)
  const [width, setWidth] = useState(String(device.viewportWidth))
  const [height, setHeight] = useState(String(device.viewportHeight))
  const [orientation, setOrientation] = useState(device.orientation)
  const [environmentId, setEnvironmentId] = useState(device.environmentId ?? '')
  const [error, setError] = useState('')

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const parsed = deviceSettingsSchema.safeParse({
      name,
      viewportWidth: Number(width),
      viewportHeight: Number(height),
      orientation
    })
    if (!parsed.success) {
      setError('Use dimensões entre 240 e 2560.')
      return
    }
    const environment = environments.find((item) => item.id === environmentId) ?? null
    onApply(device.id, { ...parsed.data, type: 'custom', environmentId: environment?.id ?? null, url: deviceEnvironmentUrl(device.url, environment) })
    onClose()
  }

  return <form className="device-settings-popover" aria-label={`${device.name} settings`} onSubmit={submit} onPointerDown={(event) => event.stopPropagation()}>
    <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Viewport Width<input inputMode="numeric" type="number" min={240} max={2560} value={width} onChange={(event) => setWidth(event.target.value)} /></label>
    <label>Viewport Height<input inputMode="numeric" type="number" min={240} max={2560} value={height} onChange={(event) => setHeight(event.target.value)} /></label>
    <label>Orientation<select value={orientation} onChange={(event) => setOrientation(event.target.value as VirtualDevice['orientation'])}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
    <label>Environment<select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}><option value="">Current URL</option>{environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}</select></label>
    {error && <p role="alert">{error}</p>}
    <div>
      <button type="button" onClick={onClose}>Cancel</button>
      <button type="submit">Apply</button>
    </div>
  </form>
}

function DeviceFrame({ device, environments, isMuted, partition, tabId, zoom, onApplySettings, onCaptureScreenshot, onMove, onNavigate, onRemove, onResize, onRotate, onSelect }: { device: VirtualDevice; environments: Environment[]; isMuted: boolean; partition: string; tabId: string | null; zoom: number; onApplySettings: (id: string, patch: Partial<Omit<VirtualDevice, 'id'>>) => void; onCaptureScreenshot: (id: string, view: BrowserWebviewElement | null) => void; onMove: (id: string, position: { x: number; y: number }) => void; onNavigate: (id: string, url: string) => void; onRemove: (id: string) => void; onResize: (id: string, displayScale: number) => void; onRotate: (id: string) => void; onSelect: (id: string) => void }): React.JSX.Element {
  const drag = useRef<{ pointerId: number; pointerX: number; pointerY: number; originX: number; originY: number } | null>(null)
  const resize = useRef<{ pointerId: number; pointerX: number; pointerY: number; originScale: number } | null>(null)
  const webviewRef = useRef<BrowserWebviewElement | null>(null)
  const navigationSeq = useRef(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [failure, setFailure] = useState<LoadFailure | null>(null)
  const [address, setAddress] = useState(device.url)
  const [navigationState, setNavigationState] = useState({ canGoBack: false, canGoForward: false, isLoading: false })
  const viewport = deviceViewportSize(device)
  const viewportVisual = deviceViewportVisualSize(device)
  const viewportWidth = viewportVisual.width
  const viewportHeight = viewportVisual.height
  const frame = visualDeviceFrameSize(device)
  const environment = environments.find((item) => item.id === device.environmentId) ?? null

  useEffect(() => {
    setAddress(device.url)
  }, [device.url])

  function startDrag(event: React.PointerEvent<HTMLElement>): void {
    if (event.button !== 0) return
    onSelect(device.id)
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, originX: device.x, originY: device.y }
  }

  function moveDrag(event: React.PointerEvent<HTMLElement>): void {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    onMove(device.id, {
      x: Math.round(current.originX + (event.clientX - current.pointerX) / zoom),
      y: Math.round(current.originY + (event.clientY - current.pointerY) / zoom)
    })
  }

  function stopDrag(event: React.PointerEvent<HTMLElement>): void {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function startResize(event: React.PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) return
    event.stopPropagation()
    onSelect(device.id)
    event.currentTarget.setPointerCapture(event.pointerId)
    resize.current = { pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, originScale: device.displayScale ?? 1 }
  }

  function moveResize(event: React.PointerEvent<HTMLButtonElement>): void {
    const current = resize.current
    if (!current || current.pointerId !== event.pointerId) return
    event.stopPropagation()
    const delta = ((event.clientX - current.pointerX) + (event.clientY - current.pointerY)) / 2
    const nextScale = Math.min(3, Math.max(0.55, Number((current.originScale + delta / (150 * zoom)).toFixed(2))))
    onResize(device.id, nextScale)
  }

  function stopResize(event: React.PointerEvent<HTMLButtonElement>): void {
    if (resize.current?.pointerId !== event.pointerId) return
    event.stopPropagation()
    resize.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return
    webview.removeAttribute('allowpopups')
    webview.dataset.stacklyTargetUrl = device.url
    webview.dataset.stacklyNavigationId = String(++navigationSeq.current)
    const currentUrl = (): string => {
      try { return webview.getURL() } catch { return '' }
    }
    const syncUrl = (): void => {
      const url = currentUrl()
      if (!url || url === 'about:blank') return
      delete webview.dataset.stacklyTargetUrl
      delete webview.dataset.stacklyNavigationId
      setFailure(null)
      setAddress(url)
      setNavigationState({ canGoBack: webview.canGoBack(), canGoForward: webview.canGoForward(), isLoading: webview.isLoading() })
      onNavigate(device.id, url)
      void window.devBrowser.history.record({ url, title: webview.getTitle() || new URL(url).hostname }).catch(console.error)
    }
    const start = (): void => setNavigationState({ canGoBack: webview.canGoBack(), canGoForward: webview.canGoForward(), isLoading: true })
    const domReady = (): void => {
      delete webview.dataset.stacklyLoadingUrl
    }
    const stop = (): void => {
      delete webview.dataset.stacklyLoadingUrl
      syncUrl()
    }
    const failLoad = (event: Event): void => {
      const fail = event as WebviewFailLoadEvent
      if (fail.isMainFrame === false || fail.errorCode === -3) return
      const failedUrl = fail.validatedURL || webview.dataset.stacklyTargetUrl || device.url
      delete webview.dataset.stacklyLoadingUrl
      delete webview.dataset.stacklyTargetUrl
      delete webview.dataset.stacklyNavigationId
      setNavigationState({ canGoBack: webview.canGoBack(), canGoForward: webview.canGoForward(), isLoading: false })
      setFailure({ url: failedUrl, description: failureMessage(fail.errorDescription ?? `Navigation failed (${fail.errorCode ?? 'unknown'})`) })
    }
    webview.addEventListener('dom-ready', domReady)
    webview.addEventListener('did-start-loading', start)
    webview.addEventListener('did-stop-loading', stop)
    webview.addEventListener('did-navigate', syncUrl)
    webview.addEventListener('did-navigate-in-page', syncUrl)
    webview.addEventListener('did-fail-load', failLoad)
    webview.addEventListener('did-fail-provisional-load', failLoad)
    return () => {
      webview.removeEventListener('dom-ready', domReady)
      webview.removeEventListener('did-start-loading', start)
      webview.removeEventListener('did-stop-loading', stop)
      webview.removeEventListener('did-navigate', syncUrl)
      webview.removeEventListener('did-navigate-in-page', syncUrl)
      webview.removeEventListener('did-fail-load', failLoad)
      webview.removeEventListener('did-fail-provisional-load', failLoad)
    }
  }, [device.id, device.url, onNavigate, tabId])

  useEffect(() => {
    try {
      webviewRef.current?.setAudioMuted(isMuted)
    } catch { /* Device webview may still be attaching. */ }
  }, [isMuted])

  function reloadDeviceWebview(): void {
    setFailure(null)
    webviewRef.current?.reload()
  }

  function navigateDevice(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const destination = normalizeAddress(address)
    if (!destination) return
    setFailure(null)
    setAddress(destination)
    onNavigate(device.id, destination)
  }

  function retryDeviceWebview(): void {
    const webview = webviewRef.current
    if (!webview || !failure) return
    setFailure(null)
    try {
      if (webview.isLoading()) webview.stop()
    } catch { /* Device webview may not be ready to stop yet. */ }
    webview.dataset.stacklyTargetUrl = failure.url
    webview.dataset.stacklyNavigationId = String(++navigationSeq.current)
    void webview.loadURL(failure.url).catch((error: unknown) => {
      if (!isIntentionalNavigationCancel(error)) setFailure({ url: failure.url, description: failureMessage(error) })
    })
  }

  function stopDeviceControl(event: React.PointerEvent<HTMLButtonElement>): void {
    event.stopPropagation()
  }

  return <article className={`device-frame device-frame--${device.type}${device.isSelected ? ' is-selected' : ''}`} style={{ left: device.x, top: device.y, width: frame.width, height: frame.height, zIndex: device.zIndex } as CSSProperties} onPointerDown={() => onSelect(device.id)}>
    <header className="device-frame-handle" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
      <div>
        <strong>{device.name}</strong>
        <span>{viewport.width} × {viewport.height}</span>
      </div>
    </header>
    <div className="device-frame-controls" aria-label={`${device.name} controls`} onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" aria-label={`Back ${device.name}`} data-tooltip="Back" disabled={!navigationState.canGoBack} onPointerDown={stopDeviceControl} onClick={(event) => {
        event.stopPropagation()
        webviewRef.current?.goBack()
      }}><ArrowLeft size={13} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" aria-label={`Forward ${device.name}`} data-tooltip="Forward" disabled={!navigationState.canGoForward} onPointerDown={stopDeviceControl} onClick={(event) => {
        event.stopPropagation()
        webviewRef.current?.goForward()
      }}><ArrowRight size={13} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" aria-label={`Reload ${device.name}`} data-tooltip="Reload" onPointerDown={stopDeviceControl} onClick={(event) => {
        event.stopPropagation()
        reloadDeviceWebview()
      }}><RotateCw size={13} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" aria-label={`Rotate ${device.name}`} data-tooltip="Rotate" onPointerDown={stopDeviceControl} onClick={(event) => {
        event.stopPropagation()
        onRotate(device.id)
      }}><MonitorSmartphone size={13} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" aria-label={`Settings ${device.name}`} data-tooltip="Settings" onPointerDown={stopDeviceControl} onClick={(event) => {
        event.stopPropagation()
        setSettingsOpen((open) => !open)
      }}><Settings size={13} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" aria-label={`Capture screenshot ${device.name}`} data-tooltip="Capture Screenshot" onPointerDown={stopDeviceControl} onClick={(event) => {
        event.stopPropagation()
        onCaptureScreenshot(device.id, webviewRef.current)
      }}><Camera size={13} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" aria-label={`Remove ${device.name}`} data-tooltip="Remove" onPointerDown={stopDeviceControl} onClick={(event) => {
        event.stopPropagation()
        onRemove(device.id)
      }}><Trash2 size={13} strokeWidth={1.8} aria-hidden="true" /></button>
    </div>
    {environment && <span className={`device-frame-environment${environment.kind === 'production' ? ' is-production' : ''}`}>{environment.name}</span>}
    {settingsOpen && <DeviceSettingsPopover device={device} environments={environments} onApply={onApplySettings} onClose={() => setSettingsOpen(false)} />}
    <form className="device-frame-address" onSubmit={navigateDevice} onPointerDown={(event) => event.stopPropagation()}>
      <input aria-label={`${device.name} address`} value={address} onChange={(event) => setAddress(event.target.value)} />
      <button type="submit" disabled={navigationState.isLoading}>{navigationState.isLoading ? 'Loading' : 'Go'}</button>
    </form>
    <div className="device-frame-body">
      <div className="device-frame-screen" style={{ width: viewportWidth, height: viewportHeight } as CSSProperties}>
        <div className="device-frame-viewport">
          <webview ref={webviewRef} className="device-frame-webview" data-device-id={device.id} src={webviewSource(device.url)} partition={partition} webpreferences="contextIsolation=yes,sandbox=yes" />
          {failure && <div className="device-load-error" role="alert">
            <strong>Page failed</strong>
            <span>{failure.description}</span>
            <button type="button" onPointerDown={stopDeviceControl} onClick={(event) => { event.stopPropagation(); retryDeviceWebview() }}>Try again</button>
          </div>}
        </div>
      </div>
    </div>
    <button type="button" className="device-frame-resize" aria-label={`Resize ${device.name}`} data-tooltip="Resize" onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={stopResize} onPointerCancel={stopResize} />
  </article>
}

function CanvasViewport({ activeTabId, devices, environments, isMuted, pan, partition, spacePressed, viewportRef, zoom, onAddClick, onApplySettings, onCaptureScreenshot, onMove, onNavigate, onPan, onRemove, onResize, onRotate, onSelect }: { activeTabId: string | null; devices: VirtualDevice[]; environments: Environment[]; isMuted: boolean; pan: { x: number; y: number }; partition: string; spacePressed: boolean; viewportRef: React.RefObject<HTMLDivElement | null>; zoom: number; onAddClick: () => void; onApplySettings: (id: string, patch: Partial<Omit<VirtualDevice, 'id'>>) => void; onCaptureScreenshot: (id: string, view: BrowserWebviewElement | null) => void; onMove: (id: string, position: { x: number; y: number }) => void; onNavigate: (id: string, url: string) => void; onPan: (pan: { x: number; y: number }) => void; onRemove: (id: string) => void; onResize: (id: string, displayScale: number) => void; onRotate: (id: string) => void; onSelect: (id: string | null) => void }): React.JSX.Element {
  const panDrag = useRef<{ pointerId: number; pointerX: number; pointerY: number; originX: number; originY: number } | null>(null)

  function startPan(event: React.PointerEvent<HTMLDivElement>): void {
    const middleButton = event.button === 1
    const spaceDrag = event.button === 0 && spacePressed
    if (!middleButton && !spaceDrag) return
    if (!middleButton && (event.target as HTMLElement).closest('.device-frame')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    panDrag.current = { pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, originX: pan.x, originY: pan.y }
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>): void {
    const current = panDrag.current
    if (!current || current.pointerId !== event.pointerId) return
    onPan({
      x: Math.round(current.originX + event.clientX - current.pointerX),
      y: Math.round(current.originY + event.clientY - current.pointerY)
    })
  }

  function stopPan(event: React.PointerEvent<HTMLDivElement>): void {
    if (panDrag.current?.pointerId !== event.pointerId) return
    panDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function stopMiddleClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (event.button !== 1) return
    event.preventDefault()
  }

  return <div ref={viewportRef} className={`devices-canvas-viewport${spacePressed ? ' is-space-panning' : ''}${panDrag.current ? ' is-panning' : ''}`} onPointerDown={(event) => {
    if (event.target === event.currentTarget) onSelect(null)
    startPan(event)
  }} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onAuxClick={stopMiddleClick}>
    <div className="devices-canvas-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` } as CSSProperties}>
      {devices.length === 0 ? <DevicesCanvasEmptyState onAddClick={onAddClick} /> : devices.map((device) => <DeviceFrame key={device.id} device={device} environments={environments} isMuted={isMuted} partition={partition} tabId={activeTabId} zoom={zoom} onApplySettings={onApplySettings} onCaptureScreenshot={onCaptureScreenshot} onMove={onMove} onNavigate={onNavigate} onRemove={onRemove} onResize={onResize} onRotate={onRotate} onSelect={onSelect} />)}
    </div>
  </div>
}

function DevicesCanvas({ currentUrl, onResponsive }: { currentUrl: string; onResponsive: () => void }): React.JSX.Element {
  const [addOpen, setAddOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [spacePressed, setSpacePressed] = useState(false)
  const [syncNavigation, setSyncNavigation] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const hydratedCanvasKey = useRef<string | null>(null)
  const lastSavedLayout = useRef('')
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const activeTab = useTabsStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId))
  const activeWorkspaceId = useWorkspacesStore((state) => state.activeWorkspaceId)
  const activeWorkspace = useWorkspacesStore((state) => state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId))
  const devices = useDevicesCanvasStore((state) => state.devices)
  const selectedDeviceId = useDevicesCanvasStore((state) => state.selectedDeviceId)
  const addDevice = useDevicesCanvasStore((state) => state.addDevice)
  const removeDevice = useDevicesCanvasStore((state) => state.removeDevice)
  const replaceLayout = useDevicesCanvasStore((state) => state.replaceLayout)
  const selectDevice = useDevicesCanvasStore((state) => state.selectDevice)
  const updateDevice = useDevicesCanvasStore((state) => state.updateDevice)
  const updatePosition = useDevicesCanvasStore((state) => state.updatePosition)

  function addPreset(preset: DevicePreset): void {
    const index = devices.length
    const activeEnvironment = activeWorkspace?.environments.find((environment) => environment.id === activeWorkspace.activeEnvironmentId) ?? null
    addDevice(instantiateDeviceFromPreset(preset, {
      x: 72 + index * 36,
      y: 72 + index * 32,
      url: deviceEnvironmentUrl(currentUrl === 'about:blank' ? '' : currentUrl, activeEnvironment),
      environmentId: activeEnvironment?.id ?? null
    }))
    setAddOpen(false)
  }

  function setClampedZoom(next: number): void {
    setZoom(Math.min(2, Math.max(0.25, Number(next.toFixed(2)))))
  }

  function resetView(): void {
    setPan({ x: 0, y: 0 })
    setClampedZoom(1)
  }

  function captureDeviceScreenshot(id: string, view: BrowserWebviewElement | null): void {
    if (!view?.capturePage) return
    void view.capturePage().then((image) => {
      const anchor = document.createElement('a')
      anchor.href = image.toDataURL()
      anchor.download = `stackly-${id}.png`
      anchor.click()
    }).catch((error: unknown) => console.error('Failed to capture device screenshot', error))
  }

  const handleDeviceNavigate = useCallback((id: string, url: string): void => {
    const source = devices.find((device) => device.id === id)
    if (!source || source.url === url) return
    updateDevice(id, { url })
    if (!syncNavigation) return
    for (const device of devices) {
      if (device.id === id) continue
      const destination = deviceRouteDestination(device.url, url)
      if (destination && destination !== device.url) updateDevice(device.id, { url: destination })
    }
  }, [devices, syncNavigation, updateDevice])

  function resizeDevice(id: string, displayScale: number): void {
    updateDevice(id, { displayScale })
  }

  function rotateDevice(id: string): void {
    const device = devices.find((item) => item.id === id)
    if (!device) return
    updateDevice(id, { orientation: device.orientation === 'portrait' ? 'landscape' : 'portrait' })
  }

  function fitToScreen(): void {
    const viewport = viewportRef.current
    if (!viewport || devices.length === 0) {
      resetView()
      return
    }
    const bounds = deviceBounds(devices)
    const margin = 64
    const availableWidth = Math.max(1, viewport.clientWidth - margin * 2)
    const availableHeight = Math.max(1, viewport.clientHeight - margin * 2)
    const nextZoom = Math.min(2, Math.max(0.25, Math.min(availableWidth / bounds.width, availableHeight / bounds.height)))
    setZoom(Number(nextZoom.toFixed(2)))
    setPan({
      x: Math.round((viewport.clientWidth - bounds.width * nextZoom) / 2 - bounds.x * nextZoom),
      y: Math.round((viewport.clientHeight - bounds.height * nextZoom) / 2 - bounds.y * nextZoom)
    })
  }

  useEffect(() => {
    function updateSpace(event: KeyboardEvent): void {
      if (event.code !== 'Space') return
      const target = event.target as HTMLElement | null
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') || target?.isContentEditable) return
      setSpacePressed(event.type === 'keydown')
      if (event.type === 'keydown') event.preventDefault()
    }
    window.addEventListener('keydown', updateSpace)
    window.addEventListener('keyup', updateSpace)
    return () => {
      window.removeEventListener('keydown', updateSpace)
      window.removeEventListener('keyup', updateSpace)
    }
  }, [])

  useEffect(() => {
    const canvasKey = activeWorkspaceId && activeTabId ? `${activeWorkspaceId}:${activeTabId}` : null
    let cancelled = false
    hydratedCanvasKey.current = null
    lastSavedLayout.current = ''
    replaceLayout([], null)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setSyncNavigation(false)
    if (!activeTabId || !canvasKey) return
    void window.devBrowser.devices.getLayout(activeTabId).then((layout) => {
      if (cancelled) return
      if (layout) {
        replaceLayout(layout.devices, layout.selectedDeviceId)
        setZoom(layout.zoom)
        setPan(layout.pan)
        setSyncNavigation(layout.syncNavigation)
        lastSavedLayout.current = JSON.stringify(layout)
      } else {
        replaceLayout([], null)
        setZoom(1)
        setPan({ x: 0, y: 0 })
        setSyncNavigation(false)
      }
      hydratedCanvasKey.current = canvasKey
      if (!layout && activeTab?.kind === 'device') {
        const preset = devicePresetsByCategory('Mobile')[1] ?? devicePresetsByCategory('Mobile')[0]
        const activeEnvironment = activeWorkspace?.environments.find((environment) => environment.id === activeWorkspace.activeEnvironmentId) ?? null
        addDevice(instantiateDeviceFromPreset(preset, { x: 72, y: 72, url: deviceEnvironmentUrl(currentUrl === 'about:blank' ? '' : currentUrl, activeEnvironment), environmentId: activeEnvironment?.id ?? null }))
      }
    }).catch((error: unknown) => {
      if (cancelled) return
      console.error('Failed to load devices canvas layout', error)
      hydratedCanvasKey.current = canvasKey
    })
    return () => { cancelled = true }
  }, [activeTab?.kind, activeTabId, activeWorkspace, activeWorkspaceId, addDevice, currentUrl, replaceLayout])

  useEffect(() => {
    if (activeTab?.kind !== 'device') return
    const selectedId = selectedDeviceId ?? devices[0]?.id ?? null
    setBrowserDomController({
      navigate: async (url) => {
        if (selectedId) updateDevice(selectedId, { url })
      },
      back: async () => { deviceWebview(selectedId)?.goBack() },
      forward: async () => { deviceWebview(selectedId)?.goForward() },
      reload: async () => { deviceWebview(selectedId)?.reload() }
    })
  }, [activeTab?.kind, devices, selectedDeviceId, updateDevice])

  useEffect(() => {
    if (!activeWorkspaceId || !activeTabId) return
    const canvasKey = `${activeWorkspaceId}:${activeTabId}`
    if (hydratedCanvasKey.current !== canvasKey) return
    const layout: DevicesCanvasLayout = { devices, selectedDeviceId, zoom, pan, syncNavigation }
    const signature = JSON.stringify(layout)
    if (signature === lastSavedLayout.current) return
    const save = window.setTimeout(() => {
      void window.devBrowser.devices.saveLayout(activeTabId, layout).then(() => {
        lastSavedLayout.current = signature
      }).catch((error: unknown) => console.error('Failed to save devices canvas layout', error))
    }, 250)
    return () => window.clearTimeout(save)
  }, [activeTabId, activeWorkspaceId, devices, pan, selectedDeviceId, syncNavigation, zoom])

  return <div className="devices-canvas">
    <CanvasToolbar addOpen={addOpen} syncNavigation={syncNavigation} zoom={zoom} onAddClick={() => setAddOpen((open) => !open)} onFitToScreen={fitToScreen} onPresetSelect={addPreset} onResponsive={onResponsive} onResetView={resetView} onResetZoom={() => setClampedZoom(1)} onSyncNavigationChange={setSyncNavigation} onZoomIn={() => setClampedZoom(zoom + 0.25)} onZoomOut={() => setClampedZoom(zoom - 0.25)} />
    <CanvasViewport activeTabId={activeTabId} devices={devices} environments={activeWorkspace?.environments ?? []} isMuted={Boolean(activeTab?.isMuted)} pan={pan} partition={activeWorkspace?.sessionPartition ?? 'persist:stackly-devices'} spacePressed={spacePressed} viewportRef={viewportRef} zoom={zoom} onAddClick={() => setAddOpen(true)} onApplySettings={updateDevice} onCaptureScreenshot={captureDeviceScreenshot} onMove={updatePosition} onNavigate={handleDeviceNavigate} onPan={setPan} onRemove={removeDevice} onResize={resizeDevice} onRotate={rotateDevice} onSelect={selectDevice} />
  </div>
}

function deviceBounds(devices: VirtualDevice[]): { x: number; y: number; width: number; height: number } {
  const boxes = devices.map((device) => {
    const size = visualDeviceFrameSize(device)
    return { left: device.x, top: device.y, right: device.x + size.width, bottom: device.y + size.height }
  })
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const right = Math.max(...boxes.map((box) => box.right))
  const bottom = Math.max(...boxes.map((box) => box.bottom))
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

function deviceWebview(deviceId: string | null): BrowserWebviewElement | null {
  if (!deviceId) return null
  return document.querySelector<BrowserWebviewElement>(`.device-frame-webview[data-device-id="${deviceId}"]`)
}

function BrowserArea({ empty, hasActiveTab, settings, primaryLabel, secondaryEnvironment, preview, preset, showDeviceToolbar, internalPage, activeWorkspace, onPresetChange }: { empty: boolean; hasActiveTab: boolean; settings: BrowserSettings; primaryLabel: string; secondaryEnvironment: Environment | null; preview: BrowserPreview | null; preset: ViewportPreset; showDeviceToolbar: boolean; internalPage: InternalPage | null; activeWorkspace: Workspace | undefined; onPresetChange: (preset: ViewportPreset) => void }): React.JSX.Element {
  const areaRef = useRef<HTMLDivElement>(null)
  const webviews = useRef(new Map<string, BrowserWebviewElement>())
  const webviewOrder = useRef(new Map<string, string[]>())
  const [mountedWorkspaces, setMountedWorkspaces] = useState<Record<string, MountedWorkspace>>({})
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const tabsWorkspaceId = useTabsStore((state) => state.snapshotWorkspaceId)
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const activeWorkspaceId = useWorkspacesStore((state) => state.activeWorkspaceId)
  const workspaceReady = Boolean(activeWorkspace && activeWorkspace.id === activeWorkspaceId && tabsWorkspaceId === activeWorkspaceId)
  const secondaryLabel = secondaryEnvironment?.name ?? null
  const secondaryUrl = splitUrl(activeTab?.url ?? '', secondaryEnvironment?.baseUrl ?? null)
  const devicesCanvas = preset === 'devices-canvas'
  const constrainedViewport = !devicesCanvas && !internalPage && !empty && preset !== 'responsive'
  const constrainedWidth = constrainedViewport ? Math.max(1, secondaryUrl ? (dimensions.width * 2) + 1 : dimensions.width) : 0
  const viewportStyle = constrainedViewport && constrainedWidth > 0 && dimensions.height > 0
    ? { '--stackly-viewport-width': `${constrainedWidth}px`, '--stackly-viewport-height': `${Math.max(1, dimensions.height)}px` } as CSSProperties
    : undefined

  useEffect(() => {
    if (!workspaceReady || !activeWorkspace) return
    setMountedWorkspaces((current) => ({
      ...current,
      [activeWorkspace.id]: { workspace: activeWorkspace, tabs, activeTabId }
    }))
  }, [activeTabId, activeWorkspace, tabs, workspaceReady])

  function orderedTabs(workspaceId: string, workspaceTabs: TabState[]): TabState[] {
    const byId = new Map(workspaceTabs.map((tab) => [tab.id, tab]))
    const order = webviewOrder.current.get(workspaceId)?.filter((id) => byId.has(id)) ?? []
    for (const tab of workspaceTabs) if (!order.includes(tab.id)) order.push(tab.id)
    webviewOrder.current.set(workspaceId, order)
    return order.map((id) => byId.get(id)).filter((tab): tab is TabState => Boolean(tab))
  }

  const registerWebview = useCallback((id: string, view: BrowserWebviewElement | null): void => {
    if (view) webviews.current.set(id, view)
    else webviews.current.delete(id)
  }, [])

  useEffect(() => {
    if (devicesCanvas) return
    setBrowserDomController({
      navigate: async (url) => {
        let id = useTabsStore.getState().activeTabId
        if (!id) id = await window.devBrowser.tabs.create()
        await window.devBrowser.tabs.updateState({ id, url, title: new URL(url).hostname, isLoading: true })
      },
      back: async () => { const view = activeTabId ? webviews.current.get(`${activeWorkspaceId}:${activeTabId}`) : undefined; if (view?.canGoBack()) view.goBack() },
      forward: async () => { const view = activeTabId ? webviews.current.get(`${activeWorkspaceId}:${activeTabId}`) : undefined; if (view?.canGoForward()) view.goForward() },
      reload: async () => { const view = activeTabId ? webviews.current.get(`${activeWorkspaceId}:${activeTabId}`) : undefined; view?.reload() }
    })
  }, [activeTabId, activeWorkspaceId, devicesCanvas])

  useEffect(() => {
    const area = areaRef.current
    if (!area) return

    function reportBounds(): void {
      const currentArea = areaRef.current
      if (!currentArea) return
      const rect = currentArea.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const availableWidth = secondaryLabel ? Math.floor((rect.width - 1) / 2) : rect.width
      const requested = preset === 'responsive' || preset === 'devices-canvas' ? null : viewportPresetSizes[preset]
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
  }, [devicesCanvas, internalPage, preset, secondaryLabel])

  useEffect(() => {
    void window.devBrowser.layout.setBrowserContentVisible(!devicesCanvas && !internalPage && !empty).catch(console.error)
    return () => { void window.devBrowser.layout.setBrowserContentVisible(true).catch(console.error) }
  }, [devicesCanvas, empty, internalPage])

  return <section className={`shell-browser-frame${secondaryLabel ? ' is-split' : ''}`} aria-label="Browser area">
    {showDeviceToolbar && !empty && !internalPage && <DeviceToolbar preset={preset} dimensions={dimensions} onChange={onPresetChange} />}
    {secondaryLabel && !devicesCanvas && !empty && !internalPage && <div className="split-labels" aria-label="Split environments"><span>{primaryLabel}</span><span>{secondaryLabel}</span></div>}
    <div ref={areaRef} className="shell-browser">
      {Object.values(mountedWorkspaces).map((record) => {
        const activeRecord = workspaceReady && record.workspace.id === activeWorkspaceId
        const recordHidden = !activeRecord || devicesCanvas || Boolean(internalPage) || empty
        return <div key={record.workspace.id} className={`browser-webviews${activeRecord && secondaryUrl && !devicesCanvas ? ' is-split' : ''}${activeRecord && constrainedViewport ? ' is-constrained' : ''}${recordHidden ? ' is-hidden' : ''}`} style={activeRecord ? viewportStyle : undefined} aria-hidden={recordHidden}>
          {orderedTabs(record.workspace.id, record.tabs).map((tab) => <BrowserWebview key={`${record.workspace.id}:${tab.id}`} workspaceId={record.workspace.id} tabId={tab.id} url={tab.url} active={activeRecord && !devicesCanvas && !internalPage && !empty && tab.id === record.activeTabId} partition={record.workspace.sessionPartition} register={registerWebview} />)}
          {activeRecord && secondaryUrl && !devicesCanvas && !internalPage && !empty && <webview className="browser-webview browser-webview-secondary is-active" src={secondaryUrl} partition={record.workspace.sessionPartition} webpreferences="contextIsolation=yes,sandbox=yes" />}
        </div>
      })}
      {internalPage?.kind === 'commit' ? <CommitPage commit={internalPage.commit} /> : internalPage?.kind === 'diff' ? <DiffPage diff={internalPage.diff} /> : devicesCanvas ? <DevicesCanvas currentUrl={activeTab?.url ?? ''} onResponsive={() => onPresetChange('responsive')} /> : empty ? <EmptyBrowserState backgroundImage={settings.theme.backgroundImage} hasActiveTab={hasActiveTab} /> : preview && <div className={`browser-preview${preview.secondary ? ' is-split' : ''}`} aria-hidden="true">
        <div className="browser-preview-cell"><img src={preview.primary} alt="" /></div>
        {preview.secondary && <div className="browser-preview-cell"><img src={preview.secondary} alt="" /></div>}
      </div>}
    </div>
  </section>
}

export default function App(): React.JSX.Element {
  const initialStartupConfig = useMemo(() => startupConfig(), [])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [browserPreview, setBrowserPreview] = useState<BrowserPreview | null>(null)
  const [browserSettings, setBrowserSettings] = useState<BrowserSettings>(initialStartupConfig.browserSettings)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!initialStartupConfig.browserSettings.sidebarDefault)
  const [devPanelOpen, setDevPanelOpen] = useState(initialStartupConfig.browserSettings.devPanelDefault)
  const [sourceControlOpen, setSourceControlOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<DevPanelKind>('network')
  const [panelHeight, setPanelHeight] = useState(240)
  const [internalTabs, setInternalTabs] = useState<InternalTab[]>([])
  const [activeInternalTabId, setActiveInternalTabId] = useState<string | null>(null)
  const lastShortcutRun = useRef<{ id: string; time: number } | null>(null)
  const [boundDevPanelTargetKey, setBoundDevPanelTargetKey] = useState('')
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const tabs = useTabsStore((state) => state.tabs)
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null
  const workspaces = useWorkspacesStore((state) => state.workspaces)
  const activeWorkspaceId = useWorkspacesStore((state) => state.activeWorkspaceId)
  const selectedDeviceId = useDevicesCanvasStore((state) => state.selectedDeviceId)
  const selectedDevice = useDevicesCanvasStore((state) => state.devices.find((device) => device.id === state.selectedDeviceId))
  const [split, setSplit] = useState<SplitState>({ environmentId: null, syncPath: true })
  const [viewportPresetByTab, setViewportPresetByTab] = useState<Record<string, ViewportPreset>>({})
  const workspaceViewContexts = useRef<Record<string, WorkspaceViewContext>>({})
  const storedViewportPreset = activeTabId ? viewportPresetByTab[activeTabId] ?? 'responsive' : 'responsive'
  const viewportPreset = activeTab?.kind === 'device' ? 'devices-canvas' : storedViewportPreset
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId)
  const currentUrl = activeTab?.kind === 'device' ? selectedDevice?.url ?? activeTab.url : activeTab?.url ?? ''
  const showStartPage = activeTab?.kind !== 'device' && (!activeTabId || currentUrl === '' || currentUrl === 'about:blank')
  const currentOrigin = (() => { try { return new URL(currentUrl).origin } catch { return '' } })()
  const primaryEnvironment = activeWorkspace?.environments.find((environment) => new URL(environment.baseUrl).origin === currentOrigin)
  const secondaryEnvironment = activeWorkspace?.environments.find((environment) => environment.id === split.environmentId)
  const activeInternalTab = internalTabs.find((tab) => tab.id === activeInternalTabId) ?? null
  const internalPage: InternalPage | null = activeInternalTab?.kind === 'commit'
    ? { kind: 'commit', commit: activeInternalTab.commit }
    : activeInternalTab?.kind === 'diff'
      ? { kind: 'diff', diff: activeInternalTab.diff }
      : null
  const shortcutPlatform = navigator.platform.toLowerCase().includes('mac') ? 'darwin' : 'win32'

  function saveWorkspaceViewContext(patch: Partial<WorkspaceViewContext>): void {
    if (!activeWorkspaceId) return
    const current = workspaceViewContexts.current[activeWorkspaceId] ?? defaultWorkspaceViewContext()
    workspaceViewContexts.current[activeWorkspaceId] = { ...current, ...patch }
  }

  function updateSplit(next: SplitState): void {
    setSplit(next)
    saveWorkspaceViewContext({ split: next })
    void window.devBrowser.layout.setSplitView(next.environmentId, next.syncPath).catch((error: unknown) => console.error('Failed to update split view', error))
  }

  function updateViewportPreset(preset: ViewportPreset): void {
    if (activeTabId) {
      setViewportPresetByTab((presets) => {
        const next = { ...presets, [activeTabId]: preset }
        saveWorkspaceViewContext({ viewportPresetByTab: next })
        return next
      })
    }
    void window.devBrowser.layout.setViewportPreset(preset).catch((error: unknown) => console.error('Failed to update viewport preset', error))
  }

  function openInternalTab(tab: InternalTab): void {
    setInternalTabs((tabs) => tabs.some((item) => item.id === tab.id) ? tabs.map((item) => item.id === tab.id ? tab : item) : [...tabs, tab])
    setActiveInternalTabId(tab.id)
  }

  function closeInternalTab(id: string): void {
    setInternalTabs((tabs) => {
      const index = tabs.findIndex((tab) => tab.id === id)
      const nextTabs = tabs.filter((tab) => tab.id !== id)
      setActiveInternalTabId((activeId) => {
        if (activeId !== id) return activeId
        return nextTabs[index]?.id ?? nextTabs[index - 1]?.id ?? null
      })
      return nextTabs
    })
  }

  useEffect(() => window.devBrowser.layout.onPreviewChange(setBrowserPreview), [])

  useEffect(() => {
    void window.devBrowser.layout.setChromeOverlayOpen(sourceControlOpen).catch(console.error)
    return () => { void window.devBrowser.layout.setChromeOverlayOpen(false).catch(console.error) }
  }, [sourceControlOpen])

  useEffect(() => {
    void window.devBrowser.settings.get().then((settings) => {
      setBrowserSettings(settings)
      setSidebarCollapsed(!settings.sidebarDefault)
      setDevPanelOpen(settings.devPanelDefault)
    }).catch((error: unknown) => console.error('Failed to read settings', error))
  }, [])

  useEffect(() => {
    const context = workspaceViewContexts.current[activeWorkspaceId] ?? defaultWorkspaceViewContext()
    setSplit(context.split)
    setViewportPresetByTab(context.viewportPresetByTab)
    setInternalTabs([])
    setActiveInternalTabId(null)
    void window.devBrowser.layout.setSplitView(context.split.environmentId, context.split.syncPath).catch(console.error)
  }, [activeWorkspaceId])

  useEffect(() => {
    const ids = new Set(tabs.map((tab) => tab.id))
    setViewportPresetByTab((presets) => {
      const next = Object.fromEntries(Object.entries(presets).filter(([id]) => ids.has(id)))
      saveWorkspaceViewContext({ viewportPresetByTab: next })
      return Object.keys(next).length === Object.keys(presets).length ? presets : next
    })
  }, [tabs])

  useEffect(() => {
    if (!browserSettings.features.showSplitControls && split.environmentId) updateSplit({ environmentId: null, syncPath: split.syncPath })
  }, [browserSettings.features.showSplitControls, split.environmentId])

  useEffect(() => {
    if (split.environmentId && activeWorkspace && !activeWorkspace.environments.some((environment) => environment.id === split.environmentId)) {
      updateSplit({ environmentId: null, syncPath: split.syncPath })
    }
  }, [activeWorkspace, split.environmentId])

  useEffect(() => {
    const togglePaletteShortcut = (): void => {
      const now = performance.now()
      if (lastShortcutRun.current?.id === 'palette-toggle' && now - lastShortcutRun.current.time < 120) return
      lastShortcutRun.current = { id: 'palette-toggle', time: now }
      setPaletteOpen((open) => !open)
    }
    const unsubscribe = window.devBrowser.palette.onToggle(togglePaletteShortcut)
    const unsubscribeClose = window.devBrowser.palette.onClose(() => setPaletteOpen(false))
    return () => { unsubscribe(); unsubscribeClose() }
  }, [])

  const commands = useMemo(() => createCommands({
    activeTabId,
    tabs,
    workspaces,
    activeWorkspaceId,
    toggleDevPanel: () => setDevPanelOpen((open) => !open),
    openPanel: (next) => { setActivePanel(next); setDevPanelOpen(true) },
    openSettings: () => setSettingsOpen(true),
    openHistory: () => setHistoryOpen(true),
    platform: shortcutPlatform
  }), [activeTabId, activeWorkspaceId, shortcutPlatform, tabs, workspaces])

  useEffect(() => {
    function runShortcut(shortcutId: string): void {
      const now = performance.now()
      if (lastShortcutRun.current?.id === shortcutId && now - lastShortcutRun.current.time < 120) return
      lastShortcutRun.current = { id: shortcutId, time: now }
      if (shortcutId === 'palette-toggle') {
        setPaletteOpen((open) => !open)
        return
      }
      const command = commands.find((item) => item.shortcutId === shortcutId)
      if (!command) return
      void Promise.resolve().then(() => command.execute()).catch((error: unknown) => console.error('Command shortcut failed', error))
    }

    const unsubscribeShortcut = window.devBrowser.palette.onShortcut(runShortcut)
    function onKeyDown(event: KeyboardEvent): void {
      const shortcutId = shortcutIdForKeyboardEvent(event, shortcutPlatform)
      if (!shortcutId) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if ((shortcutId === 'next-tab' || shortcutId === 'previous-tab') && target?.closest('.terminal-host, .xterm')) return
      event.preventDefault()
      runShortcut(shortcutId)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      unsubscribeShortcut()
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [commands, shortcutPlatform])

  useEffect(() => {
    const applySnapshot = useTabsStore.getState().applySnapshot
    const activeWorkspace = (): string => useWorkspacesStore.getState().activeWorkspaceId
    const unsubscribe = window.devBrowser.tabs.onStateChange((snapshot) => applySnapshot(snapshot, activeWorkspace()))
    void window.devBrowser.tabs.getState().then((snapshot) => applySnapshot(snapshot, activeWorkspace())).catch((error: unknown) => {
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

  useEffect(() => {
    if (!activeWorkspaceId) return
    void window.devBrowser.tabs.getState()
      .then((snapshot) => useTabsStore.getState().applySnapshot(snapshot, activeWorkspaceId))
      .catch((error: unknown) => console.error('Failed to refresh workspace tabs state', error))
  }, [activeWorkspaceId])

  const devPanelTargetAvailable = viewportPreset !== 'devices-canvas' || Boolean(activeTabId && selectedDeviceId)
  const devPanelTargetLabel = viewportPreset === 'devices-canvas' ? selectedDevice?.name ?? 'No device selected' : 'Active tab'
  const devPanelTargetKey = `${activeWorkspaceId}:${activeTabId ?? 'no-tab'}:${viewportPreset === 'devices-canvas' ? selectedDeviceId ?? 'no-device' : 'active-tab'}`
  const devPanelTargetReady = boundDevPanelTargetKey === devPanelTargetKey

  useEffect(() => {
    let cancelled = false
    setBoundDevPanelTargetKey('')
    const targetTabId = viewportPreset === 'devices-canvas' && activeTabId && selectedDeviceId ? activeTabId : null
    const targetDeviceId = targetTabId ? selectedDeviceId : null
    void window.devBrowser.devices.setDevToolsTarget(targetTabId, targetDeviceId)
      .then(() => { if (!cancelled) setBoundDevPanelTargetKey(devPanelTargetKey) })
      .catch((error: unknown) => console.error('Failed to update device Dev Panel target', error))
    return () => { cancelled = true }
  }, [activeTabId, devPanelTargetKey, selectedDeviceId, viewportPreset])

  async function updateSettings(next: BrowserSettings): Promise<void> {
    const saved = await window.devBrowser.settings.update(next)
    if (saved.sidebarDefault !== browserSettings.sidebarDefault) setSidebarCollapsed(!saved.sidebarDefault)
    if (saved.devPanelDefault !== browserSettings.devPanelDefault) setDevPanelOpen(saved.devPanelDefault)
    applyStartupTheme({ version: 1, browserSettings: saved })
    setBrowserSettings(saved)
  }

  return <main className="shell" style={themeStyle(browserSettings)}>
    <Toolbar settings={browserSettings} onOpenHistory={() => setHistoryOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
    <div className="shell-workspace">
      <Sidebar collapsed={sidebarCollapsed} settings={browserSettings} environments={activeWorkspace?.environments ?? []} split={split} devPanelOpen={devPanelOpen} sourceControlOpen={sourceControlOpen} onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)} onToggleDevPanel={() => setDevPanelOpen((open) => !open)} onToggleSourceControl={() => setSourceControlOpen((open) => !open)} onSplitChange={updateSplit} />
      <div className="shell-content">
        <TabBar internalTabs={internalTabs} activeInternalTabId={activeInternalTabId} onSelectBrowserTab={() => setActiveInternalTabId(null)} onSelectInternalTab={setActiveInternalTabId} onCloseInternalTab={closeInternalTab} />
        <BrowserArea empty={showStartPage} hasActiveTab={Boolean(activeTabId)} settings={browserSettings} primaryLabel={primaryEnvironment?.name ?? 'Primary'} secondaryEnvironment={secondaryEnvironment ?? null} preview={browserPreview} preset={viewportPreset} showDeviceToolbar={devPanelOpen && browserSettings.features.showDeviceToolbar && activeTab?.kind !== 'device'} internalPage={internalPage} activeWorkspace={activeWorkspace} onPresetChange={updateViewportPreset} />
        {devPanelOpen && activeTabId && <DevPanel height={panelHeight} onHeightChange={setPanelHeight} activePanel={activePanel} onPanelChange={setActivePanel} onClose={() => setDevPanelOpen(false)} networkKey={devPanelTargetKey} targetAvailable={devPanelTargetAvailable} targetLabel={devPanelTargetLabel} targetReady={devPanelTargetReady} />}
      </div>
      {sourceControlOpen && <SourceControlDrawer activeWorkspaceId={activeWorkspaceId} onClose={() => setSourceControlOpen(false)} onOpenCommit={(commit) => openInternalTab({ id: `commit:${commit.hash}`, kind: 'commit', commit })} onOpenDiff={(diff) => openInternalTab({ id: `diff:${diff.path}`, kind: 'diff', diff })} />}
    </div>
    {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
    {historyOpen && <HistoryPanel workspace={activeWorkspace} onClose={() => setHistoryOpen(false)} />}
    {settingsOpen && <SettingsPanel settings={browserSettings} workspaceCount={workspaces.length} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />}
    <TooltipLayer />
  </main>
}
