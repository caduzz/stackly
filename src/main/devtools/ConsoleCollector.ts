import type { WebContents } from 'electron'
import type { ConsoleEntry } from '../../shared/contracts/browser'

type RemoteObject = { type?: string; subtype?: string; value?: unknown; unSerializableValue?: string; description?: string }
type CallFrame = { url?: string; lineNumber?: number; columnNumber?: number; functionName?: string }
type StackTrace = { callFrames?: CallFrame[]; parent?: StackTrace }
type ConsoleEvent = { type: string; args: RemoteObject[]; timestamp: number; stackTrace?: StackTrace }
type ExceptionEvent = { timestamp: number; exceptionDetails: { text: string; url?: string; lineNumber?: number; columnNumber?: number; stackTrace?: StackTrace; exception?: RemoteObject } }

const MAX_ENTRIES = 1000
const MAX_TEXT = 4000

function simpleValue(value: RemoteObject): string {
  if (typeof value.value === 'string') return value.value.slice(0, MAX_TEXT)
  if (value.value === null) return 'null'
  if (typeof value.value === 'number' || typeof value.value === 'boolean') return String(value.value)
  return (value.unSerializableValue ?? value.description ?? value.subtype ?? value.type ?? 'unknown').slice(0, MAX_TEXT)
}

function location(frame: CallFrame | undefined): string | undefined {
  if (!frame?.url) return undefined
  return `${frame.url}:${(frame.lineNumber ?? 0) + 1}:${(frame.columnNumber ?? 0) + 1}`
}

function stackText(stack: StackTrace | undefined): string | undefined {
  if (!stack) return undefined
  const frames = stack.callFrames?.slice(0, 20).map((frame) => `at ${frame.functionName || '<anonymous>'} (${location(frame) ?? 'unknown'})`) ?? []
  return frames.length ? frames.join('\n').slice(0, MAX_TEXT) : undefined
}

export class ConsoleCollector {
  private entries: ConsoleEntry[] = []
  private starting: Promise<void> | null = null
  private enabled = false
  private disposed = false
  private nextId = 0

  constructor(private readonly contents: WebContents, private readonly ensureAttached: () => Promise<void>, private readonly onChange: () => void) {}

  private readonly onMessage = (_event: Electron.Event, method: string, raw: unknown): void => {
    if (this.disposed) return
    if (method === 'Runtime.consoleAPICalled') {
      const event = raw as ConsoleEvent
      const level = event.type === 'warning' ? 'warn' : event.type
      if (!['log', 'info', 'warn', 'error', 'debug'].includes(level)) return
      const frame = event.stackTrace?.callFrames?.[0]
      this.add({ level: level as ConsoleEntry['level'], timestamp: event.timestamp, text: event.args.map(simpleValue).join(' ').slice(0, MAX_TEXT), source: location(frame), stack: stackText(event.stackTrace) })
    } else if (method === 'Runtime.exceptionThrown') {
      const event = raw as ExceptionEvent
      const detail = event.exceptionDetails
      const frame = detail.stackTrace?.callFrames?.[0]
      this.add({ level: 'error', timestamp: event.timestamp, text: simpleValue(detail.exception ?? { description: detail.text }), source: location(frame) ?? location({ url: detail.url, lineNumber: detail.lineNumber, columnNumber: detail.columnNumber }), stack: stackText(detail.stackTrace) })
    }
  }

  private add(entry: Omit<ConsoleEntry, 'id'>): void {
    this.entries.push({ id: String(++this.nextId), ...entry })
    if (this.entries.length > MAX_ENTRIES) this.entries.shift()
    this.onChange()
  }

  async start(): Promise<void> {
    if (this.enabled) return
    if (this.starting) return this.starting
    this.starting = this.enable()
    try { await this.starting } finally { this.starting = null }
  }

  private async enable(): Promise<void> {
    await this.ensureAttached()
    if (this.disposed || this.contents.isDestroyed()) throw new Error('Tab is closed')
    this.contents.debugger.on('message', this.onMessage)
    try {
      await this.contents.debugger.sendCommand('Runtime.enable')
      this.enabled = true
    } catch (error) {
      this.contents.debugger.removeListener('message', this.onMessage)
      throw error
    }
  }

  snapshot(): ConsoleEntry[] { return this.entries.map((entry) => ({ ...entry })) }
  clear(): void { this.entries = []; this.onChange() }
  dispose(): void {
    this.disposed = true
    if (!this.contents.isDestroyed()) this.contents.debugger.removeListener('message', this.onMessage)
    this.entries = []
  }
}
