import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CookieEntry, StorageMutation, StorageSnapshot } from '../../../../shared/contracts/browser'
import { JsonEditor } from '../api/JsonEditor'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type RecordArea = 'cookie' | 'localStorage' | 'sessionStorage'
type StorageRecord = { id: string; area: RecordArea; key: string; value: string; cookie?: CookieEntry }
type ViewMode = 'tree' | 'pretty' | 'raw'

const MAX_TREE_NODES = 700

function expiry(value: number | undefined): string {
  return value === undefined ? 'Session' : new Date(value * 1000).toLocaleString()
}

function parseJson(value: string): { valid: true; value: JsonValue; pretty: string } | { valid: false; error: string } {
  try {
    const parsed = JSON.parse(value) as JsonValue
    return { valid: true, value: parsed, pretty: JSON.stringify(parsed, null, 2) }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function JsonNode({ name, value, depth, expandAll }: { name?: string; value: JsonValue; depth: number; expandAll: boolean }): React.JSX.Element {
  const label = name === undefined ? null : <span className="storage-json-key">{JSON.stringify(name)}: </span>
  if (value === null) return <div className="storage-json-leaf" style={{ paddingLeft: depth * 14 }}>{label}<span className="storage-json-null">null</span></div>
  if (typeof value !== 'object') return <div className="storage-json-leaf" style={{ paddingLeft: depth * 14 }}>{label}<span className={`storage-json-${typeof value}`}>{JSON.stringify(value)}</span></div>
  const entries = Object.entries(value).slice(0, MAX_TREE_NODES)
  const isArray = Array.isArray(value)
  return <details className="storage-json-node" open={expandAll || depth < 1} style={{ marginLeft: depth * 14 }}>
    <summary>{label}{isArray ? '[' : '{'} <span>{Object.keys(value).length} {isArray ? 'items' : 'keys'}</span> {isArray ? ']' : '}'}</summary>
    {entries.map(([key, child]) => <JsonNode key={key} name={key} value={child} depth={depth + 1} expandAll={expandAll} />)}
    {Object.keys(value).length > entries.length && <div className="json-limit">Value truncated for display.</div>}
  </details>
}

function records(snapshot: StorageSnapshot | null): StorageRecord[] {
  if (!snapshot) return []
  return [
    ...snapshot.cookies.map((cookie) => ({ id: `cookie:${cookie.name}:${cookie.domain}:${cookie.path}:${cookie.secure}`, area: 'cookie' as const, key: cookie.name, value: cookie.value, cookie })),
    ...snapshot.localStorage.map((item) => ({ id: `local:${item.key}`, area: 'localStorage' as const, key: item.key, value: item.value })),
    ...snapshot.sessionStorage.map((item) => ({ id: `session:${item.key}`, area: 'sessionStorage' as const, key: item.key, value: item.value }))
  ]
}

function mutationFor(record: StorageRecord, value: string): StorageMutation {
  if (record.area === 'cookie') {
    if (!record.cookie) throw new Error('Cookie is unavailable')
    return { area: 'cookie', cookie: { name: record.cookie.name, domain: record.cookie.domain, path: record.cookie.path, secure: record.cookie.secure }, value }
  }
  return { area: record.area, key: record.key, value }
}

export function StorageInspector(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<StorageSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>('tree')
  const [expandAll, setExpandAll] = useState(false)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const allRecords = useMemo(() => records(snapshot), [snapshot])
  const selected = allRecords.find((record) => record.id === selectedId) ?? allRecords[0] ?? null
  const parsed = useMemo(() => selected ? parseJson(selected.value) : null, [selected])
  const dirty = editing && selected !== null && draft !== selected.value

  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError('')
    try { setSnapshot(await window.devBrowser.storage.getSnapshot()) }
    catch (cause) { setError(String(cause)) }
    finally { setBusy(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (!selected) return
    setDraft(parsed?.valid ? parsed.pretty : selected.value)
    setEditing(false)
  }, [parsed, selected])

  function select(record: StorageRecord): void {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setSelectedId(record.id)
  }

  async function save(): Promise<void> {
    if (!selected) return
    const parsedDraft = parseJson(draft)
    if (!parsedDraft.valid) { setError(parsedDraft.error); return }
    setBusy(true)
    setError('')
    try {
      await window.devBrowser.storage.setValue(mutationFor(selected, parsedDraft.pretty))
      await refresh()
      setEditing(false)
    } catch (cause) { setError(String(cause)) }
    finally { setBusy(false) }
  }

  async function remove(cookie: CookieEntry): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await window.devBrowser.storage.removeCookie({ name: cookie.name, domain: cookie.domain, path: cookie.path, secure: cookie.secure })
      await refresh()
    } catch (cause) { setError(String(cause)) }
    finally { setBusy(false) }
  }

  return <div className="storage-inspector storage-explorer">
    <div className="storage-toolbar">
      <span className="storage-origin" title={snapshot?.url}>{snapshot?.url || 'Current page'}</span>
      <button type="button" onClick={() => { void refresh() }} disabled={busy}>Refresh</button>
    </div>
    {error && <p className="storage-error" role="alert">{error}</p>}
    <div className="storage-explorer-body">
      <aside className="storage-record-list" aria-label="Storage records">
        {allRecords.map((record) => <button key={record.id} type="button" className={selected?.id === record.id ? 'is-selected' : ''} onClick={() => select(record)}>
          <span>{record.area}</span><strong>{record.key}</strong><small>{record.value}</small>
        </button>)}
        {allRecords.length === 0 && <p className="storage-empty">No storage records for this target.</p>}
        {snapshot?.localStorageError && <p className="storage-error">{snapshot.localStorageError}</p>}
        {snapshot?.sessionStorageError && <p className="storage-error">{snapshot.sessionStorageError}</p>}
      </aside>
      <section className="storage-detail" aria-label="Storage value">
        {!selected ? <p className="storage-empty">Select a record to inspect.</p> : <>
          <div className="storage-detail-header">
            <div><strong>{selected.key}</strong><span>{selected.area}{selected.cookie ? ` - ${selected.cookie.domain} - expires ${expiry(selected.cookie.expires)}` : ''}</span></div>
            <div className="storage-detail-actions">
              {(['tree', 'pretty', 'raw'] as const).map((item) => <button key={item} type="button" className={mode === item ? 'is-active' : ''} disabled={!parsed?.valid && item !== 'raw'} onClick={() => setMode(item)}>{item}</button>)}
              <button type="button" disabled={!parsed?.valid} onClick={() => setExpandAll((current) => !current)}>{expandAll ? 'Collapse' : 'Expand'}</button>
              <button type="button" disabled={!parsed?.valid} onClick={() => { void navigator.clipboard.writeText(parsed?.valid ? parsed.pretty : selected.value) }}>Copy</button>
              {selected.cookie && <button type="button" disabled={busy} onClick={() => { void remove(selected.cookie!) }}>Delete</button>}
            </div>
          </div>
          {!editing && <div className="storage-json-view">
            {mode === 'tree' && parsed?.valid && <JsonNode key={`${selected.id}:${expandAll}`} value={parsed.value} depth={0} expandAll={expandAll} />}
            {mode === 'pretty' && parsed?.valid && <pre>{parsed.pretty}</pre>}
            {mode === 'raw' && <pre>{selected.value}</pre>}
            {!parsed?.valid && mode !== 'raw' && <p className="storage-empty">This value is not valid JSON. Use Raw or Edit to inspect it.</p>}
          </div>}
          {editing && <div className="storage-editor"><JsonEditor value={draft} onChange={setDraft} /></div>}
          <div className="storage-edit-actions">
            {!editing ? <button type="button" onClick={() => setEditing(true)}>Edit</button> : <>
              <button type="button" onClick={() => { const parsedDraft = parseJson(draft); if (parsedDraft.valid) setDraft(parsedDraft.pretty); else setError(parsedDraft.error) }}>Format</button>
              <button type="button" disabled={busy || !dirty} onClick={() => { void save() }}>Save</button>
              <button type="button" onClick={() => { setDraft(parsed?.valid ? parsed.pretty : selected.value); setEditing(false); setError('') }}>Cancel</button>
            </>}
            {dirty && <span>Unsaved changes</span>}
          </div>
        </>}
      </section>
    </div>
  </div>
}
