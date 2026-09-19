import { z } from 'zod'

export const navigateSchema = z.url().refine(
  (url) => /^https?:\/\//i.test(url),
  'Only HTTP and HTTPS addresses are supported'
)

export const browserBoundsSchema = z.strictObject({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
})

export type BrowserBounds = z.infer<typeof browserBoundsSchema>
export type BrowserPreview = { primary: string; secondary?: string }

export const viewportPresetSchema = z.enum(['responsive', 'mobile', 'tablet', 'desktop'])
export type ViewportPreset = z.infer<typeof viewportPresetSchema>
export const viewportPresetSizes: Record<Exclude<ViewportPreset, 'responsive'>, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 }
}

export const navigationStateSchema = z.strictObject({
  url: z.string(),
  title: z.string(),
  isLoading: z.boolean(),
  canGoBack: z.boolean(),
  canGoForward: z.boolean()
})

export type NavigationState = z.infer<typeof navigationStateSchema>

export const tabIdSchema = z.string().min(1).max(100)
export const tabStateSchema = navigationStateSchema.extend({
  id: tabIdSchema,
  favicon: z.string().optional()
})
export const tabsSnapshotSchema = z.strictObject({
  tabs: z.array(tabStateSchema),
  activeTabId: tabIdSchema.nullable()
})

export type TabState = z.infer<typeof tabStateSchema>
export type TabsSnapshot = z.infer<typeof tabsSnapshotSchema>

export const networkEntrySchema = z.strictObject({
  requestId: z.string(),
  url: z.string(),
  method: z.string(),
  status: z.number().optional(),
  type: z.string().optional(),
  startTime: z.number(),
  duration: z.number().nonnegative().optional(),
  requestHeaders: z.record(z.string(), z.string()).optional(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
  failed: z.boolean(),
  failureReason: z.string().optional()
})
export type NetworkEntry = z.infer<typeof networkEntrySchema>

export const consoleEntrySchema = z.strictObject({
  id: z.string(),
  level: z.enum(['log', 'info', 'warn', 'error', 'debug']),
  timestamp: z.number(),
  text: z.string(),
  source: z.string().optional(),
  stack: z.string().optional()
})
export type ConsoleEntry = z.infer<typeof consoleEntrySchema>

export const cookieEntrySchema = z.strictObject({
  name: z.string(), value: z.string(), domain: z.string(), path: z.string(),
  expires: z.number().optional(), secure: z.boolean(), httpOnly: z.boolean(), sameSite: z.string()
})
export type CookieEntry = z.infer<typeof cookieEntrySchema>
export const cookieIdentitySchema = cookieEntrySchema.pick({ name: true, domain: true, path: true, secure: true })
export type CookieIdentity = z.infer<typeof cookieIdentitySchema>
export const localStorageEntrySchema = z.strictObject({ key: z.string(), value: z.string() })
export type LocalStorageEntry = z.infer<typeof localStorageEntrySchema>
export const storageSnapshotSchema = z.strictObject({ url: z.string(), cookies: z.array(cookieEntrySchema), localStorage: z.array(localStorageEntrySchema), localStorageError: z.string().optional() })
export type StorageSnapshot = z.infer<typeof storageSnapshotSchema>

export const apiRequestSchema = z.strictObject({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: navigateSchema.max(2048),
  headers: z.record(z.string().min(1).max(256), z.string().max(8192)),
  body: z.string().max(1_000_000)
})
export type ApiRequest = z.infer<typeof apiRequestSchema>
export const apiResponseSchema = z.strictObject({
  status: z.number().int(),
  statusText: z.string(),
  duration: z.number().nonnegative(),
  headers: z.record(z.string(), z.string()),
  body: z.string()
})
export type ApiResponse = z.infer<typeof apiResponseSchema>

export const terminalIdSchema = z.uuid()
export const terminalInputSchema = z.strictObject({ id: terminalIdSchema, data: z.string().max(65_536) })
export const terminalResizeSchema = z.strictObject({ id: terminalIdSchema, cols: z.number().int().min(2).max(500), rows: z.number().int().min(1).max(300) })
export const terminalDataSchema = terminalInputSchema
export const terminalExitSchema = z.strictObject({ id: terminalIdSchema, exitCode: z.number().int(), signal: z.number().int().optional() })
export type TerminalData = z.infer<typeof terminalDataSchema>
export type TerminalExit = z.infer<typeof terminalExitSchema>

export const localServiceSchema = z.strictObject({
  host: z.literal('localhost'),
  port: z.number().int(),
  url: z.url(),
  framework: z.string()
})
export type LocalService = z.infer<typeof localServiceSchema>

export const downloadEntrySchema = z.strictObject({
  id: z.uuid(), filename: z.string(), url: z.url(),
  state: z.enum(['progressing', 'completed', 'cancelled', 'interrupted']),
  receivedBytes: z.number().nonnegative(), totalBytes: z.number().nonnegative(), startedAt: z.number()
})
export type DownloadEntry = z.infer<typeof downloadEntrySchema>

export const screenshotResultSchema = z.enum(['saved', 'cancelled'])
export type ScreenshotResult = z.infer<typeof screenshotResultSchema>

export const workspaceIdSchema = z.uuid()
export const environmentIdSchema = z.uuid()
export const workspaceNameSchema = z.string().trim().min(1).max(60)
export const browserSettingsSchema = z.strictObject({
  sidebarDefault: z.boolean(),
  devPanelDefault: z.boolean(),
  restoreTabs: z.boolean(),
  defaultEnvironment: z.enum(['local', 'staging', 'production', 'custom']).nullable(),
  networkPreserveLog: z.boolean(),
  consolePreserveLog: z.boolean()
})
export type BrowserSettings = z.infer<typeof browserSettingsSchema>
export const defaultBrowserSettings: BrowserSettings = {
  sidebarDefault: true,
  devPanelDefault: true,
  restoreTabs: false,
  defaultEnvironment: null,
  networkPreserveLog: false,
  consolePreserveLog: true
}

export const splitViewSchema = z.strictObject({
  environmentId: environmentIdSchema.nullable(),
  syncPath: z.boolean()
})
export const environmentConfigSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  baseUrl: navigateSchema.refine((value) => {
    const url = new URL(value)
    return url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password
  }, 'Base URL must contain only an HTTP(S) origin'),
  kind: z.enum(['local', 'staging', 'production', 'custom'])
})
export const environmentSchema = environmentConfigSchema.extend({ id: environmentIdSchema })
export type EnvironmentConfig = z.infer<typeof environmentConfigSchema>
export type Environment = z.infer<typeof environmentSchema>
export const workspaceSchema = z.strictObject({
  id: workspaceIdSchema,
  name: z.string().min(1),
  sessionPartition: z.string().startsWith('persist:workspace:'),
  environments: z.array(environmentSchema),
  activeEnvironmentId: environmentIdSchema.nullable(),
  createdAt: z.iso.datetime()
})
export const workspacesSnapshotSchema = z.strictObject({
  workspaces: z.array(workspaceSchema).min(1),
  activeWorkspaceId: workspaceIdSchema
})
export type Workspace = z.infer<typeof workspaceSchema>
export type WorkspacesSnapshot = z.infer<typeof workspacesSnapshotSchema>

