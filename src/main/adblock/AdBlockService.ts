import { app, webContents, type Session } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { adBlockSettingsSchema, type AdBlockBlockedRequest, type AdBlockSettings, type AdBlockStatus } from '../../shared/contracts/browser'
import type { SettingsRepository } from '../storage/SettingsRepository'

type ElectronBlocker = {
  match: (request: unknown, withMetadata?: boolean) => { match: boolean; exception?: unknown; filter?: unknown }
}
type GhosteryModule = {
  ElectronBlocker: {
    fromPrebuiltAdsAndTracking: (fetchImpl?: typeof fetch, caching?: {
      path: string
      read: (path: string) => Promise<Uint8Array>
      write: (path: string, buffer: Uint8Array) => Promise<void>
    }) => Promise<ElectronBlocker>
  }
  fromElectronDetails: (details: Electron.OnBeforeRequestListenerDetails) => unknown
}
type SessionStats = { totalBlocked: number; blockedByWebContents: Map<number, AdBlockBlockedRequest[]> }

const ENGINE_CACHE = join(app.getPath('userData'), 'adblock', 'engine.bin')
const SETTINGS_PREFIX = 'adBlockWorkspaceSettings:'
const MAX_BLOCKED_PER_CONTENTS = 500
const GHOSTERY_ADBLOCKER_ELECTRON = '@ghostery/adblocker-electron'

const storedSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  siteExceptions: z.array(z.string()).default([])
})

let blockerPromise: Promise<ElectronBlocker> | null = null
let fromElectronDetails: GhosteryModule['fromElectronDetails'] | null = null

function settingsKey(workspaceId: string): string {
  return `${SETTINGS_PREFIX}${workspaceId}`
}

function normalizeHostname(value: string): string | null {
  try {
    const parsed = new URL(value)
    return parsed.hostname.toLocaleLowerCase()
  } catch {
    const trimmed = value.trim().toLocaleLowerCase()
    return trimmed && !trimmed.includes('/') ? trimmed : null
  }
}

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch { return false }
}

async function loadBlocker(): Promise<ElectronBlocker> {
  if (!blockerPromise) {
    blockerPromise = import(GHOSTERY_ADBLOCKER_ELECTRON).then(async (module) => {
      const ghostery = module as GhosteryModule
      fromElectronDetails = ghostery.fromElectronDetails
      await mkdir(join(app.getPath('userData'), 'adblock'), { recursive: true })
      return ghostery.ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
        path: ENGINE_CACHE,
        read: readFile,
        write: writeFile
      })
    })
  }
  return blockerPromise
}

export class AdBlockService {
  private settings: AdBlockSettings
  private blocker: ElectronBlocker | null = null
  private disposed = false
  private readonly stats: SessionStats = { totalBlocked: 0, blockedByWebContents: new Map() }

  constructor(private readonly workspaceId: string, private readonly browserSession: Session, private readonly repository: SettingsRepository, private readonly onBlockedRequest: () => void = () => {}) {
    this.settings = this.readSettings()
    this.browserSession.webRequest.onBeforeRequest((details, callback) => {
      callback(this.shouldBlock(details))
    })
    void loadBlocker().then((blocker) => {
      if (this.disposed) return
      this.blocker = blocker
    }).catch((error: unknown) => console.error('Failed to initialize AdBlock engine', error))
  }

  getStatus(url: string, webContentsId: number | null): AdBlockStatus {
    const hostname = normalizeHostname(url)
    const siteAllowed = hostname ? this.settings.siteExceptions.includes(hostname) : false
    return {
      enabled: this.settings.enabled,
      siteHostname: hostname,
      siteAllowed,
      blockedInTarget: webContentsId ? this.stats.blockedByWebContents.get(webContentsId)?.length ?? 0 : 0,
      blockedInWorkspace: this.stats.totalBlocked
    }
  }

