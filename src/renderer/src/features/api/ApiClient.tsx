import { useState } from 'react'
import type { ApiRequest, ApiResponse } from '../../../../shared/contracts/browser'
import { useTabsStore } from '../../stores/tabs'
import { JsonEditor } from './JsonEditor'
import { JsonViewer } from './JsonViewer'

const methods: ApiRequest['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

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

export function ApiClient(): React.JSX.Element {
  const currentUrl = useTabsStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId)?.url ?? '')
  const [method, setMethod] = useState<ApiRequest['method']>('GET')
  const [url, setUrl] = useState(currentUrl.startsWith('http') ? currentUrl : '')
  const [headers, setHeaders] = useState('')
  const [body, setBody] = useState('')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function send(): Promise<void> {
    setError('')
    setResponse(null)
    try {
      if (body.trim() && method !== 'GET') JSON.parse(body)
      const request: ApiRequest = { method, url: url.trim(), headers: parseHeaders(headers), body: method === 'GET' ? '' : body }
      setSending(true)
      setResponse(await window.devBrowser.api.send(request))
    } catch (cause) {
      setError(cause instanceof SyntaxError ? 'Request body is not valid JSON' : String(cause))
    } finally { setSending(false) }
  }

  return <div className="api-client">
    <form className="api-request" onSubmit={(event) => { event.preventDefault(); if (!sending) void send() }}>
      <div className="api-request-line">
        <select aria-label="HTTP method" value={method} onChange={(event) => setMethod(event.target.value as ApiRequest['method'])}>{methods.map((item) => <option key={item}>{item}</option>)}</select>
        <input aria-label="Request URL" type="url" placeholder="https://api.example.com/items" value={url} onChange={(event) => setUrl(event.target.value)} required />
        <button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
      </div>
      <label className="api-field-label" htmlFor="api-headers">Headers <span>one per line: Name: value</span></label>
      <textarea id="api-headers" aria-label="Request headers" value={headers} onChange={(event) => setHeaders(event.target.value)} placeholder="Accept: application/json" spellCheck={false} />
      <div className="api-field-label">JSON body {method === 'GET' && <span>available for POST, PUT, PATCH and DELETE</span>}</div>
      <div className={method === 'GET' ? 'api-editor-wrap is-disabled' : 'api-editor-wrap'}><JsonEditor value={body} onChange={setBody} readOnly={method === 'GET'} /></div>
    </form>
    <section className="api-response" aria-label="API response">
      {error && <p className="api-error" role="alert">{error}</p>}
      {response ? <>
        <div className="api-response-summary"><strong className={response.status >= 400 ? 'is-error' : 'is-success'}>{response.status} {response.statusText}</strong><span>{response.duration} ms</span></div>
        <details><summary>Response headers</summary><pre>{Object.entries(response.headers).map(([name, value]) => `${name}: ${value}`).join('\n')}</pre></details>
        <JsonViewer key={response.body} body={response.body} />
      </> : !error && <p className="api-empty">Send a request to see its response.</p>}
    </section>
  </div>
}
