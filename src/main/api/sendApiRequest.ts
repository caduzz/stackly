import { performance } from 'node:perf_hooks'
import type { ApiRequest, ApiResponse } from '../../shared/contracts/browser'

const MAX_RESPONSE_BYTES = 2_000_000

async function readLimited(response: Response): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_RESPONSE_BYTES) throw new Error('Response exceeds 2 MB limit')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(bytes)
}

export async function sendApiRequest(request: ApiRequest, signal?: AbortSignal): Promise<ApiResponse> {
  const url = new URL(request.url)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only HTTP(S) URLs without embedded credentials are supported')
  if (request.method === 'GET' && request.body.trim()) throw new Error('GET requests cannot have a body')
  const headers = new Headers(request.headers)
  if (request.body.trim()) {
    const looksJson = /^[\[{]/.test(request.body.trim())
    if (looksJson && !headers.has('content-type')) headers.set('content-type', 'application/json')
  }
  const timeout = AbortSignal.timeout(30_000)
  const started = performance.now()
  const response = await fetch(url, {
    method: request.method,
    headers,
    body: request.body.trim() || undefined,
    credentials: 'omit',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  })
  const body = await readLimited(response)
  return {
    status: response.status,
    statusText: response.statusText,
    duration: Math.round(performance.now() - started),
    headers: Object.fromEntries(response.headers.entries()),
    body
  }
}
