import type { WebContents } from 'electron'
import type { CookieEntry, CookieIdentity, LocalStorageEntry, StorageMutation, StorageSnapshot } from '../../shared/contracts/browser'

function pageUrl(contents: WebContents): URL | null {
  try {
    const url = new URL(contents.getURL())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch { return null }
}

function cookieEntry(cookie: Electron.Cookie): CookieEntry {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain ?? '',
    path: cookie.path ?? '/',
    expires: cookie.expirationDate,
    secure: cookie.secure ?? false,
    httpOnly: cookie.httpOnly ?? false,
    sameSite: cookie.sameSite
  }
}

export class PageStorage {
  constructor(private readonly contents: WebContents, private readonly ensureAttached: () => Promise<void>) {}

  async snapshot(): Promise<StorageSnapshot> {
    const url = pageUrl(this.contents)
    if (!url) return { url: this.contents.getURL(), cookies: [], localStorage: [], sessionStorage: [] }
    const cookies = (await this.contents.session.cookies.get({ url: url.href })).map(cookieEntry)
    let localStorage: LocalStorageEntry[] = []
    let sessionStorage: LocalStorageEntry[] = []
    let localStorageError: string | undefined
    let sessionStorageError: string | undefined
    try {
      await this.ensureAttached()
      if (this.contents.isDestroyed()) throw new Error('Tab is closed')
      const debuggerApi = this.contents.debugger
      await debuggerApi.sendCommand('DOMStorage.enable')
      const result = await debuggerApi.sendCommand('DOMStorage.getDOMStorageItems', {
        storageId: { securityOrigin: url.origin, isLocalStorage: true }
      }) as { entries: [string, string][] }
      localStorage = result.entries.map(([key, value]) => ({ key, value }))
    } catch (error) { localStorageError = String(error) }
    try {
      await this.ensureAttached()
      if (this.contents.isDestroyed()) throw new Error('Tab is closed')
      const result = await this.contents.debugger.sendCommand('DOMStorage.getDOMStorageItems', {
        storageId: { securityOrigin: url.origin, isLocalStorage: false }
      }) as { entries: [string, string][] }
      sessionStorage = result.entries.map(([key, value]) => ({ key, value }))
    } catch (error) { sessionStorageError = String(error) }
    return { url: url.href, cookies, localStorage, sessionStorage, localStorageError, sessionStorageError }
  }

  async setValue(mutation: StorageMutation): Promise<void> {
    const url = pageUrl(this.contents)
    if (!url) throw new Error('No HTTP(S) page is active')
    if (mutation.area === 'cookie') {
      const cookies = await this.contents.session.cookies.get({ url: url.href })
      const target = cookies.find((cookie) => cookie.name === mutation.cookie.name && (cookie.domain ?? '') === mutation.cookie.domain && (cookie.path ?? '/') === mutation.cookie.path && (cookie.secure ?? false) === mutation.cookie.secure)
      if (!target) throw new Error('Cookie is no longer available on this page')
      await this.contents.session.cookies.set({ url: url.origin, name: target.name, value: mutation.value, domain: target.domain, path: target.path, secure: target.secure, httpOnly: target.httpOnly, sameSite: target.sameSite, expirationDate: target.expirationDate })
      return
    }
    await this.ensureAttached()
    if (this.contents.isDestroyed()) throw new Error('Tab is closed')
    await this.contents.debugger.sendCommand('DOMStorage.enable')
    await this.contents.debugger.sendCommand('DOMStorage.setDOMStorageItem', {
      storageId: { securityOrigin: url.origin, isLocalStorage: mutation.area === 'localStorage' },
      key: mutation.key,
      value: mutation.value
    })
  }

  async removeCookie(identity: CookieIdentity): Promise<void> {
    const url = pageUrl(this.contents)
    if (!url) throw new Error('No HTTP(S) page is active')
    const cookies = await this.contents.session.cookies.get({ url: url.href })
    const target = cookies.find((cookie) => cookie.name === identity.name && (cookie.domain ?? '') === identity.domain && (cookie.path ?? '/') === identity.path && (cookie.secure ?? false) === identity.secure)
    if (!target) throw new Error('Cookie is no longer available on this page')
    const removalUrl = new URL(target.path ?? '/', url.origin)
    if (target.secure) removalUrl.protocol = 'https:'
    await this.contents.session.cookies.remove(removalUrl.href, target.name)
  }
}
