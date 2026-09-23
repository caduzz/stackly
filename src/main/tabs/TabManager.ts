import { webContents, type BrowserWindow, type Session, type WebContents } from 'electron'
import { browserChannels, type BrowserBounds, type BrowserPreview, type ConsoleEntry, type CookieIdentity, type ElementsSnapshot, type NetworkEntry, type PersistedTab, type StorageMutation, type StorageSnapshot, type TabKind, type TabState, type TabStateUpdate, type TabsSnapshot, type ViewportPreset } from '../../shared/contracts/browser'
import { ConsoleCollector } from '../devtools/ConsoleCollector'
import { NetworkCollector } from '../devtools/NetworkCollector'
import { PageElements } from '../devtools/PageElements'
import { PageStorage } from '../storage/PageStorage'

function initialUrl(): string {
  const override = process.env.ELECTRON_RENDERER_URL && process.env.DEV_BROWSER_START_URL
  if (!override) return ''
  const url = new URL(override)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid development start URL')
  return url.href
}

function createTabState(id: string, url = '', muted = false, kind: TabKind = 'normal'): TabState {
  return {
    id,
    kind,
    url,
    title: url ? new URL(url).hostname : kind === 'device' ? 'Device Tab' : 'New Tab',
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    isMuted: muted,
    isAudible: false
  }
}

export class TabManager {
  private readonly tabs = new Map<string, TabState>()
  private readonly targets = new Map<string, TabDevToolsTarget>()
  private activeTabId: string | null = null

  constructor(private readonly window: BrowserWindow, private readonly browserSession: Session, _loadInitialPage: boolean, restoredTabs: PersistedTab[] = [], private readonly onTabsChanged: (snapshot: TabsSnapshot) => void = () => {}, private readonly onTabClosed: (tab: TabState) => void = () => {}, private readonly preserveNetworkLog: () => boolean = () => false, private readonly preserveConsoleLog: () => boolean = () => true) {
    const tabs: PersistedTab[] = restoredTabs.length > 0 ? restoredTabs : [{ id: crypto.randomUUID(), url: initialUrl(), kind: 'normal', active: true }]
    for (const tab of tabs) this.tabs.set(tab.id, createTabState(tab.id, tab.url || '', false, tab.kind))
    this.activeTabId = tabs.find((tab) => tab.active)?.id ?? tabs[0]?.id ?? null
  }

