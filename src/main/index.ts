import * as electron from 'electron'
import { join } from 'node:path'
import { registerBrowserIpc } from './ipc/browser'
import { registerGitIpc } from './ipc/git'
import { registerGitHubIpc } from './ipc/github'
import { GitService } from './git/git.service'
import { GitHubAuthService } from './github/github-auth.service'
import { GitHubCredentialStore } from './github/github-credential.store'
import { GitHubProvider } from './github/github.provider'
import { GitHubRepositoryService } from './github/github-repository.service'
import { openDatabase } from './storage/database'
import { SettingsRepository } from './storage/SettingsRepository'
import { StartupConfigRepository } from './storage/StartupConfigRepository'
import { WorkspaceRepository } from './storage/WorkspaceRepository'
import { WorkspaceManager } from './workspaces/WorkspaceManager'
import { TerminalManager } from './terminal/TerminalManager'
import { chromeLikeUserAgent } from './browser/userAgent'
import { installCommandShortcutMenu } from './browser/commandShortcuts'
import { browserChannels, type StartupConfig } from '../shared/contracts/browser'
import { shortcutIdForKeyboardEvent } from '../shared/shortcuts'

const { app, BrowserWindow } = electron
app.userAgentFallback = chromeLikeUserAgent()
const shellSenderIds = new Set<number>()
const workspaceManagers = new Map<number, WorkspaceManager>()
const terminalManagers = new Map<number, TerminalManager>()
const gitService = new GitService()

type ComponentsApi = {
  whenReady: () => Promise<void>
  status?: () => unknown
}

async function waitForProtectedContentComponents(): Promise<void> {
  const components = (electron as typeof electron & { components?: ComponentsApi }).components
  if (!components) {
    console.warn('Widevine component API unavailable. DRM protected content requires the castLabs Electron build.')
    return
  }

  try {
    await components.whenReady()
    console.info('Protected content components ready', components.status?.())
  } catch (error) {
    console.error('Failed to initialize protected content components', error)
  }
}

function createWindow(repository: WorkspaceRepository, settings: SettingsRepository, startupConfig: StartupConfig): void {
  const window = new BrowserWindow({
    show: false,
    frame: false,
    width: 900,
    height: 620,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: startupConfig.browserSettings.theme.colors.bgPrimary,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      additionalArguments: [`--stackly-startup-config=${encodeURIComponent(JSON.stringify(startupConfig))}`],
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: true,
      devTools: !app.isPackaged
    }
  })

  const shellSenderId = window.webContents.id
  shellSenderIds.add(shellSenderId)
  const workspaces = new WorkspaceManager(window, repository, settings)
  const terminals = new TerminalManager(window)
  workspaceManagers.set(shellSenderId, workspaces)
  terminalManagers.set(shellSenderId, terminals)
  window.on('closed', () => {
    shellSenderIds.delete(shellSenderId)
    workspaceManagers.delete(shellSenderId)
    terminalManagers.delete(shellSenderId)
    workspaces.dispose()
    terminals.dispose()
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('did-attach-webview', (_event, contents) => {
    contents.on('before-input-event', (event, input) => {
      const shortcutId = shortcutIdForKeyboardEvent({
        key: input.key,
        ctrlKey: input.control,
        metaKey: input.meta,
        altKey: input.alt,
        shiftKey: input.shift
      }, process.platform)
      if (shortcutId !== 'next-tab' && shortcutId !== 'previous-tab') return
      event.preventDefault()
      if (!window.webContents.isDestroyed()) window.webContents.send(browserChannels.commandShortcut, shortcutId)
    })
    contents.setWindowOpenHandler(({ url, disposition }) => {
      try {
        const destination = new URL(url)
        if (destination.protocol === 'http:' || destination.protocol === 'https:') {
          queueMicrotask(() => workspaces.openUrlFromWebContents(contents.id, destination.href, disposition !== 'background-tab'))
        }
      } catch { /* Invalid and unsupported destinations remain blocked. */ }
      return { action: 'deny' }
    })
  })
  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) window.show()
  })
  // window.webContents.once('did-finish-load', () => {
  //   if (!app.isPackaged && !window.webContents.isDestroyed()) window.webContents.openDevTools()
  // })
  installCommandShortcutMenu(window)

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await waitForProtectedContentComponents()
  const database = openDatabase()
  const startup = new StartupConfigRepository()
  const repository = new WorkspaceRepository(database)
  const settings = new SettingsRepository(database, startup)
  const startupConfig = startup.syncBrowserSettings(settings.getBrowserSettings())
  const githubCredentials = new GitHubCredentialStore()
  const githubAuthService = new GitHubAuthService(githubCredentials, settings)
  const githubRepositoryService = new GitHubRepositoryService(githubAuthService)
  const githubProvider = new GitHubProvider(githubAuthService, githubRepositoryService)
  await githubProvider.restoreSession()
  app.on('will-quit', () => database.close())
  registerBrowserIpc(shellSenderIds, workspaceManagers, terminalManagers)
  registerGitIpc(shellSenderIds, workspaceManagers, gitService)
  registerGitHubIpc(shellSenderIds, githubProvider)
  createWindow(repository, settings, startupConfig)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(repository, settings, startup.read())
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
