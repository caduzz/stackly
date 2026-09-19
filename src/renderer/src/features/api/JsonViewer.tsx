import { useMemo, useState } from 'react'
import { JsonDiff } from './JsonDiff'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type Mode = 'raw' | 'pretty' | 'diff'
const PAGE_SIZE = 100
const MAX_HITS = 200

function parseJson(body: string): { value: JsonValue; valid: boolean } {
  try { return { value: JSON.parse(body) as JsonValue, valid: true } }
  catch { return { value: null, valid: false } }
}

function searchPaths(value: JsonValue, query: string): { paths: Set<string>; hits: number; limited: boolean } {
  const paths = new Set<string>()
  const stack: { value: JsonValue; path: string; key: string; depth: number }[] = [{ value, path: '', key: '', depth: 0 }]
  let hits = 0
  let limited = false
  const text = query.toLocaleLowerCase()
  while (stack.length) {
    const node = stack.pop()!
    const container = node.value !== null && typeof node.value === 'object'
    if (node.key.toLocaleLowerCase().includes(text) || (!container && String(node.value).toLocaleLowerCase().includes(text))) {
      if (hits === MAX_HITS) { limited = true; break }
      hits++
      let parent = node.path
      while (true) {
        paths.add(parent)
        if (!parent) break
        parent = parent.slice(0, parent.lastIndexOf('/'))
      }
    }
    if (container && node.depth < 80) {
      const entries = Object.entries(node.value as JsonValue[] | { [key: string]: JsonValue })
      for (let index = entries.length - 1; index >= 0; index--) {
        const [key, child] = entries[index]
        stack.push({ value: child, path: `${node.path}/${index}`, key, depth: node.depth + 1 })
      }
    }
  }
  return { paths, hits, limited }
}

function JsonNode({ value, name, path, depth, query, paths }: { value: JsonValue; name?: string; path: string; depth: number; query: string; paths: Set<string> }): React.JSX.Element {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [expanded, setExpanded] = useState(depth === 0 || !!query)
  const label = name === undefined ? '' : <span className="json-key">{JSON.stringify(name)}: </span>
  if (value === null || typeof value !== 'object') return <div className="json-node json-leaf" style={{ paddingLeft: depth * 14 }}>{label}<span>{JSON.stringify(value)}</span></div>
  const isArray = Array.isArray(value)
  const entries = Object.entries(value)
  const shown = entries.slice(0, query ? undefined : limit).flatMap(([key, child], index) =>
    !query || paths.has(`${path}/${index}`) ? [{ key, child, index }] : [])
  const openMark = isArray ? '[' : '{'
  const closeMark = isArray ? ']' : '}'
  return <details className="json-node" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} style={{ marginLeft: depth * 14 }}>
    <summary>{label}<span>{openMark}</span><span className="json-count">{entries.length} {isArray ? 'items' : 'keys'}</span><span>{closeMark}</span></summary>
    {expanded && (depth < 80 ? shown.map(({ key, child, index }) => <JsonNode key={key} value={child} name={isArray ? String(key) : key} path={`${path}/${index}`} depth={depth + 1} query={query} paths={paths} />) : <div className="json-limit">Maximum nesting depth reached.</div>)}
    {expanded && !query && entries.length > limit && <button type="button" className="json-more" onClick={() => setLimit((current) => current + PAGE_SIZE)}>Show next {Math.min(PAGE_SIZE, entries.length - limit)} items</button>}
  </details>
}

export function JsonViewer({ body }: { body: string }): React.JSX.Element {
  const parsed = useMemo(() => parseJson(body), [body])
  const [mode, setMode] = useState<Mode>(parsed.valid ? 'pretty' : 'raw')
  const [query, setQuery] = useState('')
  const [staging, setStaging] = useState('')
  const matches = useMemo(() => query && parsed.valid ? searchPaths(parsed.value, query) : { paths: new Set<string>(), hits: 0, limited: false }, [parsed, query])
  const pretty = useMemo(() => {
    if (!parsed.valid) return body
    try { return JSON.stringify(parsed.value, null, 2) }
    catch { return body }
  }, [parsed, body])
  const stagingValid = useMemo(() => { try { JSON.parse(staging); return true } catch { return !staging.trim() } }, [staging])

  return <div className="json-viewer">
    <div className="json-toolbar">
      <div className="json-modes" role="group" aria-label="Response view">
        {(['raw', 'pretty', 'diff'] as const).map((item) => <button key={item} type="button" disabled={!parsed.valid && item !== 'raw'} aria-pressed={mode === item} className={mode === item ? 'is-active' : ''} onClick={() => setMode(item)}>{item === 'raw' ? 'Raw' : item === 'pretty' ? 'Pretty' : 'Diff'}</button>)}
      </div>
      {mode === 'pretty' && <><input type="search" aria-label="Search JSON" placeholder="Search keys or values" value={query} onChange={(event) => setQuery(event.target.value)} /><span className="json-hits">{query ? `${matches.hits}${matches.limited ? '+' : ''} matches` : ''}</span></>}
    </div>
    {mode === 'raw' && <pre className="json-raw">{body || '(empty response)'}</pre>}
    {mode === 'pretty' && parsed.valid && <div className="json-tree">{query && matches.hits === 0 ? <p>No matches.</p> : <JsonNode key={query} value={parsed.value} path="" depth={0} query={query} paths={matches.paths} />}</div>}
    {mode === 'diff' && parsed.valid && <div className="json-diff">
      <div className="json-diff-labels"><span>Original · Staging (paste JSON)</span><span>Modified · Current response</span></div>
      {!stagingValid && <div className="json-diff-error">Staging JSON is invalid.</div>}
      <JsonDiff original={staging} modified={pretty} onOriginalChange={setStaging} />
    </div>}
  </div>
}
