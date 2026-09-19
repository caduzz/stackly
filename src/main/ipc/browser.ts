import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { apiRequestSchema, browserBoundsSchema, browserChannels, browserSettingsSchema, cookieIdentitySchema, environmentConfigSchema, environmentIdSchema, navigateSchema, splitViewSchema, tabIdSchema, terminalIdSchema, terminalInputSchema, terminalResizeSchema, viewportPresetSchema, workspaceIdSchema, workspaceNameSchema } from '../../shared/contracts/browser'
import { sendApiRequest } from '../api/sendApiRequest'
import { getNavigationState } from '../browser/view'
import type { WorkspaceManager } from '../workspaces/WorkspaceManager'
import type { TerminalManager } from '../terminal/TerminalManager'
import { scanLocalServices } from '../local/LocalServiceDetector'
import { captureScreenshot } from '../screenshots/captureScreenshot'

export function registerBrowserIpc(allowedSenderIds: Set<number>, workspaceManagers: Map<number, WorkspaceManager>, terminalManagers: Map<number, TerminalManager>): void {
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
    const view = getManager(event).getActiveView()
    await view.webContents.loadURL(navigateSchema.parse(url))
  })
  ipcMain.handle(browserChannels.back, async (event) => {
    const history = getManager(event).getActiveView().webContents.navigationHistory
    const index = history.getActiveIndex()
    if (index > 0) await history.goToIndex(index - 1)
  })
  ipcMain.handle(browserChannels.forward, async (event) => {
    const history = getManager(event).getActiveView().webContents.navigationHistory
    const index = history.getActiveIndex()
    if (index >= 0 && index < history.length() - 1) await history.goToIndex(index + 1)
  })
  ipcMain.handle(browserChannels.reload, (event) => {
    getManager(event).getActiveView().webContents.reload()
  })
  ipcMain.handle(browserChannels.getNavigationState, (event) => {
    return getNavigationState(getManager(event).getActiveView())
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
  ipcMain.handle(browserChannels.setSplitView, async (event, raw: unknown) => {
    const config = splitViewSchema.parse(raw)
    await getWorkspaces(event).setSplitView(config.environmentId, config.syncPath)
  })
  ipcMain.handle(browserChannels.setViewportPreset, (event, raw: unknown) => {
    getWorkspaces(event).setViewportPreset(viewportPresetSchema.parse(raw))
  })
  ipcMain.handle(browserChannels.createTab, (event) => getManager(event).create())
  ipcMain.handle(browserChannels.closeTab, (event, id: unknown) => {
    getManager(event).close(tabIdSchema.parse(id))
  })
  ipcMain.handle(browserChannels.selectTab, (event, id: unknown) => {
    getManager(event).select(tabIdSchema.parse(id))
  })
  ipcMain.handle(browserChannels.getTabsState, (event) => getManager(event).snapshot())
  ipcMain.handle(browserChannels.startNetworkCapture, async (event) => {
    await getManager(event).startNetworkCapture()
  })
  ipcMain.handle(browserChannels.getNetworkEntries, (event) => getManager(event).networkEntries())
  ipcMain.handle(browserChannels.startConsoleCapture, async (event) => {
    await getManager(event).startConsoleCapture()
  })
  ipcMain.handle(browserChannels.getConsoleEntries, (event) => getManager(event).consoleEntries())
  ipcMain.handle(browserChannels.clearConsoleEntries, (event) => getManager(event).clearConsoleEntries())
  ipcMain.handle(browserChannels.getStorageSnapshot, (event) => getManager(event).storageSnapshot())
  ipcMain.handle(browserChannels.removeCookie, (event, identity: unknown) => getManager(event).removeCookie(cookieIdentitySchema.parse(identity)))
  ipcMain.handle(browserChannels.sendApiRequest, (event, request: unknown) => {
    assertShellSender(event)
    return sendApiRequest(apiRequestSchema.parse(request))
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
    const manager = getWorkspaces(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('Browser window is unavailable')
    return captureScreenshot(window, manager.activeTabs().getActiveView().webContents)
  })
  ipcMain.handle(browserChannels.getSettings, (event) => getWorkspaces(event).getSettings())
  ipcMain.handle(browserChannels.updateSettings, (event, raw: unknown) => getWorkspaces(event).updateSettings(browserSettingsSchema.parse(raw)))
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
  ipcMain.handle(browserChannels.selectEnvironment, async (event, id: unknown) => {
    await getWorkspaces(event).selectEnvironment(environmentIdSchema.parse(id))
  })
  ipcMain.handle(browserChannels.updateEnvironment, (event, id: unknown, config: unknown) => getWorkspaces(event).updateEnvironment(environmentIdSchema.parse(id), environmentConfigSchema.parse(config)))
  ipcMain.handle(browserChannels.deleteEnvironment, (event, id: unknown) => getWorkspaces(event).deleteEnvironment(environmentIdSchema.parse(id)))
}
