import { z } from 'zod'
import type { SourceControlApi } from './git'
import type { GitHubApi } from './github'

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

export const viewportPresetSchema = z.enum(['responsive', 'devices-canvas', 'mobile', 'tablet', 'desktop'])
export type ViewportPreset = z.infer<typeof viewportPresetSchema>
export const viewportPresetSizes: Record<Exclude<ViewportPreset, 'responsive' | 'devices-canvas'>, { width: number; height: number }> = {
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
export const workspaceIdSchema = z.uuid()
export const tabKindSchema = z.enum(['normal', 'device'])
export type TabKind = z.infer<typeof tabKindSchema>
export const tabStateSchema = navigationStateSchema.extend({
  id: tabIdSchema,
  kind: tabKindSchema.default('normal'),
  favicon: z.string().optional(),
  isMuted: z.boolean().default(false),
  isAudible: z.boolean().default(false)
})
export const tabStateUpdateSchema = z.strictObject({
  id: tabIdSchema,
  kind: tabKindSchema.optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  isLoading: z.boolean().optional(),
  canGoBack: z.boolean().optional(),
  canGoForward: z.boolean().optional(),
  favicon: z.string().optional(),
  isMuted: z.boolean().optional(),
  isAudible: z.boolean().optional()
})
export const tabsSnapshotSchema = z.strictObject({
  tabs: z.array(tabStateSchema),
  activeTabId: tabIdSchema.nullable()
})

export type TabState = z.infer<typeof tabStateSchema>
export type TabStateUpdate = z.infer<typeof tabStateUpdateSchema>
export type TabsSnapshot = z.infer<typeof tabsSnapshotSchema>
export const tabOrderSchema = z.array(tabIdSchema).min(1).max(100)
export const persistedBrowserUrlSchema = z.string().max(65_536)
export const persistedTabSchema = z.strictObject({
  id: tabIdSchema,
  url: persistedBrowserUrlSchema,
  kind: tabKindSchema.default('normal'),
  active: z.boolean()
})
export type PersistedTab = z.infer<typeof persistedTabSchema>

export const deviceViewIdSchema = z.string().min(1).max(100)
export const deviceDevToolsTargetSchema = z.strictObject({ tabId: tabIdSchema.nullable(), deviceId: deviceViewIdSchema.nullable() })
export const tabWebContentsTargetSchema = z.strictObject({
  workspaceId: workspaceIdSchema.optional(),
  tabId: tabIdSchema,
  webContentsId: z.number().int().positive().nullable()
})
export type TabWebContentsTarget = z.infer<typeof tabWebContentsTargetSchema>
export const createTabRequestSchema = z.strictObject({
  url: z.string().max(2048).optional(),
  kind: tabKindSchema.default('normal'),
  active: z.boolean().default(true)
})
export const deviceViewDescriptorSchema = z.strictObject({
  deviceId: deviceViewIdSchema,
  tabId: tabIdSchema,
  url: z.string().max(2048),
  viewport: z.strictObject({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    scaleFactor: z.number().positive()
  }),
  zIndex: z.number().int().nonnegative().default(0),
  bounds: browserBoundsSchema
})
export type DeviceViewDescriptor = z.infer<typeof deviceViewDescriptorSchema>
export const deviceViewSnapshotSchema = deviceViewDescriptorSchema.extend({
  navigationState: navigationStateSchema
})
export type DeviceViewSnapshot = z.infer<typeof deviceViewSnapshotSchema>

export const navigationHistoryEntrySchema = z.strictObject({
  id: z.uuid(),
  workspaceId: z.uuid(),
  url: z.string().max(2048),
  title: z.string().max(300),
  favicon: z.string().max(2048).optional(),
  visitedAt: z.string()
})
export const navigationHistoryVisitSchema = z.strictObject({
  url: z.string().max(2048),
  title: z.string().max(300).optional(),
  favicon: z.string().max(2048).optional()
})
export type NavigationHistoryEntry = z.infer<typeof navigationHistoryEntrySchema>
export type NavigationHistoryVisit = z.infer<typeof navigationHistoryVisitSchema>

export const persistedCanvasDeviceSchema = z.strictObject({
  id: deviceViewIdSchema,
  name: z.string().trim().min(1).max(60),
  type: z.enum(['mobile', 'tablet', 'custom']),
  viewportWidth: z.number().int().min(240).max(2560),
  viewportHeight: z.number().int().min(240).max(2560),
  x: z.number().int(),
  y: z.number().int(),
  orientation: z.enum(['portrait', 'landscape']),
  displayScale: z.number().min(0.55).max(3).default(1),
  url: z.string().max(2048),
  environmentId: z.uuid().nullable(),
  isSelected: z.boolean(),
  zIndex: z.number().int().nonnegative()
})
export const devicesCanvasLayoutSchema = z.strictObject({
  devices: z.array(persistedCanvasDeviceSchema).max(24),
  selectedDeviceId: deviceViewIdSchema.nullable(),
  zoom: z.number().min(0.25).max(2),
  pan: z.strictObject({ x: z.number().int(), y: z.number().int() }),
  syncNavigation: z.boolean().default(false)
})
export type DevicesCanvasLayout = z.infer<typeof devicesCanvasLayoutSchema>

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
  level: z.enum(['log', 'info', 'warn', 'error', 'debug', 'command', 'result']),
  timestamp: z.number(),
  text: z.string(),
  source: z.string().optional(),
  stack: z.string().optional()
})
export type ConsoleEntry = z.infer<typeof consoleEntrySchema>
export const consoleExpressionSchema = z.string().trim().min(1).max(20_000)