export const browserChannels = {
  navigate: 'browser:navigate',
  back: 'browser:back',
  forward: 'browser:forward',
  reload: 'browser:reload',
  getNavigationState: 'browser:get-navigation-state',
  navigationStateChanged: 'browser:navigation-state-changed',
  setBrowserBounds: 'browser:set-bounds',
  createTab: 'browser:tabs:create',
  closeTab: 'browser:tabs:close',
  selectTab: 'browser:tabs:select',
  getTabsState: 'browser:tabs:get-state',
  tabsStateChanged: 'browser:tabs:state-changed',
  createWorkspace: 'browser:workspaces:create',
  selectWorkspace: 'browser:workspaces:select',
  renameWorkspace: 'browser:workspaces:rename',
  deleteWorkspace: 'browser:workspaces:delete',
  getWorkspacesState: 'browser:workspaces:get-state',
  workspacesStateChanged: 'browser:workspaces:state-changed',
  addEnvironment: 'browser:environments:add',
  selectEnvironment: 'browser:environments:select',
  updateEnvironment: 'browser:environments:update',
  deleteEnvironment: 'browser:environments:delete',
  setPaletteOpen: 'browser:layout:set-palette-open',
  previewChanged: 'browser:layout:preview-changed',
  setPanelResizing: 'browser:layout:set-panel-resizing',
  setSplitView: 'browser:layout:set-split-view',
  setViewportPreset: 'browser:layout:set-viewport-preset',
  togglePalette: 'browser:palette:toggle',
  closePalette: 'browser:palette:close',
  startNetworkCapture: 'browser:network:start-capture',
  getNetworkEntries: 'browser:network:get-entries',
  networkChanged: 'browser:network:changed',
  startConsoleCapture: 'browser:console:start-capture',
  getConsoleEntries: 'browser:console:get-entries',
  clearConsoleEntries: 'browser:console:clear',
  consoleChanged: 'browser:console:changed',
  getStorageSnapshot: 'browser:storage:get-snapshot',
  removeCookie: 'browser:storage:remove-cookie',
  sendApiRequest: 'browser:api:send',
  createTerminal: 'browser:terminal:create',
  writeTerminal: 'browser:terminal:write',
  resizeTerminal: 'browser:terminal:resize',
  closeTerminal: 'browser:terminal:close',
  terminalData: 'browser:terminal:data',
  terminalExit: 'browser:terminal:exit',
  scanLocalServices: 'browser:local-services:scan',
  getDownloads: 'browser:downloads:get',
  downloadsChanged: 'browser:downloads:changed',
  captureScreenshot: 'browser:screenshot:capture',
  getSettings: 'browser:settings:get',
  updateSettings: 'browser:settings:update',
  minimizeWindow: 'browser:window:minimize',
  toggleMaximizeWindow: 'browser:window:toggle-maximize',
  closeWindow: 'browser:window:close'
} as const

