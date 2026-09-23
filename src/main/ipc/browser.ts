import { BrowserWindow, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { apiRequestIdSchema, apiSendRequestSchema, browserBoundsSchema, browserChannels, browserSettingsSchema, consoleExpressionSchema, cookieIdentitySchema, createTabRequestSchema, deviceDevToolsTargetSchema, devicesCanvasLayoutSchema, deviceViewDescriptorSchema, deviceViewIdSchema, elementNodeIdSchema, environmentConfigSchema, environmentIdSchema, imageThemeRequestSchema, navigateSchema, navigationHistoryVisitSchema, splitViewSchema, storageMutationSchema, tabIdSchema, tabOrderSchema, tabStateUpdateSchema, tabWebContentsTargetSchema, terminalIdSchema, terminalInputSchema, terminalResizeSchema, viewportPresetSchema, workspaceIdSchema, workspaceNameSchema } from '../../shared/contracts/browser'
import { sendApiRequest } from '../api/sendApiRequest'
import { generateThemeFromImage } from '../browser/imageTheme'
import type { WorkspaceManager } from '../workspaces/WorkspaceManager'
import type { TerminalManager } from '../terminal/TerminalManager'
import { scanLocalServices } from '../local/LocalServiceDetector'
import { captureScreenshot } from '../screenshots/captureScreenshot'

export function registerBrowserIpc(allowedSenderIds: Set<number>, workspaceManagers: Map<number, WorkspaceManager>, terminalManagers: Map<number, TerminalManager>): void {
  const apiRequests = new Map<string, AbortController>()
  function assertShellSender(event: IpcMainInvokeEvent): void {
    if (!allowedSenderIds.has(event.sender.id) || event.senderFrame !== event.sender.mainFrame) {
      throw new Error('Browser API is available only to the local shell')
    }
  }

  function getWorkspaces(event: IpcMainInvokeEvent): WorkspaceManager {
    assertShellSender(event)
    const manager = workspaceManagers.get(event.sender.id)
    if (!manager) throw new Error('Workspace manager is unavailable')
    return manager
  }

  function getManager(event: IpcMainInvokeEvent) { return getWorkspaces(event).activeTabs() }
  function getTerminals(event: IpcMainInvokeEvent): TerminalManager {
    assertShellSender(event)
    const manager = terminalManagers.get(event.sender.id)
    if (!manager) throw new Error('Terminal manager is unavailable')
    return manager
  }

  ipcMain.handle(browserChannels.navigate, async (event, url: unknown) => {
    const manager = getManager(event)
    const destination = navigateSchema.parse(url)
    const activeTabId = manager.snapshot().activeTabId ?? manager.create(destination)
    manager.updateState({ id: activeTabId, url: destination, title: new URL(destination).hostname, isLoading: true })
  })
  ipcMain.handle(browserChannels.back, (event) => { getManager(event) })
  ipcMain.handle(browserChannels.forward, (event) => { getManager(event) })
  ipcMain.handle(browserChannels.reload, (event) => { getManager(event) })
  ipcMain.handle(browserChannels.openExternal, async (event, url: unknown) => {
    getWorkspaces(event)
    await shell.openExternal(navigateSchema.parse(url))
  })
  ipcMain.handle(browserChannels.getNavigationState, (event) => {
    const snapshot = getManager(event).snapshot()
    return snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId) ?? { url: '', title: 'New Tab', isLoading: false, canGoBack: false, canGoForward: false }
  })
  ipcMain.handle(browserChannels.setBrowserBounds, (event, rect: unknown) => {
    const bounds = browserBoundsSchema.parse(rect)
    getWorkspaces(event).setBounds(bounds)
  })
  ipcMain.handle(browserChannels.setPaletteOpen, async (event, open: unknown) => {
    if (typeof open !== 'boolean') throw new Error('Invalid palette state')
    await getWorkspaces(event).setPaletteOpen(open)
  })
  ipcMain.handle(browserChannels.setPanelResizing, (event, resizing: unknown) => {
    if (typeof resizing !== 'boolean') throw new Error('Invalid resize state')
    getWorkspaces(event).setPanelResizing(resizing)
  })
  ipcMain.handle(browserChannels.setBrowserContentVisible, (event, visible: unknown) => {
    if (typeof visible !== 'boolean') throw new Error('Invalid browser visibility state')
    getWorkspaces(event).setBrowserContentVisible(visible)
  })
  ipcMain.handle(browserChannels.setChromeOverlayOpen, async (event, open: unknown) => {
    if (typeof open !== 'boolean') throw new Error('Invalid chrome overlay state')
    await getWorkspaces(event).setChromeOverlayOpen(open)
  })
  ipcMain.handle(browserChannels.setTooltipOpen, async (event, open: unknown) => {
    if (typeof open !== 'boolean') throw new Error('Invalid tooltip overlay state')
    await getWorkspaces(event).setTooltipOpen(open)
  })
  ipcMain.handle(browserChannels.setSplitView, async (event, raw: unknown) => {
    const config = splitViewSchema.parse(raw)
    await getWorkspaces(event).setSplitView(config.environmentId, config.syncPath)
  })
  ipcMain.handle(browserChannels.setViewportPreset, (event, raw: unknown) => {
    getWorkspaces(event).setViewportPreset(viewportPresetSchema.parse(raw))
  })
  ipcMain.handle(browserChannels.ensureDeviceView, (event, raw: unknown) => {
    return getWorkspaces(event).activeDeviceViews().ensureView(deviceViewDescriptorSchema.parse(raw))
  })
  ipcMain.handle(browserChannels.removeDeviceView, (event, rawTabId: unknown, rawDeviceId: unknown) => {
    getWorkspaces(event).activeDeviceViews().disposeDevice(tabIdSchema.parse(rawTabId), deviceViewIdSchema.parse(rawDeviceId))
  })
  ipcMain.handle(browserChannels.reloadDeviceView, (event, rawTabId: unknown, rawDeviceId: unknown) => {
    getWorkspaces(event).activeDeviceViews().reloadDevice(tabIdSchema.parse(rawTabId), deviceViewIdSchema.parse(rawDeviceId))
  })
  ipcMain.handle(browserChannels.captureDeviceScreenshot, (event, rawTabId: unknown, rawDeviceId: unknown) => {
    return getWorkspaces(event).activeDeviceViews().captureDeviceScreenshot(tabIdSchema.parse(rawTabId), deviceViewIdSchema.parse(rawDeviceId))
  })
  ipcMain.handle(browserChannels.setDeviceViewsVisible, (event, rawTabId: unknown, rawVisible: unknown) => {
    if (typeof rawVisible !== 'boolean') throw new Error('Invalid device visibility state')
    getWorkspaces(event).activeDeviceViews().setVisibleForTab(tabIdSchema.parse(rawTabId), rawVisible)
  })
  ipcMain.handle(browserChannels.setDeviceViewVisible, (event, rawTabId: unknown, rawDeviceId: unknown, rawVisible: unknown) => {
    if (typeof rawVisible !== 'boolean') throw new Error('Invalid device visibility state')
    getWorkspaces(event).activeDeviceViews().setVisibleForDevice(tabIdSchema.parse(rawTabId), deviceViewIdSchema.parse(rawDeviceId), rawVisible)
  })
  ipcMain.handle(browserChannels.setDeviceDevToolsTarget, (event, raw: unknown) => {
    const target = deviceDevToolsTargetSchema.parse(raw)
    getWorkspaces(event).activeDeviceViews().setDevToolsTarget(target.tabId, target.deviceId)
  })
  ipcMain.handle(browserChannels.getDevicesCanvasLayout, (event, rawTabId: unknown) => getWorkspaces(event).getDevicesCanvasLayout(tabIdSchema.parse(rawTabId)))
  ipcMain.handle(browserChannels.saveDevicesCanvasLayout, (event, rawTabId: unknown, raw: unknown) => {
    getWorkspaces(event).saveDevicesCanvasLayout(tabIdSchema.parse(rawTabId), devicesCanvasLayoutSchema.parse(raw))
  })
  ipcMain.handle(browserChannels.setDevicesNavigationSync, (event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new Error('Invalid device navigation sync state')
    getWorkspaces(event).activeDeviceViews().setNavigationSync(enabled)
  })
  ipcMain.handle(browserChannels.createTab, (event, raw: unknown) => {
    const request = createTabRequestSchema.parse(raw ?? {})
    const url = request.url ? navigateSchema.parse(request.url) : ''
    return getManager(event).create(url, false, request.active, request.kind)
  })
  ipcMain.handle(browserChannels.closeTab, (event, id: unknown) => {
    getManager(event).close(tabIdSchema.parse(id))
  })
  ipcMain.handle(browserChannels.reopenClosedTab, (event) => {
    return getWorkspaces(event).reopenClosedTab()
  })
  ipcMain.handle(browserChannels.selectTab, (event, id: unknown) => {
    getManager(event).select(tabIdSchema.parse(id))
  })
  ipcMain.handle(browserChannels.reorderTabs, (event, ids: unknown) => {
    getManager(event).reorder(tabOrderSchema.parse(ids))
  })
  ipcMain.handle(browserChannels.updateTabState, (event, state: unknown) => {
    getManager(event).updateState(tabStateUpdateSchema.parse(state))
  })
  ipcMain.handle(browserChannels.setTabWebContentsTarget, (event, raw: unknown) => {
    const target = tabWebContentsTargetSchema.parse(raw)
    getManager(event).setWebContentsTarget(target.tabId, target.webContentsId)
  })
  ipcMain.handle(browserChannels.setTabAudioMuted, (event, id: unknown, muted: unknown) => {
    if (typeof muted !== 'boolean') throw new Error('Invalid muted state')
    getWorkspaces(event).setTabAudioMuted(tabIdSchema.parse(id), muted)
  })
  ipcMain.handle(browserChannels.getHistory, (event, query: unknown) => {
    return getWorkspaces(event).getHistory(typeof query === 'string' ? query : '')
  })
  ipcMain.handle(browserChannels.recordHistory, (event, raw: unknown) => {
    getWorkspaces(event).recordHistory(navigationHistoryVisitSchema.parse(raw))
  })
  ipcMain.handle(browserChannels.removeHistoryEntry, (event, id: unknown) => {
    getWorkspaces(event).deleteHistoryEntry(workspaceIdSchema.parse(id))
  })
  ipcMain.handle(browserChannels.clearHistory, (event) => {
    getWorkspaces(event).clearHistory()
  })
  ipcMain.handle(browserChannels.getTabsState, (event) => getManager(event).snapshot())
  ipcMain.handle(browserChannels.startNetworkCapture, async (event) => {
    await getWorkspaces(event).resolveActiveTarget()?.tools.startNetworkCapture()
  })
  ipcMain.handle(browserChannels.getNetworkEntries, (event) => {
    return getWorkspaces(event).resolveActiveTarget()?.tools.networkEntries() ?? []
  })
  ipcMain.handle(browserChannels.clearNetworkEntries, (event) => {
    getWorkspaces(event).resolveActiveTarget()?.tools.clearNetworkEntries()
  })
  ipcMain.handle(browserChannels.startConsoleCapture, async (event) => {
    await getWorkspaces(event).resolveActiveTarget()?.tools.startConsoleCapture()
  })
  ipcMain.handle(browserChannels.getConsoleEntries, (event) => {
    return getWorkspaces(event).resolveActiveTarget()?.tools.consoleEntries() ?? []
  })
  ipcMain.handle(browserChannels.executeConsoleExpression, (event, expression: unknown) => {
    return getWorkspaces(event).requireActiveTarget().tools.executeConsoleExpression(consoleExpressionSchema.parse(expression))
  })
  ipcMain.handle(browserChannels.getConsoleCompletions, (event, prefix: unknown) => {
    return getWorkspaces(event).requireActiveTarget().tools.consoleCompletions(String(prefix).slice(0, 256))
  })
  ipcMain.handle(browserChannels.clearConsoleEntries, (event) => {
    getWorkspaces(event).resolveActiveTarget()?.tools.clearConsoleEntries()
  })
  ipcMain.handle(browserChannels.getElementsSnapshot, (event) => {
    return getWorkspaces(event).resolveActiveTarget()?.tools.elementsSnapshot() ?? { root: null, selectedNodeId: null, box: null }
  })
  ipcMain.handle(browserChannels.selectElementNode, (event, raw: unknown) => {
    return getWorkspaces(event).requireActiveTarget().tools.selectElementNode(elementNodeIdSchema.parse(raw))
  })
  ipcMain.handle(browserChannels.startElementPicker, (event) => {
    return getWorkspaces(event).resolveActiveTarget()?.tools.startElementPicker()
  })
  ipcMain.handle(browserChannels.stopElementPicker, (event) => {
    return getWorkspaces(event).resolveActiveTarget()?.tools.stopElementPicker()
  })
  ipcMain.handle(browserChannels.getStorageSnapshot, (event) => {
    return getWorkspaces(event).requireActiveTarget().tools.storageSnapshot()
  })
  ipcMain.handle(browserChannels.setStorageValue, (event, raw: unknown) => {
    return getWorkspaces(event).requireActiveTarget().tools.setStorageValue(storageMutationSchema.parse(raw))
  })
  ipcMain.handle(browserChannels.removeCookie, (event, identity: unknown) => {
    const cookie = cookieIdentitySchema.parse(identity)
    return getWorkspaces(event).requireActiveTarget().tools.removeCookie(cookie)
  })
  ipcMain.handle(browserChannels.sendApiRequest, async (event, raw: unknown) => {
    assertShellSender(event)
    const payload = apiSendRequestSchema.parse(raw)
    const controller = new AbortController()
    apiRequests.set(payload.id, controller)
    try {
      return await sendApiRequest(payload.request, controller.signal)
    } finally {
      apiRequests.delete(payload.id)
    }
  })
  ipcMain.handle(browserChannels.cancelApiRequest, (event, raw: unknown) => {
    assertShellSender(event)
    apiRequests.get(apiRequestIdSchema.parse(raw))?.abort()
  })
  ipcMain.handle(browserChannels.createTerminal, (event) => getTerminals(event).create())
  ipcMain.handle(browserChannels.writeTerminal, (event, raw: unknown) => {
    const input = terminalInputSchema.parse(raw)
    getTerminals(event).write(input.id, input.data)
  })
  ipcMain.handle(browserChannels.resizeTerminal, (event, raw: unknown) => {
    const size = terminalResizeSchema.parse(raw)
    getTerminals(event).resize(size.id, size.cols, size.rows)
  })
  ipcMain.handle(browserChannels.closeTerminal, (event, id: unknown) => getTerminals(event).close(terminalIdSchema.parse(id)))
  ipcMain.handle(browserChannels.scanLocalServices, (event) => {
    assertShellSender(event)
    return scanLocalServices()
  })
  ipcMain.handle(browserChannels.getDownloads, (event) => getWorkspaces(event).downloads())
  ipcMain.handle(browserChannels.captureScreenshot, (event) => {
    getWorkspaces(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('Browser window is unavailable')
    return captureScreenshot(window, window.webContents)
  })
  ipcMain.handle(browserChannels.getSettings, (event) => getWorkspaces(event).getSettings())
  ipcMain.handle(browserChannels.updateSettings, (event, raw: unknown) => getWorkspaces(event).updateSettings(browserSettingsSchema.parse(raw)))
  ipcMain.handle(browserChannels.generateThemeFromImage, (event, raw: unknown) => {
    getWorkspaces(event)
    return generateThemeFromImage(imageThemeRequestSchema.parse(raw).source)
  })
  ipcMain.handle(browserChannels.minimizeWindow, (event) => {
    getWorkspaces(event)
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle(browserChannels.toggleMaximizeWindow, (event) => {
    getWorkspaces(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('Browser window is unavailable')
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.handle(browserChannels.closeWindow, (event) => {
    getWorkspaces(event)
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle(browserChannels.createWorkspace, (event) => getWorkspaces(event).create())
  ipcMain.handle(browserChannels.selectWorkspace, (event, id: unknown) => {
    getWorkspaces(event).select(workspaceIdSchema.parse(id))
  })
  ipcMain.handle(browserChannels.renameWorkspace, (event, id: unknown, name: unknown) => getWorkspaces(event).rename(workspaceIdSchema.parse(id), workspaceNameSchema.parse(name)))
  ipcMain.handle(browserChannels.deleteWorkspace, (event, id: unknown) => getWorkspaces(event).delete(workspaceIdSchema.parse(id)))
  ipcMain.handle(browserChannels.getWorkspacesState, (event) => getWorkspaces(event).snapshot())
  ipcMain.handle(browserChannels.addEnvironment, (event, config: unknown) => {
    return getWorkspaces(event).addEnvironment(environmentConfigSchema.parse(config))
  })
  ipcMain.handle(browserChannels.selectEnvironment, (event, id: unknown, currentUrl: unknown) => {
    const url = typeof currentUrl === 'string' ? currentUrl : ''
    return getWorkspaces(event).selectEnvironment(environmentIdSchema.parse(id), url)
  })
  ipcMain.handle(browserChannels.updateEnvironment, (event, id: unknown, config: unknown) => getWorkspaces(event).updateEnvironment(environmentIdSchema.parse(id), environmentConfigSchema.parse(config)))
  ipcMain.handle(browserChannels.deleteEnvironment, (event, id: unknown) => getWorkspaces(event).deleteEnvironment(environmentIdSchema.parse(id)))
}
