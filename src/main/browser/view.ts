import { app, WebContentsView, type BrowserWindow, type Session } from 'electron'
import type { NavigationState } from '../../shared/contracts/browser'
import { registerPaletteShortcut } from './paletteShortcut'

export type BrowserViewHandle = {
  view: WebContentsView
  disposeListeners: () => void
}

export function createBrowserView(window: BrowserWindow, session: Session, onStateChange: (state: NavigationState) => void, isPaletteOpen: () => boolean, onOpenUrl: (url: string) => void): BrowserViewHandle {
  const view = new WebContentsView({
    webPreferences: {
      session,
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

  view.setBounds({ x: 0, y: 0, width: 1, height: 1 })
  view.setVisible(false)
  view.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const destination = new URL(url)
      if (destination.protocol === 'http:' || destination.protocol === 'https:') queueMicrotask(() => onOpenUrl(destination.href))
    } catch { /* Invalid and unsupported destinations remain blocked. */ }
    return { action: 'deny' }
  })
  registerPaletteShortcut(view.webContents, window.webContents, isPaletteOpen)
  view.webContents.on('will-navigate', (event, url) => {
    try {
      if (!['http:', 'https:'].includes(new URL(url).protocol)) event.preventDefault()
    } catch {
      event.preventDefault()
    }
  })

  const sendState = (): void => onStateChange(getNavigationState(view))
  view.webContents.on('did-start-loading', sendState)
  view.webContents.on('did-stop-loading', sendState)
  view.webContents.on('did-navigate', sendState)
  view.webContents.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
    if (isMainFrame) sendState()
  })
  view.webContents.on('page-title-updated', sendState)
  window.contentView.addChildView(view)

  return {
    view,
    disposeListeners: () => {
      for (const event of ['before-input-event', 'will-navigate', 'did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page', 'page-title-updated']) {
        view.webContents.removeAllListeners(event)
      }
    }
  }
}

export function getNavigationState(view: WebContentsView): NavigationState {
  const contents = view.webContents
  const index = contents.navigationHistory.getActiveIndex()
  const length = contents.navigationHistory.length()
  return {
    url: contents.getURL() === 'about:blank' ? '' : contents.getURL(),
    title: contents.getTitle() || 'New Tab',
    isLoading: contents.isLoading(),
    canGoBack: index > 0,
    canGoForward: index >= 0 && index < length - 1
  }
}
