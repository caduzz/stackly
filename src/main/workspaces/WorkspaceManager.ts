import { session, webContents, type BrowserWindow, type Session } from 'electron'
import { audioCenterTargetSchema, browserChannels, environmentConfigSchema, navigationHistoryVisitSchema, workspaceNameSchema, type AudioCenterCommand, type AudioCenterSession, type AudioCenterTarget, type BrowserBounds, type BrowserSettings, type ConsoleEntry, type CookieIdentity, type DevicesCanvasLayout, type ElementsSnapshot, type Environment, type EnvironmentConfig, type NavigationHistoryEntry, type NavigationHistoryVisit, type NavigationState, type NetworkEntry, type StorageMutation, type StorageSnapshot, type TabWebContentsTarget, type TabsSnapshot, type TabState, type ViewportPreset, type Workspace, type WorkspacesSnapshot } from '../../shared/contracts/browser'
import { TabManager } from '../tabs/TabManager'
import { SettingsRepository } from '../storage/SettingsRepository'
import { WorkspaceRepository } from '../storage/WorkspaceRepository'
import { environmentDestination } from './environmentUrl'
import { DownloadTracker } from '../downloads/DownloadTracker'
import { configureSessionPermissions } from '../security/sessionPermissions'
import { chromeLikeUserAgent } from '../browser/userAgent'
import { DeviceViewManager } from '../devices/DeviceViewManager'
import type { DownloadEntry } from '../../shared/contracts/browser'
import { AudioCenter } from '../media/AudioCenter'

type ManagedWorkspace = { data: Workspace; tabs: TabManager; deviceViews: DeviceViewManager; downloads: DownloadTracker; browserSession: Session; disposePermissions: () => void }
type ClosedTabRecord = { workspaceId: string; url: string; title: string; isMuted: boolean; kind: TabState['kind'] }
type ActiveTargetTools = {
  startNetworkCapture: () => Promise<void>
  networkEntries: () => NetworkEntry[]
  clearNetworkEntries: () => void
  startConsoleCapture: () => Promise<void>
  consoleEntries: () => ConsoleEntry[]
  executeConsoleExpression: (expression: string) => Promise<ConsoleEntry>
  consoleCompletions: (prefix: string) => Promise<string[]>
  clearConsoleEntries: () => void
  elementsSnapshot: () => Promise<ElementsSnapshot>
  selectElementNode: (nodeId: number) => Promise<void>
  startElementPicker: () => Promise<void>
  stopElementPicker: () => Promise<void>
  storageSnapshot: () => Promise<StorageSnapshot>
  setStorageValue: (mutation: StorageMutation) => Promise<void>
  removeCookie: (identity: CookieIdentity) => Promise<void>
}
type ActiveChromiumTarget = (
  | { kind: 'tab'; workspaceId: string; tabId: string; webContentsId: number; tools: ActiveTargetTools }
  | { kind: 'device'; workspaceId: string; tabId: string; deviceId: string; webContentsId: number; tools: ActiveTargetTools }
)

export class WorkspaceManager {
  private readonly workspaces = new Map<string, ManagedWorkspace>()
  private activeWorkspaceId = ''
  private bounds: BrowserBounds | null = null
  private viewportPreset: ViewportPreset = 'responsive'
  private paletteOpen = false
  private chromeOverlayOpen = false
  private tooltipOpen = false
  private readonly closedTabs: ClosedTabRecord[] = []
  private readonly historyKeys = new Map<string, string>()
  private readonly audioCenter: AudioCenter

  constructor(
    private readonly window: BrowserWindow,
    private readonly repository: WorkspaceRepository,
    private readonly settings: SettingsRepository
  ) {
    this.audioCenter = new AudioCenter(window, (workspaceId, tabId, muted) => this.setWorkspaceTabAudioMuted(workspaceId, tabId, muted), (workspaceId, tabId, deviceId) => this.selectAudioSource(workspaceId, tabId, deviceId))
    const saved = repository.list()
    if (saved.length === 0) {
      this.add('Frontend', [
        { name: 'Local', baseUrl: 'http://localhost:3000', kind: 'local' },
        { name: 'Staging', baseUrl: 'https://staging.example.com', kind: 'staging' },
        { name: 'Production', baseUrl: 'https://example.com', kind: 'production' }
      ])
      for (const name of ['Backend', 'Admin']) this.add(name)
    } else {
      for (const workspace of saved) this.mount(workspace)
    }
    const preferred = settings.get('activeWorkspaceId')
    this.select(preferred && this.workspaces.has(preferred) ? preferred : this.workspaces.keys().next().value as string)
  }

