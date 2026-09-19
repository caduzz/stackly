import type { BrowserWindow, Session, WebContentsView } from 'electron'
import { browserChannels, viewportPresetSizes, type BrowserBounds, type BrowserPreview, type TabsSnapshot, type ViewportPreset } from '../../shared/contracts/browser'
import { initialTabId } from '../../shared/types/tab'
import { createBrowserView, getNavigationState, type BrowserViewHandle } from '../browser/view'
import { NetworkCollector } from '../devtools/NetworkCollector'
import { ConsoleCollector } from '../devtools/ConsoleCollector'
import { PageStorage } from '../storage/PageStorage'
import type { ConsoleEntry, CookieIdentity, NetworkEntry, StorageSnapshot } from '../../shared/contracts/browser'

const START_URL = 'https://example.com/'

function initialUrl(): string {
  const override = process.env.ELECTRON_RENDERER_URL && process.env.DEV_BROWSER_START_URL
  if (!override) return START_URL
  const url = new URL(override)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid development start URL')
  return url.href
}

type ManagedTab = { id: string; handle: BrowserViewHandle; secondary?: BrowserViewHandle; network: NetworkCollector; console: ConsoleCollector; storage: PageStorage }

export class TabManager {
  private readonly tabs = new Map<string, ManagedTab>()
  private activeTabId: string | null = initialTabId
  private bounds: BrowserBounds | null = null
  private workspaceVisible = false
  private paletteOpen = false
  private panelResizing = false
  private viewportPreset: ViewportPreset = 'responsive'
  private networkUpdateTimer: ReturnType<typeof setTimeout> | null = null
  private consoleUpdateTimer: ReturnType<typeof setTimeout> | null = null
  private splitBaseUrl: string | null = null
  private syncSplitPath = false
  private syncingSplit = false
  private pendingSplitUrl: string | null = null

  constructor(private readonly window: BrowserWindow, private readonly session: Session, loadInitialPage: boolean) {
    this.add(initialTabId, loadInitialPage ? initialUrl() : undefined)
  }

  private add(id: string, url?: string): void {
    const handle = createBrowserView(this.window, this.session, (state) => {
      if (!this.tabs.has(id)) return
      if (this.workspaceVisible && id === this.activeTabId && !this.window.webContents.isDestroyed()) {
        this.window.webContents.send(browserChannels.navigationStateChanged, state)
      }
      if (id === this.activeTabId) void this.syncSecondaryPath(state.url)
      this.emitSnapshot()
    }, () => this.paletteOpen, (destination) => this.open(destination))
    const ready = handle.view.webContents.loadURL(url ?? 'about:blank').catch((error: unknown) => {
      console.error('Failed to load page', error)
    })
    const network = new NetworkCollector(handle.view.webContents, url ? Promise.resolve() : ready, () => this.scheduleNetworkUpdate(id))
    const consoleCollector = new ConsoleCollector(handle.view.webContents, () => network.start(), () => this.scheduleConsoleUpdate(id))
    this.tabs.set(id, { id, handle, network, console: consoleCollector, storage: new PageStorage(handle.view.webContents, () => network.start()) })
  }

  private splitDestination(primaryUrl: string): string {
    const base = new URL(this.splitBaseUrl!)
    try {
      const primary = new URL(primaryUrl)
      base.pathname = primary.pathname
      base.search = primary.search
      base.hash = primary.hash
    } catch { /* A blank primary tab opens the environment root. */ }
    return base.href
  }

  private async ensureSecondary(tab: ManagedTab): Promise<void> {
    if (!this.splitBaseUrl || tab.secondary) return
    const secondary = createBrowserView(this.window, this.session, () => {}, () => this.paletteOpen, (destination) => this.open(destination))
    tab.secondary = secondary
    await secondary.view.webContents.loadURL(this.splitDestination(tab.handle.view.webContents.getURL())).catch((error: unknown) => {
      console.error('Failed to load split page', error)
    })
  }

  private async syncSecondaryPath(primaryUrl: string): Promise<void> {
    if (!this.syncSplitPath || !this.splitBaseUrl) return
    if (this.syncingSplit) {
      this.pendingSplitUrl = primaryUrl
      return
    }
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
    if (!tab?.secondary || !primaryUrl) return
    const destination = this.splitDestination(primaryUrl)
    if (tab.secondary.view.webContents.getURL() === destination) return
    this.syncingSplit = true
    try { await tab.secondary.view.webContents.loadURL(destination) }
    catch (error) { console.error('Failed to synchronize split path', error) }
    finally {
      this.syncingSplit = false
      const pending = this.pendingSplitUrl
      this.pendingSplitUrl = null
      if (pending && pending !== primaryUrl) void this.syncSecondaryPath(pending)
    }
  }

