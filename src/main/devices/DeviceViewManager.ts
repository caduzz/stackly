import { type BrowserWindow, type Session, type WebContentsView } from 'electron'
import { browserChannels, deviceViewDescriptorSchema, type BrowserBounds, type ConsoleEntry, type CookieIdentity, type DeviceViewDescriptor, type DeviceViewSnapshot, type ElementsSnapshot, type NavigationState, type NetworkEntry, type ScreenshotResult, type StorageMutation, type StorageSnapshot } from '../../shared/contracts/browser'
import { createBrowserView, getNavigationState, type BrowserViewHandle } from '../browser/view'
import { ConsoleCollector } from '../devtools/ConsoleCollector'
import { PageElements } from '../devtools/PageElements'
import { captureScreenshot } from '../screenshots/captureScreenshot'
import { NetworkCollector } from '../devtools/NetworkCollector'
import { PageStorage } from '../storage/PageStorage'

type DeviceViewRecord = {
  deviceId: string
  tabId: string
  url: string
  viewport: DeviceViewDescriptor['viewport']
  handle: BrowserViewHandle
  bounds: BrowserBounds
  zIndex: number
  navigationState: NavigationState
  devTools?: DeviceDevToolsTarget
}

type DeviceDevToolsTarget = {
  network: NetworkCollector
  console: ConsoleCollector
  elements: PageElements
  storage: PageStorage
  ensureAttached: () => Promise<void>
}

export class DeviceViewManager {
  private readonly views = new Map<string, DeviceViewRecord>()
  private navigationSyncEnabled = false
  private readonly syncingKeys = new Set<string>()
  private readonly mutedTabIds = new Set<string>()
  private activeDevToolsKey: string | null = null
  private visibleTabId: string | null = null
  private workspaceVisible = false
  private browserOverlayOpen = false

  constructor(
    private readonly window: BrowserWindow,
    private readonly browserSession: Session,
    private readonly preserveNetworkLog: () => boolean = () => false,
    private readonly preserveConsoleLog: () => boolean = () => true,
    private readonly openUrlInTab: (url: string, active: boolean) => void = () => {},
    private readonly onVisit: (tabId: string, state: NavigationState) => void = () => {}
  ) {}

  ensureView(descriptor: DeviceViewDescriptor): DeviceViewSnapshot {
    const data = deviceViewDescriptorSchema.parse(descriptor)
    const key = this.key(data.tabId, data.deviceId)
    const existing = this.views.get(key)
    if (existing) {
      this.updateBounds(data.tabId, data.deviceId, data.bounds)
      existing.viewport = data.viewport
      if (existing.zIndex !== data.zIndex) {
        existing.zIndex = data.zIndex
        this.reorderDeviceViewsForTab(data.tabId)
      }
      if (data.url && data.url !== existing.url) this.load(recordKey(data.tabId, data.deviceId), data.url)
      this.applyVisibility()
      return this.snapshotFor(existing)
    }

    const handle = createBrowserView(
      this.window,
      this.browserSession,
      (navigationState) => this.updateNavigationState(key, navigationState),
      () => false,
      this.openUrlInTab
    )
    handle.view.setVisible(false)
    handle.view.setBounds(data.bounds)
    handle.view.webContents.setAudioMuted(this.mutedTabIds.has(data.tabId))
    const navigationState = getNavigationState(handle.view)
    const record: DeviceViewRecord = { deviceId: data.deviceId, tabId: data.tabId, url: data.url, viewport: data.viewport, handle, bounds: data.bounds, zIndex: data.zIndex, navigationState }
    this.views.set(key, record)
    this.reorderDeviceViewsForTab(data.tabId)
    if (data.url) this.load(key, data.url)
    this.applyVisibility()
    return this.snapshotFor(record)
  }

  updateBounds(tabId: string, deviceId: string, bounds: BrowserBounds): void {
    const record = this.views.get(this.key(tabId, deviceId))
    if (!record) return
    if (sameBounds(record.bounds, bounds)) return
    record.bounds = bounds
    record.handle.view.setBounds(bounds)
  }

  setVisibleForTab(tabId: string, visible: boolean): void {
    this.visibleTabId = visible ? tabId : this.visibleTabId === tabId ? null : this.visibleTabId
    this.applyVisibility()
  }

  setVisibleForDevice(tabId: string, deviceId: string, visible: boolean): void {
    const record = this.views.get(this.key(tabId, deviceId))
    if (!record) return
    record.handle.view.setVisible(Boolean(visible && this.canShowViews() && record.tabId === this.visibleTabId))
  }

  setAudioMutedForTab(tabId: string, muted: boolean): void {
    if (muted) this.mutedTabIds.add(tabId)
    else this.mutedTabIds.delete(tabId)
    for (const record of this.views.values()) {
      if (record.tabId === tabId && !record.handle.view.webContents.isDestroyed()) record.handle.view.webContents.setAudioMuted(muted)
    }
  }

  setWorkspaceVisible(visible: boolean): void {
    if (!visible) void this.activeDevToolsRecord()?.devTools?.elements.stopPicker(false)
    this.workspaceVisible = visible
    this.applyVisibility()
  }

