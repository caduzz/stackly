import { useEffect, useMemo, useRef, useState } from 'react'
import type { ApiRequest, ApiResponse, NetworkEntry } from '../../../../shared/contracts/browser'
import { JsonEditor } from './JsonEditor'
import { JsonViewer } from './JsonViewer'
import { durationLabel, requestName, statusTone } from '../network/networkFilters'

const methods: ApiRequest['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const blockedHeaderNames = new Set(['authorization', 'cookie', 'proxy-authorization', 'x-api-key', 'x-auth-token', 'x-csrf-token'])
type SentRequest = { id: string; method: ApiRequest['method']; url: string; status?: number; duration?: number; at: number }

function parseHeaders(input: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const raw of input.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const separator = line.indexOf(':')
    if (separator <= 0) throw new Error(`Invalid header: ${line}`)
    const name = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) throw new Error(`Invalid header name: ${name}`)
    headers[name] = value
  }
  return headers
}

function safeHeaderText(headers: Record<string, string> | undefined): string {
  return Object.entries(headers ?? {})
    .filter(([name]) => !blockedHeaderNames.has(name.toLowerCase()))
    .map(([name, value]) => `${name}: ${value}`)
    .join('\n')
}

function entryToRequest(entry: NetworkEntry): Pick<ApiRequest, 'method' | 'url' | 'headers'> {
  return {
    method: methods.includes(entry.method as ApiRequest['method']) ? entry.method as ApiRequest['method'] : 'GET',
    url: entry.url,
    headers: Object.fromEntries(Object.entries(entry.requestHeaders ?? {}).filter(([name]) => !blockedHeaderNames.has(name.toLowerCase())))
  }
}

function responseTitle(response: ApiResponse | null): string {
  if (!response) return 'Response'
  return `${response.status} ${response.statusText || ''}`.trim()
}