  async setSplitView(baseUrl: string | null, syncPath: boolean): Promise<void> {
    if (baseUrl !== this.splitBaseUrl) for (const tab of this.tabs.values()) this.destroySecondary(tab)
    this.splitBaseUrl = baseUrl
    this.syncSplitPath = syncPath
    const activeTab = this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
    if (baseUrl && activeTab) await this.ensureSecondary(activeTab)
    else for (const tab of this.tabs.values()) this.destroySecondary(tab)
    this.layoutActiveViews()
  }

  private scheduleNetworkUpdate(id: string): void {
    if (!this.workspaceVisible || id !== this.activeTabId || this.networkUpdateTimer) return
    this.networkUpdateTimer = setTimeout(() => {
      this.networkUpdateTimer = null
      if (this.workspaceVisible && id === this.activeTabId && !this.window.webContents.isDestroyed()) {
        this.window.webContents.send(browserChannels.networkChanged)
      }
    }, 80)
  }

  private scheduleConsoleUpdate(id: string): void {
    if (!this.workspaceVisible || id !== this.activeTabId || this.consoleUpdateTimer) return
    this.consoleUpdateTimer = setTimeout(() => {
      this.consoleUpdateTimer = null
      if (this.workspaceVisible && id === this.activeTabId && !this.window.webContents.isDestroyed()) {
        this.window.webContents.send(browserChannels.consoleChanged)
      }
    }, 80)
  }

  private emitSnapshot(): void {
    if (this.workspaceVisible && !this.window.webContents.isDestroyed()) {
      this.window.webContents.send(browserChannels.tabsStateChanged, this.snapshot())
    }
  }

  snapshot(): TabsSnapshot {
    return {
      tabs: [...this.tabs.values()].map(({ id, handle }) => ({
        id,
        ...getNavigationState(handle.view)
      })),
      activeTabId: this.activeTabId
    }
  }

  getActiveView(): WebContentsView {
    const view = this.activeTabId ? this.tabs.get(this.activeTabId)?.handle.view : undefined
    if (!view) throw new Error('Active tab is unavailable')
    return view
  }

  ensureActiveView(): WebContentsView {
    if (!this.activeTabId) this.create()
    return this.getActiveView()
  }

  private activeTab(): ManagedTab {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
    if (!tab) throw new Error('Active tab is unavailable')
    return tab
  }

  startNetworkCapture(): Promise<void> {
    return this.activeTab().network.start()
  }

  networkEntries(): NetworkEntry[] {
    return this.activeTab().network.snapshot()
  }

  startConsoleCapture(): Promise<void> { return this.activeTab().console.start() }
  consoleEntries(): ConsoleEntry[] { return this.activeTab().console.snapshot() }
  clearConsoleEntries(): void { this.activeTab().console.clear() }
  storageSnapshot(): Promise<StorageSnapshot> { return this.activeTab().storage.snapshot() }
  removeCookie(identity: CookieIdentity): Promise<void> { return this.activeTab().storage.removeCookie(identity) }

  setBounds(bounds: BrowserBounds): void {
    this.bounds = bounds
    this.layoutActiveViews()
  }

  private layoutActiveViews(): void {
    if (!this.workspaceVisible || !this.bounds) return
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
    if (!tab) return
    const visible = !this.paletteOpen && !this.panelResizing
    if (this.splitBaseUrl && tab.secondary) {
      const leftWidth = Math.floor((this.bounds.width - 1) / 2)
      tab.handle.view.setBounds(this.viewportBounds({ ...this.bounds, width: leftWidth }))
      tab.secondary.view.setBounds(this.viewportBounds({ x: this.bounds.x + leftWidth + 1, y: this.bounds.y, width: this.bounds.width - leftWidth - 1, height: this.bounds.height }))
      tab.secondary.view.setVisible(visible)
    } else tab.handle.view.setBounds(this.viewportBounds(this.bounds))
    tab.handle.view.setVisible(visible)
  }