  private emitSnapshot(): void {
    const snapshot = this.snapshot()
    this.onTabsChanged(snapshot)
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.tabsStateChanged, snapshot)
  }

  snapshot(): TabsSnapshot {
    return { tabs: [...this.tabs.values()], activeTabId: this.activeTabId }
  }

  create(url = '', muted = false, active = true, kind: TabKind = 'normal'): string {
    const id = crypto.randomUUID()
    this.tabs.set(id, createTabState(id, url, muted, kind))
    if (active) this.activeTabId = id
    this.emitSnapshot()
    return id
  }

  select(id: string): void {
    if (!this.tabs.has(id) || id === this.activeTabId) return
    void this.activeDevToolsTarget()?.elements.stopPicker(false)
    this.activeTabId = id
    this.emitSnapshot()
  }

  reorder(ids: string[]): void {
    const currentIds = [...this.tabs.keys()]
    if (ids.length !== currentIds.length || new Set(ids).size !== currentIds.length || ids.some((id) => !this.tabs.has(id))) throw new Error('Invalid tab order')
    const orderedTabs = ids.map((id) => [id, this.tabs.get(id)!] as const)
    this.tabs.clear()
    for (const [id, tab] of orderedTabs) this.tabs.set(id, tab)
    this.emitSnapshot()
  }

  updateState(update: TabStateUpdate): void {
    const current = this.tabs.get(update.id)
    if (!current) return
    this.tabs.set(update.id, { ...current, ...update })
    this.emitSnapshot()
    if (update.id === this.activeTabId && !this.window.webContents.isDestroyed()) {
      const { id: _id, favicon: _favicon, ...navigation } = this.tabs.get(update.id)!
      this.window.webContents.send(browserChannels.navigationStateChanged, navigation)
    }
  }

  close(id: string): void {
    const closed = this.tabs.get(id)
    if (!closed) return
    const ids = [...this.tabs.keys()]
    if (ids.length === 1) this.activeTabId = null
    else if (id === this.activeTabId) {
      const index = ids.indexOf(id)
      this.activeTabId = ids[index + 1] ?? ids[index - 1]
    }
    this.tabs.delete(id)
    this.disposeTarget(id)
    this.onTabClosed(closed)
    this.emitSnapshot()
  }

  setWebContentsTarget(tabId: string, webContentsId: number | null): void {
    if (!this.tabs.has(tabId)) return
    if (webContentsId === null) {
      this.disposeTarget(tabId)
      return
    }
    const contents = webContents.fromId(webContentsId)
    if (!contents || contents.isDestroyed()) return
    if (contents.session !== this.browserSession) throw new Error('Tab target belongs to another workspace session')
    const existing = this.targets.get(tabId)
    if (existing?.webContentsId === webContentsId) return
    this.disposeTarget(tabId)
    this.targets.set(tabId, this.createDevToolsTarget(tabId, contents))
    this.applyAudioState(tabId)
  }

  tabIdForWebContents(webContentsId: number): string | null {
    for (const [tabId, target] of this.targets) {
      if (target.webContentsId === webContentsId && !target.contents.isDestroyed()) return tabId
    }
    return null
  }

  activeUrl(): string {
    return this.activeTabId ? this.tabs.get(this.activeTabId)?.url ?? '' : ''
  }

  getActiveView(): never {
    throw new Error('The visible browser runs as a DOM webview')
  }

  ensureActiveView(): never {
    throw new Error('The visible browser runs as a DOM webview')
  }

  setSplitView(_baseUrl: string | null, _syncPath: boolean): Promise<void> { return Promise.resolve() }
  setBounds(_bounds: BrowserBounds): void {}
  setViewportPreset(_preset: ViewportPreset): void {}
  setPaletteOpen(_open: boolean): void {}
  setPanelResizing(_resizing: boolean): void {}
  setChromeOverlayOpen(_open: boolean): void {}
  setTooltipOpen(_open: boolean): void {}
  setBrowserContentVisible(_visible: boolean): void {}
  setWorkspaceVisible(visible: boolean): void {
    if (!visible) void this.activeDevToolsTarget()?.elements.stopPicker(false)
    if (visible) this.emitSnapshot()
  }
  capturePreview(): Promise<BrowserPreview | null> { return Promise.resolve(null) }
  startNetworkCapture(): Promise<void> { return this.devToolsTarget().network.start() }
  networkEntries(): NetworkEntry[] { return this.activeDevToolsTarget()?.network.snapshot() ?? [] }
  clearNetworkEntries(): void { this.activeDevToolsTarget()?.network.clear() }
  startConsoleCapture(): Promise<void> { return this.devToolsTarget().console.start() }
  consoleEntries(): ConsoleEntry[] { return this.activeDevToolsTarget()?.console.snapshot() ?? [] }
  executeConsoleExpression(expression: string): Promise<ConsoleEntry> { return this.devToolsTarget().console.evaluate(expression) }
  consoleCompletions(prefix: string): Promise<string[]> { return this.devToolsTarget().console.completions(prefix) }
  clearConsoleEntries(): void { this.activeDevToolsTarget()?.console.clear() }
  elementsSnapshot(): Promise<ElementsSnapshot> { return this.devToolsTarget().elements.snapshot() }
  selectElementNode(nodeId: number): Promise<void> { return this.devToolsTarget().elements.selectNode(nodeId) }
  startElementPicker(): Promise<void> { return this.devToolsTarget().elements.startPicker() }
  stopElementPicker(): Promise<void> { return this.activeDevToolsTarget()?.elements.stopPicker() ?? Promise.resolve() }
  storageSnapshot(): Promise<StorageSnapshot> {
    return this.devToolsTarget().storage.snapshot()
  }
  setStorageValue(mutation: StorageMutation): Promise<void> { return this.devToolsTarget().storage.setValue(mutation) }
  removeCookie(identity: CookieIdentity): Promise<void> { return this.devToolsTarget().storage.removeCookie(identity) }
  setAudioMuted(tabId: string, muted: boolean): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    this.tabs.set(tabId, { ...tab, isMuted: muted })
    this.applyAudioState(tabId)
    this.emitSnapshot()
  }
  hasDevToolsTarget(): boolean { return Boolean(this.activeDevToolsTarget()) }
  activeTargetDescriptor(): { tabId: string; webContentsId: number } | null {
    const target = this.activeDevToolsTarget()
    return target ? { tabId: target.tabId, webContentsId: target.webContentsId } : null
  }
  dispose(): void {
    for (const tabId of [...this.targets.keys()]) this.disposeTarget(tabId)
    this.tabs.clear()
  }

  private devToolsTarget(): TabDevToolsTarget {
    const target = this.activeDevToolsTarget()
    if (!target) throw new Error('No active browser tab target is available')
    return target
  }

  private activeDevToolsTarget(): TabDevToolsTarget | null {
    if (!this.activeTabId) return null
    const target = this.targets.get(this.activeTabId)
    if (!target || target.contents.isDestroyed()) {
      if (target) this.disposeTarget(this.activeTabId)
      return null
    }
    return target
  }

  private createDevToolsTarget(tabId: string, contents: WebContents): TabDevToolsTarget {
    const ensureAttached = async (): Promise<void> => {
      if (!this.tabs.has(tabId) || contents.isDestroyed()) throw new Error('Tab is closed')
      if (contents.session !== this.browserSession) throw new Error('Tab target belongs to another workspace session')
      if (!contents.debugger.isAttached()) contents.debugger.attach('1.3')
    }
    const onAudioStateChanged = (): void => {
      const tab = this.tabs.get(tabId)
      if (!tab || contents.isDestroyed()) return
      const isAudible = contents.isCurrentlyAudible()
      if (tab.isAudible === isAudible) return
      this.tabs.set(tabId, { ...tab, isAudible })
      this.emitSnapshot()
    }
    contents.on('audio-state-changed', onAudioStateChanged)
    const onDestroyed = (): void => {
      contents.removeListener('audio-state-changed', onAudioStateChanged)
      contents.removeListener('destroyed', onDestroyed)
    }
    contents.on('destroyed', onDestroyed)
    return {
      tabId,
      webContentsId: contents.id,
      contents,
      onAudioStateChanged,
      onDestroyed,
      network: new NetworkCollector(contents, Promise.resolve(), () => this.sendNetworkChanged(), ensureAttached, this.preserveNetworkLog),
      console: new ConsoleCollector(contents, ensureAttached, () => this.sendConsoleChanged(), this.preserveConsoleLog),
      elements: new PageElements(contents, ensureAttached, () => this.sendElementsChanged()),
      storage: new PageStorage(contents, ensureAttached)
    }
  }

  private sendNetworkChanged(): void {
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.networkChanged)
  }

  private sendConsoleChanged(): void {
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.consoleChanged)
  }

  private sendElementsChanged(): void {
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.elementsChanged)
  }

  private disposeTarget(tabId: string): void {
    const target = this.targets.get(tabId)
    if (!target) return
    target.network.dispose()
    target.console.dispose()
    target.elements.dispose()
    target.contents.removeListener('audio-state-changed', target.onAudioStateChanged)
    target.contents.removeListener('destroyed', target.onDestroyed)
    if (!target.contents.isDestroyed() && target.contents.debugger.isAttached()) target.contents.debugger.detach()
    this.targets.delete(tabId)
  }

  private applyAudioState(tabId: string): void {
    const target = this.targets.get(tabId)
    const tab = this.tabs.get(tabId)
    if (!target || !tab || target.contents.isDestroyed()) return
    target.contents.setAudioMuted(tab.isMuted)
  }
}

type TabDevToolsTarget = {
  tabId: string
  webContentsId: number
  contents: WebContents
  onAudioStateChanged: () => void
  onDestroyed: () => void
  network: NetworkCollector
  console: ConsoleCollector
  elements: PageElements
  storage: PageStorage
}