  setBrowserOverlayOpen(open: boolean): void {
    this.browserOverlayOpen = open
    this.applyVisibility()
  }

  setNavigationSync(enabled: boolean): void {
    this.navigationSyncEnabled = enabled
  }

  setDevToolsTarget(tabId: string | null, deviceId: string | null): void {
    const key = tabId && deviceId ? this.key(tabId, deviceId) : null
    if (this.activeDevToolsKey && this.activeDevToolsKey !== key) void this.activeDevToolsRecord()?.devTools?.elements.stopPicker(false)
    this.activeDevToolsKey = key && this.views.has(key) ? key : null
  }

  hasDevToolsTarget(): boolean {
    return Boolean(this.activeDevToolsRecord())
  }

  activeTargetDescriptor(): { tabId: string; deviceId: string; webContentsId: number } | null {
    const record = this.activeDevToolsRecord()
    return record ? { tabId: record.tabId, deviceId: record.deviceId, webContentsId: record.handle.view.webContents.id } : null
  }

  startNetworkCapture(): Promise<void> {
    return this.devToolsTarget().network.start()
  }

  networkEntries(): NetworkEntry[] {
    return this.activeDevToolsRecord()?.devTools?.network.snapshot() ?? []
  }

  clearNetworkEntries(): void {
    this.activeDevToolsRecord()?.devTools?.network.clear()
  }

  startConsoleCapture(): Promise<void> {
    return this.devToolsTarget().console.start()
  }

  consoleEntries(): ConsoleEntry[] {
    return this.activeDevToolsRecord()?.devTools?.console.snapshot() ?? []
  }

  executeConsoleExpression(expression: string): Promise<ConsoleEntry> {
    return this.devToolsTarget().console.evaluate(expression)
  }

  consoleCompletions(prefix: string): Promise<string[]> {
    return this.devToolsTarget().console.completions(prefix)
  }

  clearConsoleEntries(): void {
    this.activeDevToolsRecord()?.devTools?.console.clear()
  }

  elementsSnapshot(): Promise<ElementsSnapshot> {
    return this.devToolsTarget().elements.snapshot()
  }

  selectElementNode(nodeId: number): Promise<void> {
    return this.devToolsTarget().elements.selectNode(nodeId)
  }

  startElementPicker(): Promise<void> {
    return this.devToolsTarget().elements.startPicker()
  }

  stopElementPicker(): Promise<void> {
    return this.activeDevToolsRecord()?.devTools?.elements.stopPicker() ?? Promise.resolve()
  }

  storageSnapshot(): Promise<StorageSnapshot> {
    return this.devToolsTarget().storage.snapshot()
  }

  setStorageValue(mutation: StorageMutation): Promise<void> {
    return this.devToolsTarget().storage.setValue(mutation)
  }

  removeCookie(identity: CookieIdentity): Promise<void> {
    return this.devToolsTarget().storage.removeCookie(identity)
  }

  disposeDevice(tabId: string, deviceId: string): void {
    this.disposeRecord(this.key(tabId, deviceId))
  }

  reloadDevice(tabId: string, deviceId: string): void {
    this.views.get(this.key(tabId, deviceId))?.handle.view.webContents.reload()
  }

  captureDeviceScreenshot(tabId: string, deviceId: string): Promise<ScreenshotResult> {
    const record = this.views.get(this.key(tabId, deviceId))
    if (!record) throw new Error('Device view is unavailable')
    return captureScreenshot(this.window, record.handle.view.webContents, `stackly-${record.deviceId}`)
  }

  disposeTab(tabId: string): void {
    for (const key of [...this.views.keys()]) {
      if (this.views.get(key)?.tabId === tabId) this.disposeRecord(key)
    }
    if (this.visibleTabId === tabId) this.visibleTabId = null
    if (this.activeDevToolsKey?.startsWith(`${tabId}:`)) this.activeDevToolsKey = null
    this.mutedTabIds.delete(tabId)
  }

  snapshot(): DeviceViewSnapshot[] {
    return [...this.views.values()].map((record) => this.snapshotFor(record))
  }

  dispose(): void {
    for (const key of [...this.views.keys()]) this.disposeRecord(key)
  }

  private updateNavigationState(key: string, navigationState: NavigationState): void {
    const record = this.views.get(key)
    if (record) {
      record.navigationState = navigationState
      record.url = navigationState.url || record.url
      this.onVisit(record.tabId, navigationState)
      if (this.syncingKeys.has(key)) {
        this.syncingKeys.delete(key)
        return
      }
      if (this.navigationSyncEnabled && navigationState.url) this.syncRouteFrom(key, record)
    }
  }

  private syncRouteFrom(sourceKey: string, source: DeviceViewRecord): void {
    let sourceUrl: URL
    try {
      sourceUrl = new URL(source.url)
    } catch {
      return
    }
    for (const [key, record] of this.views) {
      if (key === sourceKey || record.tabId !== source.tabId) continue
      const destination = this.routeDestination(record.url, sourceUrl)
      if (!destination || destination === record.url) continue
      this.syncingKeys.add(key)
      record.url = destination
      void record.handle.view.webContents.loadURL(destination).catch((error: unknown) => {
        this.syncingKeys.delete(key)
        if (!(error instanceof Error) || !error.message.includes('ERR_ABORTED')) console.error('Failed to sync device navigation', error)
      })
    }
  }

