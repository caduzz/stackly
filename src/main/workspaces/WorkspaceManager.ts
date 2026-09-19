import { session, type BrowserWindow, type Session } from 'electron'
import { browserChannels, environmentConfigSchema, workspaceNameSchema, type BrowserBounds, type BrowserSettings, type Environment, type EnvironmentConfig, type ViewportPreset, type Workspace, type WorkspacesSnapshot } from '../../shared/contracts/browser'
import { TabManager } from '../tabs/TabManager'
import { SettingsRepository } from '../storage/SettingsRepository'
import { WorkspaceRepository } from '../storage/WorkspaceRepository'
import { environmentDestination } from './environmentUrl'
import { DownloadTracker } from '../downloads/DownloadTracker'
import { denySessionPermissions } from '../security/sessionPermissions'
import type { DownloadEntry } from '../../shared/contracts/browser'

type ManagedWorkspace = { data: Workspace; tabs: TabManager; downloads: DownloadTracker; browserSession: Session; disposePermissions: () => void }

export class WorkspaceManager {
  private readonly workspaces = new Map<string, ManagedWorkspace>()
  private activeWorkspaceId = ''
  private bounds: BrowserBounds | null = null
  private viewportPreset: ViewportPreset = 'responsive'

  constructor(
    private readonly window: BrowserWindow,
    private readonly repository: WorkspaceRepository,
    private readonly settings: SettingsRepository
  ) {
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
      id, name, sessionPartition, environments, activeEnvironmentId: null, createdAt: new Date().toISOString()
    }
    this.repository.create(data)
    this.mount(data)
    this.emitSnapshot()
    return id
  }

  private mount(data: Workspace): void {
    const workspaceSession = session.fromPartition(data.sessionPartition)
    const tabs = new TabManager(this.window, workspaceSession, this.workspaces.size === 0)
    tabs.setViewportPreset(this.viewportPreset)
    const downloads = new DownloadTracker(workspaceSession, () => {
      if (this.activeWorkspaceId === data.id) this.emitDownloads()
    })
    if (this.bounds) tabs.setBounds(this.bounds)
    this.workspaces.set(data.id, { data, tabs, downloads, browserSession: workspaceSession, disposePermissions: denySessionPermissions(workspaceSession) })
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
    this.repository.deleteWorkspace(id)
    workspace.downloads.dispose()
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

  async selectEnvironment(id: string): Promise<void> {
    const workspace = this.activeWorkspace()
    const environment = workspace.data.environments.find((item) => item.id === id)
    if (!environment) throw new Error('Environment not found in active workspace')
    const contents = workspace.tabs.ensureActiveView().webContents
    const destination = environmentDestination(contents.getURL(), environment)
    this.repository.setActiveEnvironment(workspace.data.id, id)
    workspace.data.activeEnvironmentId = id
    this.emitSnapshot()
    await contents.loadURL(destination)
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
    if (this.activeWorkspaceId) this.activeTabs().setWorkspaceVisible(false)
    this.activeWorkspaceId = id
    next.tabs.setWorkspaceVisible(true)
    this.emitSnapshot()
    this.emitDownloads()
  }

  activeTabs(): TabManager {
    return this.activeWorkspace().tabs
  }

  setBounds(bounds: BrowserBounds): void {
    this.bounds = bounds
    this.activeTabs().setBounds(bounds)
  }

  async setPaletteOpen(open: boolean): Promise<void> {
    const preview = open ? await this.activeTabs().capturePreview() : null
    for (const workspace of this.workspaces.values()) workspace.tabs.setPaletteOpen(open)
    this.window.webContents.send(browserChannels.previewChanged, preview)
  }

  setPanelResizing(resizing: boolean): void {
    for (const workspace of this.workspaces.values()) workspace.tabs.setPanelResizing(resizing)
  }

  setViewportPreset(preset: ViewportPreset): void {
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

  private emitDownloads(): void {
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.downloadsChanged, this.downloads())
  }

  private emitSnapshot(): void {
    if (this.activeWorkspaceId && !this.window.webContents.isDestroyed()) {
      this.window.webContents.send(browserChannels.workspacesStateChanged, this.snapshot())
    }
  }

  dispose(): void {
    for (const workspace of this.workspaces.values()) {
      workspace.downloads.dispose()
      workspace.disposePermissions()
      workspace.tabs.dispose()
    }
    this.workspaces.clear()
  }
}