  private viewportBounds(available: BrowserBounds): BrowserBounds {
    if (this.viewportPreset === 'responsive') return available
    const preset = viewportPresetSizes[this.viewportPreset]
    const width = Math.min(available.width, preset.width)
    const height = Math.min(available.height, preset.height)
    return { x: available.x + Math.floor((available.width - width) / 2), y: available.y + Math.floor((available.height - height) / 2), width, height }
  }

  setViewportPreset(preset: ViewportPreset): void {
    this.viewportPreset = preset
    this.layoutActiveViews()
  }

  setPaletteOpen(open: boolean): void {
    this.paletteOpen = open
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
    if (!tab) return
    for (const handle of [tab.handle, tab.secondary]) handle?.view.setVisible(this.workspaceVisible && !open && !this.panelResizing && this.bounds !== null)
    if (open && this.workspaceVisible) this.window.webContents.focus()
    if (!open && this.workspaceVisible && !this.panelResizing) tab.handle.view.webContents.focus()
  }

  async capturePreview(): Promise<BrowserPreview | null> {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
    if (!tab) return null
    const [primary, secondary] = await Promise.all([
      tab.handle.view.webContents.capturePage(undefined, { stayHidden: true }),
      tab.secondary?.view.webContents.capturePage(undefined, { stayHidden: true })
    ])
    return { primary: primary.toDataURL(), ...(secondary ? { secondary: secondary.toDataURL() } : {}) }
  }

  setPanelResizing(resizing: boolean): void {
    this.panelResizing = resizing
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
    if (!tab) return
    for (const handle of [tab.handle, tab.secondary]) handle?.view.setVisible(this.workspaceVisible && !resizing && !this.paletteOpen && this.bounds !== null)
    if (resizing && this.workspaceVisible) this.window.webContents.focus()
  }

  setWorkspaceVisible(visible: boolean): void {
    if (!visible) {
      const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
      tab?.handle.view.setVisible(false)
      tab?.secondary?.view.setVisible(false)
    }
    this.workspaceVisible = visible
    if (visible) {
      if (this.bounds) this.setBounds(this.bounds)
      this.emitSnapshot()
      if (this.activeTabId) this.window.webContents.send(browserChannels.navigationStateChanged, getNavigationState(this.getActiveView()))
    }
  }

  create(): string {
    const id = crypto.randomUUID()
    this.add(id)
    this.select(id)
    return id
  }

  private open(url: string): void {
    const destination = new URL(url)
    if (!['http:', 'https:'].includes(destination.protocol)) return
    const id = crypto.randomUUID()
    this.add(id, destination.href)
    this.select(id)
  }

  select(id: string): void {
    const next = this.tabs.get(id)
    if (!next || id === this.activeTabId) return
    const previous = this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
    previous?.handle.view.setVisible(false)
    previous?.secondary?.view.setVisible(false)
    this.activeTabId = id
    if (this.splitBaseUrl) void this.ensureSecondary(next).then(() => this.layoutActiveViews())
    else this.layoutActiveViews()
    this.emitSnapshot()
  }

  close(id: string): void {
    if (!this.tabs.has(id)) return
    const ids = [...this.tabs.keys()]
    if (ids.length === 1) this.activeTabId = null
    else if (id === this.activeTabId) {
      const index = ids.indexOf(id)
      this.activeTabId = ids[index + 1] ?? ids[index - 1]
    }
    this.destroyTab(id)
    if (this.workspaceVisible && this.bounds) {
      if (this.splitBaseUrl && this.activeTabId) void this.ensureSecondary(this.tabs.get(this.activeTabId)!).then(() => this.layoutActiveViews())
      else this.layoutActiveViews()
    }
    this.emitSnapshot()
  }

  private destroyTab(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    this.tabs.delete(id)
    tab.console.dispose()
    tab.network.dispose()
    this.destroySecondary(tab)
    tab.handle.disposeListeners()
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(tab.handle.view)
    if (!tab.handle.view.webContents.isDestroyed()) tab.handle.view.webContents.close()
  }

  private destroySecondary(tab: ManagedTab): void {
    const secondary = tab.secondary
    if (!secondary) return
    tab.secondary = undefined
    secondary.disposeListeners()
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(secondary.view)
    if (!secondary.view.webContents.isDestroyed()) secondary.view.webContents.close()
  }

  dispose(): void {
    if (this.networkUpdateTimer) clearTimeout(this.networkUpdateTimer)
    if (this.consoleUpdateTimer) clearTimeout(this.consoleUpdateTimer)
    for (const id of [...this.tabs.keys()]) this.destroyTab(id)
  }
}
