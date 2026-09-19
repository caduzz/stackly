import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerBrowserIpc } from './ipc/browser'
import { openDatabase } from './storage/database'
import { SettingsRepository } from './storage/SettingsRepository'
import { WorkspaceRepository } from './storage/WorkspaceRepository'
import { WorkspaceManager } from './workspaces/WorkspaceManager'
import { TerminalManager } from './terminal/TerminalManager'

const shellSenderIds = new Set<number>()
const workspaceManagers = new Map<number, WorkspaceManager>()
const terminalManagers = new Map<number, TerminalManager>()

function createWindow(repository: WorkspaceRepository, settings: SettingsRepository): void {
  const window = new BrowserWindow({
    frame: false,
    width: 900,
    height: 620,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#1D2533',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      devTools: !app.isPackaged
    }
  })

  shellSenderIds.add(window.webContents.id)
  const workspaces = new WorkspaceManager(window, repository, settings)
  const terminals = new TerminalManager(window)
  workspaceManagers.set(window.webContents.id, workspaces)
  terminalManagers.set(window.webContents.id, terminals)
  window.on('closed', () => {
    shellSenderIds.delete(window.webContents.id)
    workspaceManagers.delete(window.webContents.id)
    terminalManagers.delete(window.webContents.id)
    workspaces.dispose()
    terminals.dispose()
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const database = openDatabase()
  const repository = new WorkspaceRepository(database)
  const settings = new SettingsRepository(database)
  app.on('will-quit', () => database.close())
  registerBrowserIpc(shellSenderIds, workspaceManagers, terminalManagers)
  createWindow(repository, settings)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(repository, settings)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
