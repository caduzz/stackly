import type { WebContents } from 'electron'
import type { NetworkEntry } from '../../shared/contracts/browser'

type RequestEvent = {
  requestId: string
  timestamp: number
  wallTime: number
  type?: string
  request: { url: string; method: string; headers: Record<string, unknown> }
}
type ResponseEvent = {
  requestId: string
  type?: string
  response: { status: number; headers: Record<string, unknown> }
}
type FinishedEvent = { requestId: string; timestamp: number; errorText?: string }

const MAX_ENTRIES = 1000

function headers(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]))
}

export class NetworkCollector {
  private readonly entries = new Map<string, NetworkEntry>()
  private readonly startedAt = new Map<string, number>()
  private starting: Promise<void> | null = null
  private enabled = false
  private ownedAttachment = false

  constructor(private readonly contents: WebContents, private readonly ready: Promise<void> = Promise.resolve(), private readonly onChange: () => void = () => {}) {}

  private readonly onMessage = (_event: Electron.Event, method: string, raw: unknown): void => {
    if (method === 'Network.requestWillBeSent') {
      const event = raw as RequestEvent
      const entry: NetworkEntry = {
        requestId: event.requestId,
        url: event.request.url,
        method: event.request.method,
        type: event.type,
        startTime: event.wallTime * 1000,
        requestHeaders: headers(event.request.headers),
        failed: false
      }
      this.entries.set(event.requestId, entry)
      this.startedAt.set(event.requestId, event.timestamp)
      if (this.entries.size > MAX_ENTRIES) {
        const oldest = this.entries.keys().next().value as string
        this.entries.delete(oldest)
        this.startedAt.delete(oldest)
      }
    } else if (method === 'Network.responseReceived') {
      const event = raw as ResponseEvent
      const entry = this.entries.get(event.requestId)
      if (entry) {
        entry.status = event.response.status
        entry.type = event.type ?? entry.type
        entry.responseHeaders = headers(event.response.headers)
      }
    } else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
      const event = raw as FinishedEvent
      const entry = this.entries.get(event.requestId)
      if (!entry) return
      const start = this.startedAt.get(event.requestId)
      if (start !== undefined) entry.duration = Math.max(0, (event.timestamp - start) * 1000)
      this.startedAt.delete(event.requestId)
      if (method === 'Network.loadingFailed') {
        entry.failed = true
        entry.failureReason = event.errorText
      }
    } else return
    this.onChange()
  }

  private readonly onDetach = (): void => {
    this.enabled = false
    this.ownedAttachment = false
    this.contents.debugger.removeListener('message', this.onMessage)
    this.contents.debugger.removeListener('detach', this.onDetach)
  }

  async start(): Promise<void> {
    if (this.enabled) return
    if (this.starting) return this.starting
    this.starting = this.enable()
    try { await this.starting } finally { this.starting = null }
  }

  private async enable(): Promise<void> {
    await this.ready
    if (this.contents.isDestroyed()) throw new Error('Tab is closed')
    const debuggerApi = this.contents.debugger
    if (debuggerApi.isAttached()) throw new Error('Debugger is already attached')
    debuggerApi.attach('1.3')
    this.ownedAttachment = true
    debuggerApi.on('message', this.onMessage)
    debuggerApi.on('detach', this.onDetach)
    try {
      await debuggerApi.sendCommand('Network.enable')
      this.enabled = true
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  snapshot(): NetworkEntry[] {
    return [...this.entries.values()].map((entry) => ({
      ...entry,
      requestHeaders: entry.requestHeaders && { ...entry.requestHeaders },
      responseHeaders: entry.responseHeaders && { ...entry.responseHeaders }
    }))
  }

  dispose(): void {
    if (this.contents.isDestroyed()) return
    const debuggerApi = this.contents.debugger
    debuggerApi.removeListener('message', this.onMessage)
    debuggerApi.removeListener('detach', this.onDetach)
    if (this.ownedAttachment && debuggerApi.isAttached()) debuggerApi.detach()
    this.enabled = false
    this.ownedAttachment = false
    this.startedAt.clear()
  }
}