export function ApiClient(): React.JSX.Element {
  const [entries, setEntries] = useState<NetworkEntry[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [method, setMethod] = useState<ApiRequest['method']>('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState('')
  const [body, setBody] = useState('')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [history, setHistory] = useState<SentRequest[]>([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const activeRequestId = useRef<string | null>(null)

  useEffect(() => {
    let disposed = false
    let sequence = 0
    async function refresh(): Promise<void> {
      const current = ++sequence
      try {
        const snapshot = await window.devBrowser.network.getEntries()
        if (!disposed && current === sequence) setEntries(snapshot)
      } catch (cause) { if (!disposed) setError(String(cause)) }
    }
    const unsubscribe = window.devBrowser.network.onEntriesChanged(() => { void refresh() })
    void window.devBrowser.network.startCapture().then(refresh).catch((cause: unknown) => { if (!disposed) setError(String(cause)) })
    void refresh()
    return () => {
      disposed = true
      unsubscribe()
      if (activeRequestId.current) void window.devBrowser.api.cancel(activeRequestId.current).catch(console.error)
    }
  }, [])

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return entries.filter((entry) => !needle || [entry.method, entry.url, entry.status, entry.type].join(' ').toLowerCase().includes(needle)).slice().reverse()
  }, [entries, query])
  const selected = entries.find((entry) => entry.requestId === selectedId)

  function useCaptured(entry: NetworkEntry): void {
    const draft = entryToRequest(entry)
    setSelectedId(entry.requestId)
    setMethod(draft.method)
    setUrl(draft.url)
    setHeaders(safeHeaderText(draft.headers))
    setBody('')
    setResponse(null)
    setError('')
  }

  async function send(): Promise<void> {
    const requestId = crypto.randomUUID()
    const request: ApiRequest = { method, url: url.trim(), headers: parseHeaders(headers), body: method === 'GET' ? '' : body }
    setError('')
    setResponse(null)
    setSending(true)
    activeRequestId.current = requestId
    try {
      const result = await window.devBrowser.api.send(requestId, request)
      if (activeRequestId.current !== requestId) return
      setResponse(result)
      setHistory((current) => [{ id: requestId, method, url: request.url, status: result.status, duration: result.duration, at: Date.now() }, ...current].slice(0, 20))
    } catch (cause) {
      if (activeRequestId.current === requestId) setError(cause instanceof DOMException && cause.name === 'AbortError' ? 'Request cancelled' : String(cause))
    } finally {
      if (activeRequestId.current === requestId) {
        activeRequestId.current = null
        setSending(false)
      }
    }
  }

  function cancel(): void {
    const requestId = activeRequestId.current
    if (!requestId) return
    activeRequestId.current = null
    setSending(false)
    setError('Request cancelled')
    void window.devBrowser.api.cancel(requestId).catch((cause: unknown) => setError(String(cause)))
  }

  return <div className="api-client api-client--inspector">
    <aside className="api-captured" aria-label="Captured network requests">
      <div className="api-captured-toolbar">
        <input aria-label="Filter captured requests" placeholder="Filter captured requests" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="api-captured-list">
        {visibleEntries.length === 0 && <p className="api-empty">{entries.length ? 'No matching requests.' : 'Captured requests will appear here.'}</p>}
        {visibleEntries.map((entry) => <button key={entry.requestId} type="button" className={`api-captured-row${entry.requestId === selectedId ? ' is-selected' : ''}`} onClick={() => useCaptured(entry)} title={entry.url}>
          <span className={`network-status network-status--${statusTone(entry)}`}>{entry.failed ? 'ERR' : entry.status ?? '-'}</span>
          <span>{entry.method}</span>
          <span>{requestName(entry.url)}</span>
        </button>)}
      </div>
    </aside>
    <form className="api-request" onSubmit={(event) => { event.preventDefault(); if (!sending) void send() }}>
      <div className="api-request-line">
        <select aria-label="HTTP method" value={method} onChange={(event) => setMethod(event.target.value as ApiRequest['method'])}>{methods.map((item) => <option key={item}>{item}</option>)}</select>
        <input aria-label="Request URL" type="url" placeholder="https://api.example.com/items" value={url} onChange={(event) => setUrl(event.target.value)} required />
        {sending ? <button type="button" onClick={cancel}>Cancel</button> : <button type="submit">Send</button>}
      </div>
      <label className="api-field-label" htmlFor="api-headers">Headers <span>sensitive headers are not copied from captured requests</span></label>
      <textarea id="api-headers" aria-label="Request headers" value={headers} onChange={(event) => setHeaders(event.target.value)} placeholder="Accept: application/json" spellCheck={false} />
      <div className="api-field-label">Body {method === 'GET' && <span>GET requests are sent without a body</span>}</div>
      <div className={method === 'GET' ? 'api-editor-wrap is-disabled' : 'api-editor-wrap'}><JsonEditor value={body} onChange={setBody} readOnly={method === 'GET'} /></div>
      {selected && <section className="api-selected" aria-label="Selected request">
        <strong>{selected.method} {requestName(selected.url)}</strong>
        <span>{selected.status ?? (selected.failed ? 'Failed' : 'Pending')} - {durationLabel(selected.duration)}</span>
      </section>}
    </form>
    <section className="api-response" aria-label="API response">
      <div className="api-response-summary"><strong className={response && response.status >= 400 ? 'is-error' : 'is-success'}>{responseTitle(response)}</strong>{response && <span>{response.duration} ms</span>}</div>
      {error && <p className="api-error" role="alert">{error}</p>}
      {response ? <>
        <details><summary>Response headers</summary><pre>{Object.entries(response.headers).map(([name, value]) => `${name}: ${value}`).join('\n')}</pre></details>
        <JsonViewer key={response.body} body={response.body} />
      </> : !error && <p className="api-empty">Send a request to see its response.</p>}
      <section className="api-history" aria-label="Manual request history">
        <h3>Manual history</h3>
        {history.length === 0 ? <p className="api-empty">Sent requests will appear here.</p> : history.map((item) => <button key={item.id} type="button" onClick={() => { setMethod(item.method); setUrl(item.url) }} title={item.url}>
          <span>{item.method}</span><span>{requestName(item.url)}</span><span>{item.status ?? '-'} - {durationLabel(item.duration)}</span>
        </button>)}
      </section>
    </section>
  </div>
}
