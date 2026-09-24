import { contextBridge, ipcRenderer } from 'electron'
import { adBlockStatusSchema, apiRequestIdSchema, apiRequestSchema, apiResponseSchema, apiSendRequestSchema, audioCenterCommandSchema, audioCenterSessionIdSchema, audioCenterSessionSchema, audioCenterTargetSchema, browserBoundsSchema, browserChannels, browserSettingsSchema, consoleEntrySchema, consoleExpressionSchema, cookieIdentitySchema, createTabRequestSchema, defaultStartupConfig, deviceDevToolsTargetSchema, devicesCanvasLayoutSchema, deviceViewDescriptorSchema, deviceViewIdSchema, deviceViewSnapshotSchema, downloadEntrySchema, elementNodeIdSchema, elementsSnapshotSchema, environmentConfigSchema, environmentIdSchema, imageThemeRequestSchema, imageThemeResultSchema, localServiceSchema, navigateSchema, navigationHistoryEntrySchema, navigationHistoryVisitSchema, navigationStateSchema, networkEntrySchema, protectedContentDiagnosticsSchema, screenshotResultSchema, splitViewSchema, startupConfigSchema, storageMutationSchema, storageSnapshotSchema, tabIdSchema, tabOrderSchema, tabsSnapshotSchema, tabStateUpdateSchema, tabWebContentsTargetSchema, terminalDataSchema, terminalExitSchema, terminalIdSchema, terminalInputSchema, terminalResizeSchema, viewportPresetSchema, workspaceIdSchema, workspaceNameSchema, workspacesSnapshotSchema, type DevBrowserApi } from '../shared/contracts/browser'
import { gitBranchOperationSchema, gitBranchSchema, gitChannels, gitCommitRequestSchema, gitCommitResultSchema, gitCommitSchema, gitConnectRepositoryResultSchema, gitFileDiffRequestSchema, gitFileDiffSchema, gitFileOperationSchema, gitRemoteOperationResultSchema, gitRepositorySchema, gitRepositoryStatusCountsSchema, gitStatusSummarySchema } from '../shared/contracts/git'
import { githubActionsRunListRequestSchema, githubActionsRunPageSchema, githubChannels, githubIssueListRequestSchema, githubIssuePageSchema, githubProviderStatusSchema, githubPullRequestCreateRequestSchema, githubPullRequestCreateResultSchema, githubPullRequestDetailRequestSchema, githubPullRequestDetailSchema, githubPullRequestListRequestSchema, githubPullRequestPageSchema, githubRepositoryMetadataSchema, githubRepositoryRequestSchema } from '../shared/contracts/github'

function readStartupConfig(): DevBrowserApi['startupConfig'] {
  const raw = process.argv.find((item) => item.startsWith('--stackly-startup-config='))?.slice('--stackly-startup-config='.length)
  if (!raw) return defaultStartupConfig
  try {
    const parsed = startupConfigSchema.safeParse(JSON.parse(decodeURIComponent(raw)))
    return parsed.success ? parsed.data : defaultStartupConfig
  } catch {
    return defaultStartupConfig
  }
}