export type ElementNode = {
  nodeId: number
  nodeType: number
  nodeName: string
  nodeValue: string
  attributes: Record<string, string>
  children: ElementNode[]
}
export const elementNodeSchema: z.ZodType<ElementNode> = z.lazy(() => z.strictObject({
  nodeId: z.number().int(),
  nodeType: z.number().int(),
  nodeName: z.string(),
  nodeValue: z.string(),
  attributes: z.record(z.string(), z.string()),
  children: z.array(elementNodeSchema)
}))
export const elementBoxSchema = z.strictObject({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
export type ElementBox = z.infer<typeof elementBoxSchema>
export const elementsSnapshotSchema = z.strictObject({ root: elementNodeSchema.nullable(), selectedNodeId: z.number().int().nullable(), box: elementBoxSchema.nullable() })
export type ElementsSnapshot = z.infer<typeof elementsSnapshotSchema>
export const elementNodeIdSchema = z.number().int().positive()

export const cookieEntrySchema = z.strictObject({
  name: z.string(), value: z.string(), domain: z.string(), path: z.string(),
  expires: z.number().optional(), secure: z.boolean(), httpOnly: z.boolean(), sameSite: z.string()
})
export type CookieEntry = z.infer<typeof cookieEntrySchema>
export const cookieIdentitySchema = cookieEntrySchema.pick({ name: true, domain: true, path: true, secure: true })
export type CookieIdentity = z.infer<typeof cookieIdentitySchema>
export const localStorageEntrySchema = z.strictObject({ key: z.string(), value: z.string() })
export type LocalStorageEntry = z.infer<typeof localStorageEntrySchema>
export const storageSnapshotSchema = z.strictObject({ url: z.string(), cookies: z.array(cookieEntrySchema), localStorage: z.array(localStorageEntrySchema), sessionStorage: z.array(localStorageEntrySchema).default([]), localStorageError: z.string().optional(), sessionStorageError: z.string().optional() })
export type StorageSnapshot = z.infer<typeof storageSnapshotSchema>
export const storageMutationSchema = z.discriminatedUnion('area', [
  z.strictObject({ area: z.literal('localStorage'), key: z.string().min(1).max(4096), value: z.string().max(1_000_000) }),
  z.strictObject({ area: z.literal('sessionStorage'), key: z.string().min(1).max(4096), value: z.string().max(1_000_000) }),
  z.strictObject({ area: z.literal('cookie'), cookie: cookieIdentitySchema, value: z.string().max(32_768) })
])
export type StorageMutation = z.infer<typeof storageMutationSchema>

export const apiRequestSchema = z.strictObject({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: navigateSchema.max(2048),
  headers: z.record(z.string().min(1).max(256), z.string().max(8192)),
  body: z.string().max(1_000_000)
})
export type ApiRequest = z.infer<typeof apiRequestSchema>
export const apiRequestIdSchema = z.uuid()
export const apiSendRequestSchema = z.strictObject({ id: apiRequestIdSchema, request: apiRequestSchema })
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

export const audioCenterSourceKindSchema = z.enum(['tab', 'device'])
export type AudioCenterSourceKind = z.infer<typeof audioCenterSourceKindSchema>
export const audioCenterTargetSchema = z.strictObject({
  kind: audioCenterSourceKindSchema,
  workspaceId: workspaceIdSchema,
  tabId: tabIdSchema,
  deviceId: deviceViewIdSchema.nullable().default(null),
  webContentsId: z.number().int().positive().nullable(),
  workspaceName: z.string().trim().min(1).max(60),
  tabTitle: z.string().trim().min(1).max(300),
  deviceName: z.string().trim().min(1).max(80).nullable().default(null),
  url: z.string().max(2048),
  favicon: z.string().max(2048).optional(),
  muted: z.boolean()
})
export type AudioCenterTarget = z.infer<typeof audioCenterTargetSchema>
export const audioCenterSessionIdSchema = z.string().min(1).max(300)
export const audioCenterCommandSchema = z.strictObject({
  sessionId: audioCenterSessionIdSchema,
  action: z.enum(['play', 'pause', 'mute', 'unmute', 'seek-forward', 'seek-backward', 'seek']),
  position: z.number().nonnegative().optional()
})
export type AudioCenterCommand = z.infer<typeof audioCenterCommandSchema>
export const audioCenterSessionSchema = z.strictObject({
  id: audioCenterSessionIdSchema,
  kind: audioCenterSourceKindSchema,
  workspaceId: workspaceIdSchema,
  workspaceName: z.string(),
  tabId: tabIdSchema,
  tabTitle: z.string(),
  deviceId: deviceViewIdSchema.nullable(),
  deviceName: z.string().nullable(),
  url: z.string(),
  domain: z.string(),
  favicon: z.string().optional(),
  title: z.string(),
  artist: z.string().nullable(),
  artwork: z.string().nullable(),
  state: z.enum(['playing', 'paused', 'muted']),
  muted: z.boolean(),
  currentTime: z.number().nonnegative().nullable(),
  duration: z.number().nonnegative().nullable(),
  live: z.boolean(),
  supportsPlayPause: z.boolean(),
  supportsSeek: z.boolean(),
  playerCount: z.number().int().nonnegative(),
  pageScoped: z.boolean()
})
export type AudioCenterSession = z.infer<typeof audioCenterSessionSchema>

export const protectedContentDiagnosticsSchema = z.strictObject({
  runtime: z.strictObject({
    electron: z.string(),
    chromium: z.string(),
    node: z.string(),
    platform: z.string(),
    arch: z.string(),
    castlabsComponentsApi: z.boolean()
  }),
  components: z.strictObject({
    available: z.boolean(),
    status: z.unknown().nullable()
  }),
  target: z.strictObject({
    url: z.string(),
    webContentsId: z.number().int().positive()
  }).nullable(),
  browserIdentity: z.strictObject({
    userAgent: z.string(),
    platform: z.string(),
    language: z.string(),
    languages: z.array(z.string()),
    vendor: z.string(),
    brands: z.array(z.strictObject({ brand: z.string(), version: z.string() })).optional(),
    mobile: z.boolean().optional()
  }).nullable(),
  pageSignals: z.strictObject({
    title: z.string(),
    detectedErrorCodes: z.array(z.string())
  }),
  eme: z.strictObject({
    hasRequestMediaKeySystemAccess: z.boolean(),
    hdcpPolicyStatus: z.string().optional(),
    hdcpPolicyError: z.string().optional()
  }),
  widevine: z.strictObject({
    available: z.boolean(),
    keySystem: z.string().optional(),
    configuration: z.unknown().optional(),
    errorName: z.string().optional(),
    errorMessage: z.string().optional()
  }),
  media: z.strictObject({
    avcHighMp4: z.boolean(),
    aacMp4: z.boolean(),
    vp9Webm: z.boolean(),
    av1Mp4: z.boolean()
  }),
  errors: z.array(z.string()),
  notes: z.array(z.string())
})
export type ProtectedContentDiagnostics = z.infer<typeof protectedContentDiagnosticsSchema>

export const environmentIdSchema = z.uuid()
export const workspaceNameSchema = z.string().trim().min(1).max(60)
export const browserThemeColorsSchema = z.strictObject({
  bgPrimary: z.string().regex(/^#[0-9a-f]{6}$/i),
  bgSecondary: z.string().regex(/^#[0-9a-f]{6}$/i),
  surface: z.string().regex(/^#[0-9a-f]{6}$/i),
  textPrimary: z.string().regex(/^#[0-9a-f]{6}$/i),
  textMuted: z.string().regex(/^#[0-9a-f]{6}$/i),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  selection: z.string().regex(/^#[0-9a-f]{6}$/i),
  border: z.string().regex(/^#[0-9a-f]{6}$/i)
})
export const savedBrowserThemeSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  source: z.string().trim().max(4096),
  colors: browserThemeColorsSchema,
  swatches: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).max(8),
  createdAt: z.iso.datetime()
})
export const browserThemeSchema = z.strictObject({
  backgroundImage: z.string().trim().max(4096),
  wallpapers: z.array(z.string().trim().max(4096)).max(24).default([]),
  savedThemes: z.array(savedBrowserThemeSchema).max(24).default([]),
  colors: browserThemeColorsSchema
})
export type SavedBrowserTheme = z.infer<typeof savedBrowserThemeSchema>
export const imageThemeRequestSchema = z.strictObject({
  source: z.string().trim().min(1).max(4096)
})
export const imageThemeResultSchema = z.strictObject({
  colors: browserThemeColorsSchema,
  swatches: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).min(1).max(8)
})
export type ImageThemeRequest = z.infer<typeof imageThemeRequestSchema>
export type ImageThemeResult = z.infer<typeof imageThemeResultSchema>
export const browserFeatureSettingsSchema = z.strictObject({
  showNavigationControls: z.boolean(),
  showSplitControls: z.boolean(),
  showDownloads: z.boolean(),
  showLocalServices: z.boolean(),
  showSourceControlSummary: z.boolean(),
  showDeviceToolbar: z.boolean()
})
export const browserSettingsSchema = z.strictObject({
  sidebarDefault: z.boolean(),
  devPanelDefault: z.boolean(),
  restoreTabs: z.boolean(),
  defaultEnvironment: z.enum(['local', 'staging', 'production', 'custom']).nullable(),
  networkPreserveLog: z.boolean(),
  consolePreserveLog: z.boolean(),
  theme: browserThemeSchema,
  features: browserFeatureSettingsSchema
})
export type BrowserSettings = z.infer<typeof browserSettingsSchema>
export const defaultBrowserThemeColors: BrowserSettings['theme']['colors'] = {
  bgPrimary: '#1d2533',
  bgSecondary: '#252b3b',
  surface: '#343447',
  textPrimary: '#eee8f4',
  textMuted: '#aba5bd',
  accent: '#c58fa9',
  selection: '#79586f',
  border: '#57536d'
}
export const defaultSavedBrowserTheme: SavedBrowserTheme = {
  id: 'default',
  name: 'Default',
  source: '',
  colors: defaultBrowserThemeColors,
  swatches: Object.values(defaultBrowserThemeColors),
  createdAt: '2026-01-01T00:00:00.000Z'
}
export const defaultBrowserSettings: BrowserSettings = {
  sidebarDefault: true,
  devPanelDefault: true,
  restoreTabs: true,
  defaultEnvironment: null,
  networkPreserveLog: false,
  consolePreserveLog: true,
  theme: {
    backgroundImage: '',
    wallpapers: [],
    savedThemes: [defaultSavedBrowserTheme],
    colors: defaultBrowserThemeColors
  },
  features: {
    showNavigationControls: true,
    showSplitControls: true,
    showDownloads: true,
    showLocalServices: true,
    showSourceControlSummary: true,
    showDeviceToolbar: true
  }
}

export const startupConfigSchema = z.strictObject({
  version: z.literal(1),
  browserSettings: browserSettingsSchema
})
export type StartupConfig = z.infer<typeof startupConfigSchema>
export const defaultStartupConfig: StartupConfig = {
  version: 1,
  browserSettings: defaultBrowserSettings
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
  repositoryPath: z.string().trim().min(1).max(4096).nullable(),
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
  openExternal: 'browser:open-external',
  getNavigationState: 'browser:get-navigation-state',
  navigationStateChanged: 'browser:navigation-state-changed',
  setBrowserBounds: 'browser:set-bounds',
  createTab: 'browser:tabs:create',
  closeTab: 'browser:tabs:close',
  reopenClosedTab: 'browser:tabs:reopen-closed',
  selectTab: 'browser:tabs:select',
  reorderTabs: 'browser:tabs:reorder',
  updateTabState: 'browser:tabs:update-state',
  setTabWebContentsTarget: 'browser:tabs:set-webcontents-target',
  setTabAudioMuted: 'browser:tabs:set-audio-muted',
  registerAudioTarget: 'browser:audio:register-target',
  getAudioSessions: 'browser:audio:get-sessions',
  audioSessionsChanged: 'browser:audio:sessions-changed',
  audioCommand: 'browser:audio:command',
  goToAudioSource: 'browser:audio:go-to-source',
  getHistory: 'browser:history:get',
  recordHistory: 'browser:history:record',
  removeHistoryEntry: 'browser:history:remove-entry',
  clearHistory: 'browser:history:clear',
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
  setBrowserContentVisible: 'browser:layout:set-browser-content-visible',
  setChromeOverlayOpen: 'browser:layout:set-chrome-overlay-open',
  setTooltipOpen: 'browser:layout:set-tooltip-open',
  setSplitView: 'browser:layout:set-split-view',
  setViewportPreset: 'browser:layout:set-viewport-preset',
  ensureDeviceView: 'browser:devices:ensure-view',
  removeDeviceView: 'browser:devices:remove-view',
  reloadDeviceView: 'browser:devices:reload-view',
  captureDeviceScreenshot: 'browser:devices:capture-screenshot',
  setDeviceViewsVisible: 'browser:devices:set-visible',
  setDeviceViewVisible: 'browser:devices:set-view-visible',
  setDeviceDevToolsTarget: 'browser:devices:set-devtools-target',
  getDevicesCanvasLayout: 'browser:devices-canvas:get-layout',
  saveDevicesCanvasLayout: 'browser:devices-canvas:save-layout',
  setDevicesNavigationSync: 'browser:devices-canvas:set-navigation-sync',
  togglePalette: 'browser:palette:toggle',
  closePalette: 'browser:palette:close',
  commandShortcut: 'browser:commands:shortcut',
  startNetworkCapture: 'browser:network:start-capture',
  getNetworkEntries: 'browser:network:get-entries',
  clearNetworkEntries: 'browser:network:clear',
  networkChanged: 'browser:network:changed',
  startConsoleCapture: 'browser:console:start-capture',
  getConsoleEntries: 'browser:console:get-entries',
  executeConsoleExpression: 'browser:console:execute',
  getConsoleCompletions: 'browser:console:completions',
  clearConsoleEntries: 'browser:console:clear',
  consoleChanged: 'browser:console:changed',
  getElementsSnapshot: 'browser:elements:get-snapshot',
  selectElementNode: 'browser:elements:select-node',
  startElementPicker: 'browser:elements:start-picker',
  stopElementPicker: 'browser:elements:stop-picker',
  elementsChanged: 'browser:elements:changed',
  getStorageSnapshot: 'browser:storage:get-snapshot',
  setStorageValue: 'browser:storage:set-value',
  removeCookie: 'browser:storage:remove-cookie',
  sendApiRequest: 'browser:api:send',
  cancelApiRequest: 'browser:api:cancel',
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
  getProtectedContentDiagnostics: 'browser:drm:get-diagnostics',
  getSettings: 'browser:settings:get',
  updateSettings: 'browser:settings:update',
  generateThemeFromImage: 'browser:settings:theme-from-image',
  minimizeWindow: 'browser:window:minimize',
  toggleMaximizeWindow: 'browser:window:toggle-maximize',
  closeWindow: 'browser:window:close'
} as const

export type DevBrowserApi = {
  startupConfig: StartupConfig
  navigation: {
    navigate: (url: string) => Promise<void>
    back: () => Promise<void>
    forward: () => Promise<void>
    reload: () => Promise<void>
    openExternal: (url: string) => Promise<void>
    getState: () => Promise<NavigationState>
    onStateChange: (listener: (state: NavigationState) => void) => () => void
  }
  tabs: {
    create: (url?: string, active?: boolean, kind?: TabKind) => Promise<string>
    close: (id: string) => Promise<void>
    reopenClosed: () => Promise<string | null>
    select: (id: string) => Promise<void>
    reorder: (ids: string[]) => Promise<void>
    updateState: (state: TabStateUpdate) => Promise<void>
    setWebContentsTarget: (target: TabWebContentsTarget) => Promise<void>
    setAudioMuted: (id: string, muted: boolean) => Promise<void>
    getState: () => Promise<TabsSnapshot>
    onStateChange: (listener: (state: TabsSnapshot) => void) => () => void
  }
  history: {
    get: (query?: string) => Promise<NavigationHistoryEntry[]>
    record: (visit: NavigationHistoryVisit) => Promise<void>
    remove: (id: string) => Promise<void>
    clear: () => Promise<void>
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
    select: (id: string, currentUrl?: string) => Promise<string>
    update: (id: string, config: EnvironmentConfig) => Promise<void>
    delete: (id: string) => Promise<void>
  }
  layout: {
    setBrowserBounds: (rect: BrowserBounds) => Promise<void>
    setPaletteOpen: (open: boolean) => Promise<void>
    onPreviewChange: (listener: (preview: BrowserPreview | null) => void) => () => void
    setPanelResizing: (resizing: boolean) => Promise<void>
    setBrowserContentVisible: (visible: boolean) => Promise<void>
    setChromeOverlayOpen: (open: boolean) => Promise<void>
    setTooltipOpen: (open: boolean) => Promise<void>
    setSplitView: (environmentId: string | null, syncPath: boolean) => Promise<void>
    setViewportPreset: (preset: ViewportPreset) => Promise<void>
  }
  palette: {
    onToggle: (listener: () => void) => () => void
    onClose: (listener: () => void) => () => void
    onShortcut: (listener: (shortcutId: string) => void) => () => void
  }
  network: {
    startCapture: () => Promise<void>
    getEntries: () => Promise<NetworkEntry[]>
    clear: () => Promise<void>
    onEntriesChanged: (listener: () => void) => () => void
  }
  console: {
    startCapture: () => Promise<void>
    getEntries: () => Promise<ConsoleEntry[]>
    execute: (expression: string) => Promise<ConsoleEntry>
    completions: (prefix: string) => Promise<string[]>
    clear: () => Promise<void>
    onEntriesChanged: (listener: () => void) => () => void
  }
  elements: {
    getSnapshot: () => Promise<ElementsSnapshot>
    selectNode: (nodeId: number) => Promise<void>
    startPicker: () => Promise<void>
    stopPicker: () => Promise<void>
    onChanged: (listener: () => void) => () => void
  }
  storage: {
    getSnapshot: () => Promise<StorageSnapshot>
    setValue: (mutation: StorageMutation) => Promise<void>
    removeCookie: (cookie: CookieIdentity) => Promise<void>
  }
  api: {
    send: (id: string, request: ApiRequest) => Promise<ApiResponse>
    cancel: (id: string) => Promise<void>
  }
  terminal: {
    create: () => Promise<string>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    close: (id: string) => Promise<void>
    onData: (listener: (event: TerminalData) => void) => () => void
    onExit: (listener: (event: TerminalExit) => void) => () => void
  }
  localServices: { scan: () => Promise<LocalService[]> }
  devices: {
    ensureView: (descriptor: DeviceViewDescriptor) => Promise<DeviceViewSnapshot>
    removeView: (tabId: string, deviceId: string) => Promise<void>
    reloadView: (tabId: string, deviceId: string) => Promise<void>
    captureScreenshot: (tabId: string, deviceId: string) => Promise<ScreenshotResult>
    setVisible: (tabId: string, visible: boolean) => Promise<void>
    setViewVisible: (tabId: string, deviceId: string, visible: boolean) => Promise<void>
    setDevToolsTarget: (tabId: string | null, deviceId: string | null) => Promise<void>
    getLayout: (tabId: string) => Promise<DevicesCanvasLayout | null>
    saveLayout: (tabId: string, layout: DevicesCanvasLayout) => Promise<void>
    setNavigationSync: (enabled: boolean) => Promise<void>
  }
  downloads: {
    getAll: () => Promise<DownloadEntry[]>
    onChange: (listener: (entries: DownloadEntry[]) => void) => () => void
  }
  audio: {
    registerTarget: (target: AudioCenterTarget) => Promise<void>
    getSessions: () => Promise<AudioCenterSession[]>
    command: (command: AudioCenterCommand) => Promise<void>
    goToSource: (sessionId: string) => Promise<AudioCenterSession | null>
    onSessionsChanged: (listener: (sessions: AudioCenterSession[]) => void) => () => void
  }
  screenshots: { capture: () => Promise<ScreenshotResult> }
  drm: { getDiagnostics: () => Promise<ProtectedContentDiagnostics> }
  settings: {
    get: () => Promise<BrowserSettings>
    update: (settings: BrowserSettings) => Promise<BrowserSettings>
    generateThemeFromImage: (source: string) => Promise<ImageThemeResult>
  }
  sourceControl: SourceControlApi
  github: GitHubApi
  windowControls: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
  }
}