  getBlockedRequests(webContentsId: number): AdBlockBlockedRequest[] {
    return [...(this.stats.blockedByWebContents.get(webContentsId) ?? [])]
  }

  setEnabled(enabled: boolean): AdBlockSettings {
    this.settings = { ...this.settings, enabled }
    this.saveSettings()
    return this.settings
  }

  setSiteAllowed(url: string, allowed: boolean): AdBlockSettings {
    const hostname = normalizeHostname(url)
    if (!hostname) throw new Error('Current site is not a valid HTTP(S) hostname')
    const exceptions = new Set(this.settings.siteExceptions)
    if (allowed) exceptions.add(hostname)
    else exceptions.delete(hostname)
    this.settings = { ...this.settings, siteExceptions: [...exceptions].sort() }
    this.saveSettings()
    return this.settings
  }

  dispose(): void {
    this.disposed = true
    this.browserSession.webRequest.onBeforeRequest(null)
    this.stats.blockedByWebContents.clear()
  }

  private shouldBlock(details: Electron.OnBeforeRequestListenerDetails): Electron.CallbackResponse {
    if (!this.blocker || !this.settings.enabled || !isHttpUrl(details.url)) return {}
    if (this.isAllowedSiteRequest(details)) return {}
    const request = this.toRequest(details)
    const result = this.blocker.match(request, true)
    if (!result.match || result.exception) return {}
    this.recordBlocked(details, String(result.filter ?? 'AdBlock filter'))
    return { cancel: true }
  }

  private toRequest(details: Electron.OnBeforeRequestListenerDetails): unknown {
    if (!fromElectronDetails) throw new Error('AdBlock request adapter is unavailable')
    return fromElectronDetails(details)
  }

  private isAllowedSiteRequest(details: Electron.OnBeforeRequestListenerDetails): boolean {
    const siteUrl = details.resourceType === 'mainFrame' ? details.url : this.initiatorUrl(details)
    const hostname = normalizeHostname(siteUrl)
    return hostname ? this.settings.siteExceptions.includes(hostname) : false
  }

  private initiatorUrl(details: Electron.OnBeforeRequestListenerDetails): string {
    const initiator = (details as Electron.OnBeforeRequestListenerDetails & { initiator?: string }).initiator
    if (initiator && isHttpUrl(initiator)) return initiator
    const contents = details.webContentsId ? webContents.fromId(details.webContentsId) : null
    return contents && !contents.isDestroyed() ? contents.getURL() : details.url
  }

  private recordBlocked(details: Electron.OnBeforeRequestListenerDetails, reason: string): void {
    const webContentsId = details.webContentsId ?? -1
    if (webContentsId <= 0) return
    const entry: AdBlockBlockedRequest = {
      requestId: `adblock:${details.id}`,
      url: details.url,
      method: details.method,
      type: details.resourceType,
      reason,
      blockedAt: Date.now(),
      webContentsId
    }
    const records = this.stats.blockedByWebContents.get(webContentsId) ?? []
    records.push(entry)
    records.splice(0, Math.max(0, records.length - MAX_BLOCKED_PER_CONTENTS))
    this.stats.blockedByWebContents.set(webContentsId, records)
    this.stats.totalBlocked += 1
    this.onBlockedRequest()
  }

  private readSettings(): AdBlockSettings {
    const raw = this.repository.get(settingsKey(this.workspaceId))
    if (!raw) return adBlockSettingsSchema.parse({ enabled: true, siteExceptions: [] })
    try {
      const stored = storedSettingsSchema.parse(JSON.parse(raw))
      return adBlockSettingsSchema.parse({
        enabled: stored.enabled,
        siteExceptions: stored.siteExceptions.flatMap((item) => normalizeHostname(item) ?? [])
      })
    } catch {
      return adBlockSettingsSchema.parse({ enabled: true, siteExceptions: [] })
    }
  }

  private saveSettings(): void {
    this.repository.set(settingsKey(this.workspaceId), JSON.stringify(this.settings))
  }
}