const api: DevBrowserApi = {
  startupConfig: readStartupConfig(),
  navigation: {
    navigate: async (url) => {
      await ipcRenderer.invoke(browserChannels.navigate, navigateSchema.parse(url))
    },
    back: async () => { await ipcRenderer.invoke(browserChannels.back) },
    forward: async () => { await ipcRenderer.invoke(browserChannels.forward) },
    reload: async () => { await ipcRenderer.invoke(browserChannels.reload) },
    openExternal: async (url) => { await ipcRenderer.invoke(browserChannels.openExternal, navigateSchema.parse(url)) },
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
    create: async (url, active = true, kind = 'normal') => tabIdSchema.parse(await ipcRenderer.invoke(browserChannels.createTab, createTabRequestSchema.parse({ url, active, kind }))),
    close: async (id) => { await ipcRenderer.invoke(browserChannels.closeTab, tabIdSchema.parse(id)) },
    reopenClosed: async () => tabIdSchema.nullable().parse(await ipcRenderer.invoke(browserChannels.reopenClosedTab)),
    select: async (id) => { await ipcRenderer.invoke(browserChannels.selectTab, tabIdSchema.parse(id)) },
    reorder: async (ids) => { await ipcRenderer.invoke(browserChannels.reorderTabs, tabOrderSchema.parse(ids)) },
    updateState: async (state) => { await ipcRenderer.invoke(browserChannels.updateTabState, tabStateUpdateSchema.parse(state)) },
    setWebContentsTarget: async (target) => { await ipcRenderer.invoke(browserChannels.setTabWebContentsTarget, tabWebContentsTargetSchema.parse(target)) },
    setAudioMuted: async (id, muted) => {
      if (typeof muted !== 'boolean') throw new Error('Invalid muted state')
      await ipcRenderer.invoke(browserChannels.setTabAudioMuted, tabIdSchema.parse(id), muted)
    },
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
  history: {
    get: async (query = '') => navigationHistoryEntrySchema.array().parse(await ipcRenderer.invoke(browserChannels.getHistory, query)),
    record: async (visit) => { await ipcRenderer.invoke(browserChannels.recordHistory, navigationHistoryVisitSchema.parse(visit)) },
    remove: async (id) => { await ipcRenderer.invoke(browserChannels.removeHistoryEntry, workspaceIdSchema.parse(id)) },
    clear: async () => { await ipcRenderer.invoke(browserChannels.clearHistory) }
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
    select: async (id, currentUrl = '') => navigateSchema.parse(await ipcRenderer.invoke(browserChannels.selectEnvironment, environmentIdSchema.parse(id), typeof currentUrl === 'string' ? currentUrl : '')),
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
    setBrowserContentVisible: async (visible) => {
      if (typeof visible !== 'boolean') throw new Error('Invalid browser visibility state')
      await ipcRenderer.invoke(browserChannels.setBrowserContentVisible, visible)
    },
    setChromeOverlayOpen: async (open) => {
      if (typeof open !== 'boolean') throw new Error('Invalid chrome overlay state')
      await ipcRenderer.invoke(browserChannels.setChromeOverlayOpen, open)
    },
    setTooltipOpen: async (open) => {
      if (typeof open !== 'boolean') throw new Error('Invalid tooltip overlay state')
      await ipcRenderer.invoke(browserChannels.setTooltipOpen, open)
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
    },
    onShortcut: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, shortcutId: unknown): void => {
        if (typeof shortcutId === 'string') listener(shortcutId)
      }
      ipcRenderer.on(browserChannels.commandShortcut, handler)
      return () => ipcRenderer.removeListener(browserChannels.commandShortcut, handler)
    }
  },
  network: {
    startCapture: async () => { await ipcRenderer.invoke(browserChannels.startNetworkCapture) },
    getEntries: async () => networkEntrySchema.array().parse(await ipcRenderer.invoke(browserChannels.getNetworkEntries)),
    clear: async () => { await ipcRenderer.invoke(browserChannels.clearNetworkEntries) },
    onEntriesChanged: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(browserChannels.networkChanged, handler)
      return () => ipcRenderer.removeListener(browserChannels.networkChanged, handler)
    }
  },
  adBlock: {
    getStatus: async () => adBlockStatusSchema.parse(await ipcRenderer.invoke(browserChannels.getAdBlockStatus)),
    setEnabled: async (enabled) => {
      if (typeof enabled !== 'boolean') throw new Error('Invalid AdBlock enabled state')
      return adBlockStatusSchema.parse(await ipcRenderer.invoke(browserChannels.setAdBlockEnabled, enabled))
    },
    setSiteAllowed: async (allowed) => {
      if (typeof allowed !== 'boolean') throw new Error('Invalid AdBlock site exception state')
      return adBlockStatusSchema.parse(await ipcRenderer.invoke(browserChannels.setAdBlockSiteAllowed, allowed))
    }
  },
  console: {
    startCapture: async () => { await ipcRenderer.invoke(browserChannels.startConsoleCapture) },
    getEntries: async () => consoleEntrySchema.array().parse(await ipcRenderer.invoke(browserChannels.getConsoleEntries)),
    execute: async (expression) => consoleEntrySchema.parse(await ipcRenderer.invoke(browserChannels.executeConsoleExpression, consoleExpressionSchema.parse(expression))),
    completions: async (prefix) => consoleExpressionSchema.array().parse(await ipcRenderer.invoke(browserChannels.getConsoleCompletions, String(prefix).slice(0, 256))),
    clear: async () => { await ipcRenderer.invoke(browserChannels.clearConsoleEntries) },
    onEntriesChanged: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(browserChannels.consoleChanged, handler)
      return () => ipcRenderer.removeListener(browserChannels.consoleChanged, handler)
    }
  },
  elements: {
    getSnapshot: async () => elementsSnapshotSchema.parse(await ipcRenderer.invoke(browserChannels.getElementsSnapshot)),
    selectNode: async (nodeId) => { await ipcRenderer.invoke(browserChannels.selectElementNode, elementNodeIdSchema.parse(nodeId)) },
    startPicker: async () => { await ipcRenderer.invoke(browserChannels.startElementPicker) },
    stopPicker: async () => { await ipcRenderer.invoke(browserChannels.stopElementPicker) },
    onChanged: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(browserChannels.elementsChanged, handler)
      return () => ipcRenderer.removeListener(browserChannels.elementsChanged, handler)
    }
  },
  storage: {
    getSnapshot: async () => storageSnapshotSchema.parse(await ipcRenderer.invoke(browserChannels.getStorageSnapshot)),
    setValue: async (mutation) => { await ipcRenderer.invoke(browserChannels.setStorageValue, storageMutationSchema.parse(mutation)) },
    removeCookie: async (identity) => { await ipcRenderer.invoke(browserChannels.removeCookie, cookieIdentitySchema.parse(identity)) }
  },
  api: {
    send: async (id, request) => apiResponseSchema.parse(await ipcRenderer.invoke(browserChannels.sendApiRequest, apiSendRequestSchema.parse({ id, request }))),
    cancel: async (id) => { await ipcRenderer.invoke(browserChannels.cancelApiRequest, apiRequestIdSchema.parse(id)) }
  },
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
  devices: {
    ensureView: async (descriptor) => deviceViewSnapshotSchema.parse(await ipcRenderer.invoke(browserChannels.ensureDeviceView, deviceViewDescriptorSchema.parse(descriptor))),
    removeView: async (tabId, deviceId) => { await ipcRenderer.invoke(browserChannels.removeDeviceView, tabIdSchema.parse(tabId), deviceViewIdSchema.parse(deviceId)) },
    reloadView: async (tabId, deviceId) => { await ipcRenderer.invoke(browserChannels.reloadDeviceView, tabIdSchema.parse(tabId), deviceViewIdSchema.parse(deviceId)) },
    captureScreenshot: async (tabId, deviceId) => screenshotResultSchema.parse(await ipcRenderer.invoke(browserChannels.captureDeviceScreenshot, tabIdSchema.parse(tabId), deviceViewIdSchema.parse(deviceId))),
    setVisible: async (tabId, visible) => {
      if (typeof visible !== 'boolean') throw new Error('Invalid device visibility state')
      await ipcRenderer.invoke(browserChannels.setDeviceViewsVisible, tabIdSchema.parse(tabId), visible)
    },
    setViewVisible: async (tabId, deviceId, visible) => {
      if (typeof visible !== 'boolean') throw new Error('Invalid device visibility state')
      await ipcRenderer.invoke(browserChannels.setDeviceViewVisible, tabIdSchema.parse(tabId), deviceViewIdSchema.parse(deviceId), visible)
    },
    setDevToolsTarget: async (tabId, deviceId) => {
      await ipcRenderer.invoke(browserChannels.setDeviceDevToolsTarget, deviceDevToolsTargetSchema.parse({ tabId, deviceId }))
    },
    getLayout: async (tabId) => devicesCanvasLayoutSchema.nullable().parse(await ipcRenderer.invoke(browserChannels.getDevicesCanvasLayout, tabIdSchema.parse(tabId))),
    saveLayout: async (tabId, layout) => { await ipcRenderer.invoke(browserChannels.saveDevicesCanvasLayout, tabIdSchema.parse(tabId), devicesCanvasLayoutSchema.parse(layout)) },
    setNavigationSync: async (enabled) => {
      if (typeof enabled !== 'boolean') throw new Error('Invalid device navigation sync state')
      await ipcRenderer.invoke(browserChannels.setDevicesNavigationSync, enabled)
    }
  },
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
  audio: {
    registerTarget: async (target) => {
      await ipcRenderer.invoke(browserChannels.registerAudioTarget, audioCenterTargetSchema.parse(target))
    },
    getSessions: async () => audioCenterSessionSchema.array().parse(await ipcRenderer.invoke(browserChannels.getAudioSessions)),
    command: async (command) => {
      await ipcRenderer.invoke(browserChannels.audioCommand, audioCenterCommandSchema.parse(command))
    },
    goToSource: async (sessionId) => audioCenterSessionSchema.nullable().parse(await ipcRenderer.invoke(browserChannels.goToAudioSource, audioCenterSessionIdSchema.parse(sessionId))),
    onSessionsChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
        const parsed = audioCenterSessionSchema.array().safeParse(raw)
        if (parsed.success) listener(parsed.data)
      }
      ipcRenderer.on(browserChannels.audioSessionsChanged, handler)
      return () => ipcRenderer.removeListener(browserChannels.audioSessionsChanged, handler)
    }
  },
  screenshots: { capture: async () => screenshotResultSchema.parse(await ipcRenderer.invoke(browserChannels.captureScreenshot)) },
  drm: { getDiagnostics: async () => protectedContentDiagnosticsSchema.parse(await ipcRenderer.invoke(browserChannels.getProtectedContentDiagnostics)) },
  settings: {
    get: async () => browserSettingsSchema.parse(await ipcRenderer.invoke(browserChannels.getSettings)),
    update: async (settings) => browserSettingsSchema.parse(await ipcRenderer.invoke(browserChannels.updateSettings, browserSettingsSchema.parse(settings))),
    generateThemeFromImage: async (source) => imageThemeResultSchema.parse(await ipcRenderer.invoke(browserChannels.generateThemeFromImage, imageThemeRequestSchema.parse({ source })))
  },
  sourceControl: {
    connectRepository: async () => gitConnectRepositoryResultSchema.parse(await ipcRenderer.invoke(gitChannels.connectRepository)),
    getRepository: async () => gitRepositorySchema.nullable().parse(await ipcRenderer.invoke(gitChannels.getRepository)),
    getBranches: async () => gitBranchSchema.array().parse(await ipcRenderer.invoke(gitChannels.getBranches)),
    getCurrentBranch: async () => gitBranchSchema.nullable().parse(await ipcRenderer.invoke(gitChannels.getCurrentBranch)),
    getRepositoryStatus: async () => gitRepositoryStatusCountsSchema.parse(await ipcRenderer.invoke(gitChannels.getRepositoryStatus)),
    getStatus: async () => gitStatusSummarySchema.parse(await ipcRenderer.invoke(gitChannels.getStatus)),
    getFileDiff: async (request) => gitFileDiffSchema.parse(await ipcRenderer.invoke(gitChannels.getFileDiff, gitFileDiffRequestSchema.parse(request))),
    stageFile: async (request) => gitStatusSummarySchema.parse(await ipcRenderer.invoke(gitChannels.stageFile, gitFileOperationSchema.parse(request))),
    unstageFile: async (request) => gitStatusSummarySchema.parse(await ipcRenderer.invoke(gitChannels.unstageFile, gitFileOperationSchema.parse(request))),
    commitStaged: async (request) => gitCommitResultSchema.parse(await ipcRenderer.invoke(gitChannels.commitStaged, gitCommitRequestSchema.parse(request))),
    createBranch: async (request) => gitStatusSummarySchema.parse(await ipcRenderer.invoke(gitChannels.createBranch, gitBranchOperationSchema.parse(request))),
    switchBranch: async (request) => gitStatusSummarySchema.parse(await ipcRenderer.invoke(gitChannels.switchBranch, gitBranchOperationSchema.parse(request))),
    fetch: async () => gitRemoteOperationResultSchema.parse(await ipcRenderer.invoke(gitChannels.fetch)),
    pull: async () => gitRemoteOperationResultSchema.parse(await ipcRenderer.invoke(gitChannels.pull)),
    push: async () => gitRemoteOperationResultSchema.parse(await ipcRenderer.invoke(gitChannels.push)),
    getRecentCommits: async (limit) => gitCommitSchema.array().parse(await ipcRenderer.invoke(gitChannels.getRecentCommits, limit))
  },
  github: {
    getStatus: async () => githubProviderStatusSchema.parse(await ipcRenderer.invoke(githubChannels.getStatus)),
    getRepository: async (request) => githubRepositoryMetadataSchema.parse(await ipcRenderer.invoke(githubChannels.getRepository, githubRepositoryRequestSchema.parse(request))),
    listPullRequests: async (request) => githubPullRequestPageSchema.parse(await ipcRenderer.invoke(githubChannels.listPullRequests, githubPullRequestListRequestSchema.parse(request))),
    getPullRequest: async (request) => githubPullRequestDetailSchema.parse(await ipcRenderer.invoke(githubChannels.getPullRequest, githubPullRequestDetailRequestSchema.parse(request))),
    createPullRequest: async (request) => githubPullRequestCreateResultSchema.parse(await ipcRenderer.invoke(githubChannels.createPullRequest, githubPullRequestCreateRequestSchema.parse(request))),
    listIssues: async (request) => githubIssuePageSchema.parse(await ipcRenderer.invoke(githubChannels.listIssues, githubIssueListRequestSchema.parse(request))),
    listActionsRuns: async (request) => githubActionsRunPageSchema.parse(await ipcRenderer.invoke(githubChannels.listActionsRuns, githubActionsRunListRequestSchema.parse(request))),
    startLogin: async () => githubProviderStatusSchema.parse(await ipcRenderer.invoke(githubChannels.startLogin)),
    cancelLogin: async () => githubProviderStatusSchema.parse(await ipcRenderer.invoke(githubChannels.cancelLogin)),
    disconnect: async () => githubProviderStatusSchema.parse(await ipcRenderer.invoke(githubChannels.disconnect)),
    refreshProfile: async () => githubProviderStatusSchema.parse(await ipcRenderer.invoke(githubChannels.refreshProfile)),
    openProfile: async () => { await ipcRenderer.invoke(githubChannels.openProfile) },
    openAuthorizationUrl: async () => { await ipcRenderer.invoke(githubChannels.openAuthorizationUrl) }
  },
  windowControls: {
    minimize: async () => { await ipcRenderer.invoke(browserChannels.minimizeWindow) },
    toggleMaximize: async () => { await ipcRenderer.invoke(browserChannels.toggleMaximizeWindow) },
    close: async () => { await ipcRenderer.invoke(browserChannels.closeWindow) }
  }
}

contextBridge.exposeInMainWorld('devBrowser', api)