  private add(name: string, configs: EnvironmentConfig[] = []): string {
    const id = crypto.randomUUID()
    const sessionPartition = `persist:workspace:${id}`
    const environments = configs.map((config) => ({ ...environmentConfigSchema.parse(config), id: crypto.randomUUID() }))
    const data: Workspace = {
      id, name, sessionPartition, repositoryPath: null, environments, activeEnvironmentId: null, createdAt: new Date().toISOString()
    }
    this.repository.create(data)
    this.mount(data)
    this.emitSnapshot()
    return id
  }

  private mount(data: Workspace): void {
    const workspaceSession = session.fromPartition(data.sessionPartition)
    workspaceSession.setUserAgent(chromeLikeUserAgent(), 'pt-BR,pt,en-US,en')
    workspaceSession.webRequest.onBeforeSendHeaders((details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'User-Agent': chromeLikeUserAgent()
        }
      })
    })
    const restoredTabs = this.settings.getBrowserSettings().restoreTabs ? this.repository.listTabs(data.id) : []
    const preserveNetworkLog = (): boolean => this.settings.getBrowserSettings().networkPreserveLog
    const preserveConsoleLog = (): boolean => this.settings.getBrowserSettings().consolePreserveLog
    let tabs: TabManager
    const deviceViews = new DeviceViewManager(this.window, workspaceSession, preserveNetworkLog, preserveConsoleLog, (url, active) => { tabs.create(url, false, active) }, (tabId, state) => {
      this.recordHistoryVisit(data.id, `device:${tabId}`, { url: state.url, title: state.title })
    })
    deviceViews.setBrowserOverlayOpen(this.hasBrowserOverlay())
    tabs = new TabManager(this.window, workspaceSession, this.workspaces.size === 0, restoredTabs, (snapshot) => {
      this.persistTabs(data.id, snapshot)
      this.recordTabsHistory(data.id, snapshot)
    }, (tab) => {
      deviceViews.disposeTab(tab.id)
      this.rememberClosedTab(data.id, tab)
    }, preserveNetworkLog, preserveConsoleLog)
    tabs.setViewportPreset(this.viewportPreset)
    const downloads = new DownloadTracker(workspaceSession, () => {
      if (this.activeWorkspaceId === data.id) this.emitDownloads()
    })
    if (this.bounds) tabs.setBounds(this.bounds)
    this.workspaces.set(data.id, { data, tabs, deviceViews, downloads, browserSession: workspaceSession, disposePermissions: configureSessionPermissions(workspaceSession) })
  }

  create(): string {
    return this.add(`Workspace ${this.workspaces.size + 1}`)
  }

  rename(id: string, name: string): void {
    const workspace = this.workspaces.get(id)
    if (!workspace) throw new Error('Workspace not found')
    const validName = workspaceNameSchema.parse(name)
    this.repository.renameWorkspace(id, validName)
    workspace.data.name = validName
    this.emitSnapshot()
  }

  async delete(id: string): Promise<void> {
    if (this.workspaces.size === 1) throw new Error('The last workspace cannot be deleted')
    const workspace = this.workspaces.get(id)
    if (!workspace) throw new Error('Workspace not found')
    if (id === this.activeWorkspaceId) this.select([...this.workspaces.keys()].find((candidate) => candidate !== id)!)
    this.workspaces.delete(id)
    this.forgetClosedTabsForWorkspace(id)
    this.repository.deleteWorkspace(id)
    for (const key of [...this.historyKeys.keys()]) if (key.startsWith(`${id}:`)) this.historyKeys.delete(key)
    workspace.downloads.dispose()
    workspace.deviceViews.dispose()
    workspace.disposePermissions()
    workspace.tabs.dispose()
    this.emitSnapshot()
    await Promise.all([workspace.browserSession.clearStorageData(), workspace.browserSession.clearCache()]).catch((error: unknown) => {
      console.error('Failed to clear deleted workspace session data', error)
    })
  }

  addEnvironment(config: EnvironmentConfig): string {
    const workspace = this.activeWorkspace()
    const environment: Environment = { ...environmentConfigSchema.parse(config), id: crypto.randomUUID() }
    this.repository.addEnvironment(workspace.data.id, environment)
    workspace.data.environments.push(environment)
    this.emitSnapshot()
    return environment.id
  }

  updateEnvironment(id: string, config: EnvironmentConfig): void {
    const workspace = this.activeWorkspace()
    const index = workspace.data.environments.findIndex((item) => item.id === id)
    if (index < 0) throw new Error('Environment not found in active workspace')
    const environment: Environment = { ...environmentConfigSchema.parse(config), id }
    this.repository.updateEnvironment(environment)
    workspace.data.environments[index] = environment
    this.emitSnapshot()
  }

  async deleteEnvironment(id: string): Promise<void> {
    const workspace = this.activeWorkspace()
    const index = workspace.data.environments.findIndex((item) => item.id === id)
    if (index < 0) throw new Error('Environment not found in active workspace')
    this.repository.deleteEnvironment(workspace.data.id, id)
    workspace.data.environments.splice(index, 1)
    if (workspace.data.activeEnvironmentId === id) workspace.data.activeEnvironmentId = null
    await workspace.tabs.setSplitView(null, false)
    this.emitSnapshot()
  }

  selectEnvironment(id: string, currentUrl = ''): string {
    const workspace = this.activeWorkspace()
    const environment = workspace.data.environments.find((item) => item.id === id)
    if (!environment) throw new Error('Environment not found in active workspace')
    const destination = environmentDestination(currentUrl || workspace.tabs.activeUrl(), environment)
    this.repository.setActiveEnvironment(workspace.data.id, id)
    workspace.data.activeEnvironmentId = id
    this.emitSnapshot()
    return destination
  }

  async setSplitView(environmentId: string | null, syncPath: boolean): Promise<void> {
    const workspace = this.activeWorkspace()
    if (environmentId === null) {
      workspace.tabs.setSplitView(null, false)
      return
    }
    const environment = workspace.data.environments.find((item) => item.id === environmentId)
    if (!environment) throw new Error('Split environment not found in active workspace')
    await workspace.tabs.setSplitView(environment.baseUrl, syncPath)
  }

  private activeWorkspace(): ManagedWorkspace {
    const workspace = this.workspaces.get(this.activeWorkspaceId)
    if (!workspace) throw new Error('Active workspace is unavailable')
    return workspace
  }

  select(id: string): void {
    const next = this.workspaces.get(id)
    if (!next) throw new Error('Workspace not found')
    if (id === this.activeWorkspaceId) return
    this.settings.set('activeWorkspaceId', id)
    if (this.activeWorkspaceId) {
      const current = this.activeWorkspace()
      current.tabs.setWorkspaceVisible(false)
      current.deviceViews.setWorkspaceVisible(false)
    }
    this.activeWorkspaceId = id
    next.deviceViews.setWorkspaceVisible(true)
    this.emitSnapshot()
    this.emitDownloads()
    next.tabs.setWorkspaceVisible(true)
  }

  activeTabs(): TabManager {
    return this.activeWorkspace().tabs
  }

  activeDeviceViews(): DeviceViewManager {
    return this.activeWorkspace().deviceViews
  }

  setTabAudioMuted(tabId: string, muted: boolean): void {
    this.setWorkspaceTabAudioMuted(this.activeWorkspaceId, tabId, muted)
  }

  setWorkspaceTabAudioMuted(workspaceId: string, tabId: string, muted: boolean): void {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) throw new Error('Workspace not found')
    workspace.tabs.setAudioMuted(tabId, muted)
    workspace.deviceViews.setAudioMutedForTab(tabId, muted)
    this.audioCenter.updateMuted(workspaceId, tabId, muted)
  }

  setTabWebContentsTarget(target: TabWebContentsTarget): void {
    const workspace = target.workspaceId ? this.workspaces.get(target.workspaceId) : this.activeWorkspace()
    if (!workspace) throw new Error('Workspace not found')
    workspace.tabs.setWebContentsTarget(target.tabId, target.webContentsId)
  }

  registerAudioTarget(raw: AudioCenterTarget): void {
    const target = audioCenterTargetSchema.parse(raw)
    const workspace = this.workspaces.get(target.workspaceId)
    if (!workspace) throw new Error('Workspace not found')
    const contents = target.webContentsId ? webContents.fromId(target.webContentsId) ?? null : null
    if (contents && contents.session !== workspace.browserSession) throw new Error('Audio target belongs to another workspace session')
    this.audioCenter.register(target, contents)
  }

  audioSessions(): AudioCenterSession[] {
    return this.audioCenter.snapshot()
  }

  audioCommand(command: AudioCenterCommand): Promise<void> {
    return this.audioCenter.command(command)
  }

  goToAudioSource(sessionId: string): AudioCenterSession | null {
    return this.audioCenter.goToSource(sessionId)
  }

  private selectAudioSource(workspaceId: string, tabId: string, _deviceId: string | null): void {
    if (workspaceId !== this.activeWorkspaceId) this.select(workspaceId)
    const workspace = this.activeWorkspace()
    workspace.tabs.select(tabId)
  }

  reopenClosedTab(): string | null {
    while (this.closedTabs.length > 0) {
      const record = this.closedTabs.shift()!
      const workspace = this.workspaces.get(record.workspaceId)
      if (!workspace) continue
      if (record.workspaceId !== this.activeWorkspaceId) this.select(record.workspaceId)
      const tabId = workspace.tabs.create(record.url, record.isMuted, true, record.kind)
      workspace.tabs.updateState({ id: tabId, title: record.title, url: record.url, isMuted: record.isMuted, kind: record.kind })
      workspace.deviceViews.setAudioMutedForTab(tabId, record.isMuted)
      return tabId
    }
    return null
  }

  getHistory(query = ''): NavigationHistoryEntry[] {
    return this.repository.listHistory(this.activeWorkspaceId, query)
  }

  recordHistory(visit: NavigationHistoryVisit): void {
    this.recordHistoryVisit(this.activeWorkspaceId, 'manual', visit)
  }

  deleteHistoryEntry(id: string): void {
    this.repository.deleteHistoryEntry(this.activeWorkspaceId, id)
  }

  clearHistory(): void {
    this.repository.clearHistory(this.activeWorkspaceId)
    for (const key of [...this.historyKeys.keys()]) if (key.startsWith(`${this.activeWorkspaceId}:`)) this.historyKeys.delete(key)
  }

  openUrlFromWebContents(webContentsId: number, url: string, active: boolean): string | null {
    const destination = new URL(url)
    if (!['http:', 'https:'].includes(destination.protocol)) return null
    for (const workspace of this.workspaces.values()) {
      if (!workspace.tabs.tabIdForWebContents(webContentsId)) continue
      return workspace.tabs.create(destination.href, false, active)
    }
    return null
  }

  resolveActiveTarget(): ActiveChromiumTarget | null {
    const workspace = this.activeWorkspace()
    const workspaceId = workspace.data.id
    if (this.viewportPreset === 'devices-canvas') {
      const device = workspace.deviceViews.activeTargetDescriptor()
      return device ? { kind: 'device', workspaceId, ...device, tools: workspace.deviceViews } : null
    }
    const tab = workspace.tabs.activeTargetDescriptor()
    return tab ? { kind: 'tab', workspaceId, ...tab, tools: workspace.tabs } : null
  }

  requireActiveTarget(): ActiveChromiumTarget {
    const target = this.resolveActiveTarget()
    if (!target) throw new Error(this.viewportPreset === 'devices-canvas' ? 'No device is selected for Dev Panel' : 'No active browser tab target is available')
    return target
  }

  getDevicesCanvasLayout(tabId: string): DevicesCanvasLayout | null {
    return this.repository.getDevicesCanvasLayout(this.activeWorkspace().data.id, tabId)
  }

  saveDevicesCanvasLayout(tabId: string, layout: DevicesCanvasLayout): void {
    this.repository.saveDevicesCanvasLayout(this.activeWorkspace().data.id, tabId, layout)
  }

  activeWorkspaceIdentity(): { id: string; name: string; repositoryPath: string | null } {
    const { data } = this.activeWorkspace()
    return { id: data.id, name: data.name, repositoryPath: data.repositoryPath }
  }

  setRepositoryPath(repositoryPath: string): void {
    const workspace = this.activeWorkspace()
    this.repository.setRepositoryPath(workspace.data.id, repositoryPath)
    workspace.data.repositoryPath = repositoryPath
    this.emitSnapshot()
  }

  setBounds(bounds: BrowserBounds): void {
    this.bounds = bounds
    this.activeTabs().setBounds(bounds)
  }

  async setPaletteOpen(open: boolean): Promise<void> {
    this.paletteOpen = open
    this.syncDeviceOverlayVisibility()
    const preview = open ? await this.activeTabs().capturePreview() : null
    for (const workspace of this.workspaces.values()) workspace.tabs.setPaletteOpen(open)
    if (!this.window.webContents.isDestroyed() && (preview || !this.hasBrowserOverlay())) this.window.webContents.send(browserChannels.previewChanged, preview)
  }

  setPanelResizing(resizing: boolean): void {
    for (const workspace of this.workspaces.values()) workspace.tabs.setPanelResizing(resizing)
  }

  async setChromeOverlayOpen(open: boolean): Promise<void> {
    this.chromeOverlayOpen = open
    this.syncDeviceOverlayVisibility()
    const preview = open ? await this.activeTabs().capturePreview() : null
    for (const workspace of this.workspaces.values()) workspace.tabs.setChromeOverlayOpen(open)
    if (!this.window.webContents.isDestroyed() && (preview || !this.hasBrowserOverlay())) this.window.webContents.send(browserChannels.previewChanged, preview)
  }

  async setTooltipOpen(open: boolean): Promise<void> {
    this.tooltipOpen = open
    this.syncDeviceOverlayVisibility()
    const preview = open ? await this.activeTabs().capturePreview() : null
    for (const workspace of this.workspaces.values()) workspace.tabs.setTooltipOpen(open)
    if (!this.window.webContents.isDestroyed() && (preview || !this.hasBrowserOverlay())) this.window.webContents.send(browserChannels.previewChanged, preview)
  }

  private hasBrowserOverlay(): boolean {
    return this.paletteOpen || this.chromeOverlayOpen || this.tooltipOpen
  }

  private syncDeviceOverlayVisibility(): void {
    const open = this.hasBrowserOverlay()
    for (const workspace of this.workspaces.values()) workspace.deviceViews.setBrowserOverlayOpen(open)
  }

  setBrowserContentVisible(visible: boolean): void {
    for (const workspace of this.workspaces.values()) workspace.tabs.setBrowserContentVisible(visible)
  }

  setViewportPreset(preset: ViewportPreset): void {
    void this.resolveActiveTarget()?.tools.stopElementPicker()
    this.viewportPreset = preset
    for (const workspace of this.workspaces.values()) workspace.tabs.setViewportPreset(preset)
  }

  snapshot(): WorkspacesSnapshot {
    return {
      workspaces: [...this.workspaces.values()].map(({ data }) => data),
      activeWorkspaceId: this.activeWorkspaceId
    }
  }

  downloads(): DownloadEntry[] { return this.activeWorkspace().downloads.snapshot() }
  getSettings(): BrowserSettings { return this.settings.getBrowserSettings() }
  updateSettings(value: BrowserSettings): BrowserSettings { return this.settings.setBrowserSettings(value) }

  private persistTabs(workspaceId: string, snapshot: TabsSnapshot): void {
    if (!this.settings.getBrowserSettings().restoreTabs) return
    this.repository.saveTabs(workspaceId, snapshot.tabs.map((tab) => ({ id: tab.id, url: tab.url, kind: tab.kind, active: tab.id === snapshot.activeTabId })))
  }

  private recordTabsHistory(workspaceId: string, snapshot: TabsSnapshot): void {
    for (const tab of snapshot.tabs) {
      this.recordHistoryVisit(workspaceId, `tab:${tab.id}`, { url: tab.url, title: tab.title, favicon: tab.favicon })
    }
  }

  private recordHistoryVisit(workspaceId: string, sourceId: string, visit: NavigationHistoryVisit): void {
    const parsed = navigationHistoryVisitSchema.safeParse(visit)
    if (!parsed.success || !this.shouldRecordHistory(parsed.data.url)) return
    const key = `${workspaceId}:${sourceId}`
    const signature = `${parsed.data.url}\n${parsed.data.title ?? ''}\n${parsed.data.favicon ?? ''}`
    if (this.historyKeys.get(key) === signature) return
    this.historyKeys.set(key, signature)
    this.repository.recordHistory(workspaceId, parsed.data)
  }

  private shouldRecordHistory(url: string): boolean {
    try {
      const destination = new URL(url)
      return destination.protocol === 'http:' || destination.protocol === 'https:'
    } catch {
      return false
    }
  }

  private emitDownloads(): void {
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.downloadsChanged, this.downloads())
  }

  private emitSnapshot(): void {
    if (this.activeWorkspaceId && !this.window.webContents.isDestroyed()) {
      this.window.webContents.send(browserChannels.workspacesStateChanged, this.snapshot())
    }
  }

  private rememberClosedTab(workspaceId: string, tab: TabState): void {
    this.closedTabs.unshift({ workspaceId, url: tab.url, title: tab.title, isMuted: tab.isMuted, kind: tab.kind })
    this.closedTabs.splice(20)
  }

  private forgetClosedTabsForWorkspace(workspaceId: string): void {
    for (let index = this.closedTabs.length - 1; index >= 0; index -= 1) {
      if (this.closedTabs[index].workspaceId === workspaceId) this.closedTabs.splice(index, 1)
    }
  }

  dispose(): void {
    this.audioCenter.dispose()
    for (const workspace of this.workspaces.values()) {
      workspace.downloads.dispose()
      workspace.deviceViews.dispose()
      workspace.disposePermissions()
      workspace.tabs.dispose()
    }
    this.workspaces.clear()
  }
}