  private routeDestination(currentUrl: string, sourceUrl: URL): string | null {
    try {
      const destination = new URL(currentUrl)
      destination.pathname = sourceUrl.pathname
      destination.search = sourceUrl.search
      destination.hash = sourceUrl.hash
      return destination.href
    } catch {
      return null
    }
  }

  private load(key: string, url: string): void {
    const record = this.views.get(key)
    if (record) record.url = url
    const view = record?.handle.view
    if (!view) return
    void view.webContents.loadURL(url).catch((error: unknown) => {
      if (!(error instanceof Error) || !error.message.includes('ERR_ABORTED')) console.error('Failed to load device view', error)
    })
  }

  private reorderDeviceViewsForTab(tabId: string): void {
    const records = [...this.views.values()].filter((record) => record.tabId === tabId).sort((left, right) => left.zIndex - right.zIndex)
    const contentView = this.window.contentView as typeof this.window.contentView & { removeChildView?: (child: WebContentsView) => void }
    for (const record of records) {
      contentView.removeChildView?.(record.handle.view)
      this.window.contentView.addChildView(record.handle.view)
    }
  }

  private devToolsTarget(): DeviceDevToolsTarget {
    const record = this.activeDevToolsRecord()
    if (!record) throw new Error('No device is selected for Dev Panel')
    if (!record.devTools) record.devTools = this.createDevToolsTarget(record)
    return record.devTools
  }

  private activeDevToolsRecord(): DeviceViewRecord | null {
    return this.activeDevToolsKey ? this.views.get(this.activeDevToolsKey) ?? null : null
  }

  private applyVisibility(): void {
    const activeTabId = this.canShowViews() ? this.visibleTabId : null
    for (const record of this.views.values()) {
      record.handle.view.setVisible(record.tabId === activeTabId)
    }
  }

  private canShowViews(): boolean {
    return this.workspaceVisible && !this.browserOverlayOpen
  }

  private createDevToolsTarget(record: DeviceViewRecord): DeviceDevToolsTarget {
    const contents = record.handle.view.webContents
    const ensureAttached = async (): Promise<void> => {
      if (contents.isDestroyed()) throw new Error('Device view is closed')
      if (!contents.debugger.isAttached()) contents.debugger.attach('1.3')
    }
    return {
      network: new NetworkCollector(contents, Promise.resolve(), () => this.sendDeviceNetworkChanged(), ensureAttached, this.preserveNetworkLog),
      console: new ConsoleCollector(contents, ensureAttached, () => this.sendDeviceConsoleChanged(), this.preserveConsoleLog),
      elements: new PageElements(contents, ensureAttached, () => this.sendDeviceElementsChanged()),
      storage: new PageStorage(contents, ensureAttached),
      ensureAttached
    }
  }

  private sendDeviceNetworkChanged(): void {
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.networkChanged)
  }

  private sendDeviceConsoleChanged(): void {
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.consoleChanged)
  }

  private sendDeviceElementsChanged(): void {
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.elementsChanged)
  }

  private disposeRecord(key: string): void {
    const record = this.views.get(key)
    if (!record) return
    this.views.delete(key)
    this.syncingKeys.delete(key)
    if (this.activeDevToolsKey === key) this.activeDevToolsKey = null
    record.devTools?.network.dispose()
    record.devTools?.console.dispose()
    record.devTools?.elements.dispose()
    const { view } = record.handle
    if (record.devTools && !view.webContents.isDestroyed() && view.webContents.debugger.isAttached()) view.webContents.debugger.detach()
    record.handle.disposeListeners()
    this.hideView(view)
    this.removeChildView(view)
    if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false })
  }

  private removeChildView(view: WebContentsView): void {
    if (view.webContents.isDestroyed() || this.window.isDestroyed()) return
    const contentView = this.window.contentView as typeof this.window.contentView & { removeChildView?: (child: WebContentsView) => void }
    try {
      contentView.removeChildView?.(view)
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('destroyed')) throw error
    }
  }

  private hideView(view: WebContentsView): void {
    if (view.webContents.isDestroyed()) return
    try {
      view.setVisible(false)
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('destroyed')) throw error
    }
  }

  private snapshotFor(record: DeviceViewRecord): DeviceViewSnapshot {
    const { deviceId, tabId, url, viewport, bounds, zIndex, navigationState } = record
    return { deviceId, tabId, url, viewport, bounds, zIndex, navigationState }
  }

  private key(tabId: string, deviceId: string): string {
    return recordKey(tabId, deviceId)
  }
}

function recordKey(tabId: string, deviceId: string): string {
  return `${tabId}:${deviceId}`
}

function sameBounds(left: BrowserBounds, right: BrowserBounds): boolean {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height
}
