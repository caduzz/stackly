import { contextBridge, ipcRenderer } from 'electron'
import { apiRequestSchema, apiResponseSchema, browserBoundsSchema, browserChannels, browserSettingsSchema, consoleEntrySchema, cookieIdentitySchema, downloadEntrySchema, environmentConfigSchema, environmentIdSchema, localServiceSchema, navigateSchema, navigationStateSchema, networkEntrySchema, screenshotResultSchema, splitViewSchema, storageSnapshotSchema, tabIdSchema, tabsSnapshotSchema, terminalDataSchema, terminalExitSchema, terminalIdSchema, terminalInputSchema, terminalResizeSchema, viewportPresetSchema, workspaceIdSchema, workspaceNameSchema, workspacesSnapshotSchema, type DevBrowserApi } from '../shared/contracts/browser'

const api: DevBrowserApi = {
  navigation: {
    navigate: async (url) => {
      await ipcRenderer.invoke(browserChannels.navigate, navigateSchema.parse(url))
    },
    back: async () => { await ipcRenderer.invoke(browserChannels.back) },
    forward: async () => { await ipcRenderer.invoke(browserChannels.forward) },
    reload: async () => { await ipcRenderer.invoke(browserChannels.reload) },
    getState: async () => navigationStateSchema.parse(await ipcRenderer.invoke(browserChannels.getNavigationState)),
    onStateChange: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
        const parsed = navigationStateSchema.safeParse(payload)
        if (parsed.success) listener(parsed.data)
      }
      ipcRenderer.on(browserChannels.navigationStateChanged, handler)
      return () => ipcRenderer.removeListener(browserChannels.navigationStateChanged, handler)
    }
  },
  tabs: {
    create: async () => tabIdSchema.parse(await ipcRenderer.invoke(browserChannels.createTab)),
    close: async (id) => { await ipcRenderer.invoke(browserChannels.closeTab, tabIdSchema.parse(id)) },
    select: async (id) => { await ipcRenderer.invoke(browserChannels.selectTab, tabIdSchema.parse(id)) },
    getState: async () => tabsSnapshotSchema.parse(await ipcRenderer.invoke(browserChannels.getTabsState)),
    onStateChange: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
        const parsed = tabsSnapshotSchema.safeParse(payload)
        if (parsed.success) listener(parsed.data)
      }
      ipcRenderer.on(browserChannels.tabsStateChanged, handler)
      return () => ipcRenderer.removeListener(browserChannels.tabsStateChanged, handler)
    }
  },
  workspaces: {
    create: async () => workspaceIdSchema.parse(await ipcRenderer.invoke(browserChannels.createWorkspace)),
    select: async (id) => { await ipcRenderer.invoke(browserChannels.selectWorkspace, workspaceIdSchema.parse(id)) },
    rename: async (id, name) => { await ipcRenderer.invoke(browserChannels.renameWorkspace, workspaceIdSchema.parse(id), workspaceNameSchema.parse(name)) },
    delete: async (id) => { await ipcRenderer.invoke(browserChannels.deleteWorkspace, workspaceIdSchema.parse(id)) },
    getState: async () => workspacesSnapshotSchema.parse(await ipcRenderer.invoke(browserChannels.getWorkspacesState)),
    onStateChange: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
        const parsed = workspacesSnapshotSchema.safeParse(payload)
        if (parsed.success) listener(parsed.data)
      }
      ipcRenderer.on(browserChannels.workspacesStateChanged, handler)
      return () => ipcRenderer.removeListener(browserChannels.workspacesStateChanged, handler)
    }
  },
  environments: {
    add: async (config) => environmentIdSchema.parse(await ipcRenderer.invoke(browserChannels.addEnvironment, environmentConfigSchema.parse(config))),
    select: async (id) => { await ipcRenderer.invoke(browserChannels.selectEnvironment, environmentIdSchema.parse(id)) },
    update: async (id, config) => { await ipcRenderer.invoke(browserChannels.updateEnvironment, environmentIdSchema.parse(id), environmentConfigSchema.parse(config)) },
    delete: async (id) => { await ipcRenderer.invoke(browserChannels.deleteEnvironment, environmentIdSchema.parse(id)) }
  },
  layout: {
    setBrowserBounds: async (rect) => {
      await ipcRenderer.invoke(browserChannels.setBrowserBounds, browserBoundsSchema.parse(rect))
    },
    setPaletteOpen: async (open) => {
      if (typeof open !== 'boolean') throw new Error('Invalid palette state')
      await ipcRenderer.invoke(browserChannels.setPaletteOpen, open)
    },
    onPreviewChange: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, preview: Parameters<typeof listener>[0]): void => listener(preview)
      ipcRenderer.on(browserChannels.previewChanged, wrapped)
      return () => ipcRenderer.removeListener(browserChannels.previewChanged, wrapped)
    },
    setPanelResizing: async (resizing) => {
      if (typeof resizing !== 'boolean') throw new Error('Invalid resize state')
      await ipcRenderer.invoke(browserChannels.setPanelResizing, resizing)
    },
    setSplitView: async (environmentId, syncPath) => {
      const config = splitViewSchema.parse({ environmentId, syncPath })
      await ipcRenderer.invoke(browserChannels.setSplitView, config)
    },
    setViewportPreset: async (preset) => { await ipcRenderer.invoke(browserChannels.setViewportPreset, viewportPresetSchema.parse(preset)) }
  },
  palette: {
    onToggle: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(browserChannels.togglePalette, handler)
      return () => ipcRenderer.removeListener(browserChannels.togglePalette, handler)
    },
    onClose: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(browserChannels.closePalette, handler)
      return () => ipcRenderer.removeListener(browserChannels.closePalette, handler)
    }
  },
  network: {
    startCapture: async () => { await ipcRenderer.invoke(browserChannels.startNetworkCapture) },
    getEntries: async () => networkEntrySchema.array().parse(await ipcRenderer.invoke(browserChannels.getNetworkEntries)),
    onEntriesChanged: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(browserChannels.networkChanged, handler)
      return () => ipcRenderer.removeListener(browserChannels.networkChanged, handler)
    }
  },
  console: {
    startCapture: async () => { await ipcRenderer.invoke(browserChannels.startConsoleCapture) },
    getEntries: async () => consoleEntrySchema.array().parse(await ipcRenderer.invoke(browserChannels.getConsoleEntries)),
    clear: async () => { await ipcRenderer.invoke(browserChannels.clearConsoleEntries) },
    onEntriesChanged: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(browserChannels.consoleChanged, handler)
      return () => ipcRenderer.removeListener(browserChannels.consoleChanged, handler)
    }
  },
  storage: {
    getSnapshot: async () => storageSnapshotSchema.parse(await ipcRenderer.invoke(browserChannels.getStorageSnapshot)),
    removeCookie: async (identity) => { await ipcRenderer.invoke(browserChannels.removeCookie, cookieIdentitySchema.parse(identity)) }
  },
  api: { send: async (request) => apiResponseSchema.parse(await ipcRenderer.invoke(browserChannels.sendApiRequest, apiRequestSchema.parse(request))) },
  terminal: {
    create: async () => terminalIdSchema.parse(await ipcRenderer.invoke(browserChannels.createTerminal)),
    write: async (id, data) => { await ipcRenderer.invoke(browserChannels.writeTerminal, terminalInputSchema.parse({ id, data })) },
    resize: async (id, cols, rows) => { await ipcRenderer.invoke(browserChannels.resizeTerminal, terminalResizeSchema.parse({ id, cols, rows })) },
    close: async (id) => { await ipcRenderer.invoke(browserChannels.closeTerminal, terminalIdSchema.parse(id)) },
    onData: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
        const parsed = terminalDataSchema.safeParse(raw)
        if (parsed.success) listener(parsed.data)
      }
      ipcRenderer.on(browserChannels.terminalData, handler)
      return () => ipcRenderer.removeListener(browserChannels.terminalData, handler)
    },
    onExit: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
        const parsed = terminalExitSchema.safeParse(raw)
        if (parsed.success) listener(parsed.data)
      }
      ipcRenderer.on(browserChannels.terminalExit, handler)
      return () => ipcRenderer.removeListener(browserChannels.terminalExit, handler)
    }
  },
  localServices: { scan: async () => localServiceSchema.array().parse(await ipcRenderer.invoke(browserChannels.scanLocalServices)) },
  downloads: {
    getAll: async () => downloadEntrySchema.array().parse(await ipcRenderer.invoke(browserChannels.getDownloads)),
    onChange: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
        const parsed = downloadEntrySchema.array().safeParse(raw)
        if (parsed.success) listener(parsed.data)
      }
      ipcRenderer.on(browserChannels.downloadsChanged, handler)
      return () => ipcRenderer.removeListener(browserChannels.downloadsChanged, handler)
    }
  },
  screenshots: { capture: async () => screenshotResultSchema.parse(await ipcRenderer.invoke(browserChannels.captureScreenshot)) },
  settings: {
    get: async () => browserSettingsSchema.parse(await ipcRenderer.invoke(browserChannels.getSettings)),
    update: async (settings) => browserSettingsSchema.parse(await ipcRenderer.invoke(browserChannels.updateSettings, browserSettingsSchema.parse(settings)))
  },
  windowControls: {
    minimize: async () => { await ipcRenderer.invoke(browserChannels.minimizeWindow) },
    toggleMaximize: async () => { await ipcRenderer.invoke(browserChannels.toggleMaximizeWindow) },
    close: async () => { await ipcRenderer.invoke(browserChannels.closeWindow) }
  }
}

contextBridge.exposeInMainWorld('devBrowser', api)