export type DevBrowserApi = {
  navigation: {
    navigate: (url: string) => Promise<void>
    back: () => Promise<void>
    forward: () => Promise<void>
    reload: () => Promise<void>
    getState: () => Promise<NavigationState>
    onStateChange: (listener: (state: NavigationState) => void) => () => void
  }
  tabs: {
    create: () => Promise<string>
    close: (id: string) => Promise<void>
    select: (id: string) => Promise<void>
    getState: () => Promise<TabsSnapshot>
    onStateChange: (listener: (state: TabsSnapshot) => void) => () => void
  }
  workspaces: {
    create: () => Promise<string>
    select: (id: string) => Promise<void>
    rename: (id: string, name: string) => Promise<void>
    delete: (id: string) => Promise<void>
    getState: () => Promise<WorkspacesSnapshot>
    onStateChange: (listener: (state: WorkspacesSnapshot) => void) => () => void
  }
  environments: {
    add: (config: EnvironmentConfig) => Promise<string>
    select: (id: string) => Promise<void>
    update: (id: string, config: EnvironmentConfig) => Promise<void>
    delete: (id: string) => Promise<void>
  }
  layout: {
    setBrowserBounds: (rect: BrowserBounds) => Promise<void>
    setPaletteOpen: (open: boolean) => Promise<void>
    onPreviewChange: (listener: (preview: BrowserPreview | null) => void) => () => void
    setPanelResizing: (resizing: boolean) => Promise<void>
    setSplitView: (environmentId: string | null, syncPath: boolean) => Promise<void>
    setViewportPreset: (preset: ViewportPreset) => Promise<void>
  }
  palette: {
    onToggle: (listener: () => void) => () => void
    onClose: (listener: () => void) => () => void
  }
  network: {
    startCapture: () => Promise<void>
    getEntries: () => Promise<NetworkEntry[]>
    onEntriesChanged: (listener: () => void) => () => void
  }
  console: {
    startCapture: () => Promise<void>
    getEntries: () => Promise<ConsoleEntry[]>
    clear: () => Promise<void>
    onEntriesChanged: (listener: () => void) => () => void
  }
  storage: {
    getSnapshot: () => Promise<StorageSnapshot>
    removeCookie: (cookie: CookieIdentity) => Promise<void>
  }
  api: { send: (request: ApiRequest) => Promise<ApiResponse> }
  terminal: {
    create: () => Promise<string>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    close: (id: string) => Promise<void>
    onData: (listener: (event: TerminalData) => void) => () => void
    onExit: (listener: (event: TerminalExit) => void) => () => void
  }
  localServices: { scan: () => Promise<LocalService[]> }
  downloads: {
    getAll: () => Promise<DownloadEntry[]>
    onChange: (listener: (entries: DownloadEntry[]) => void) => () => void
  }
  screenshots: { capture: () => Promise<ScreenshotResult> }
  settings: {
    get: () => Promise<BrowserSettings>
    update: (settings: BrowserSettings) => Promise<BrowserSettings>
  }
  windowControls: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
  }
}
