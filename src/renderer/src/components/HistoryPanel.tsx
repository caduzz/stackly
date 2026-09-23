import { ExternalLink, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { NavigationHistoryEntry, Workspace } from '../../../shared/contracts/browser'
import { IconButton } from './IconButton'

type Props = {
  workspace: Workspace | undefined
  onClose: () => void
}

function formatDay(value: string): string {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function HistoryPanel({ workspace, onClose }: Props): React.JSX.Element {
  const panelRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<NavigationHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  function load(nextQuery = query): void {
    setLoading(true)
    void window.devBrowser.history.get(nextQuery).then(setEntries).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    void window.devBrowser.layout.setChromeOverlayOpen(true).then(() => panelRef.current?.querySelector<HTMLInputElement>('[aria-label="Search history"]')?.focus()).catch(console.error)
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      void window.devBrowser.layout.setChromeOverlayOpen(false).catch(console.error)
    }
  }, [onClose])

  useEffect(() => {
    const timer = window.setTimeout(() => load(query), 120)
    return () => window.clearTimeout(timer)
  }, [query, workspace?.id])

  const groups = useMemo(() => {
    const grouped = new Map<string, NavigationHistoryEntry[]>()
    for (const entry of entries) {
      const key = formatDay(entry.visitedAt)
      grouped.set(key, [...grouped.get(key) ?? [], entry])
    }
    return [...grouped.entries()]
  }, [entries])

  function openEntry(entry: NavigationHistoryEntry): void {
    void window.devBrowser.tabs.create(entry.url, true).then(onClose).catch(console.error)
  }

  function removeEntry(id: string): void {
    void window.devBrowser.history.remove(id).then(() => load()).catch(console.error)
  }

  function clearHistory(): void {
    void window.devBrowser.history.clear().then(() => setEntries([])).catch(console.error)
  }

  return <div className="history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={panelRef} className="history-panel" role="dialog" aria-modal="true" aria-label="History">
      <header>
        <div><strong>History</strong><span>{workspace?.name ?? 'Current workspace'}</span></div>
        <IconButton icon={X} aria-label="Close history" title="Close history" onClick={onClose} />
      </header>
      <div className="history-search">
        <Search size={15} aria-hidden="true" />
        <input aria-label="Search history" placeholder="Search title or URL" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="button" disabled={entries.length === 0} onClick={clearHistory}><Trash2 size={14} aria-hidden="true" />Clear</button>
      </div>
      <div className="history-results">
        {loading && <p className="history-empty">Loading history...</p>}
        {!loading && entries.length === 0 && <p className="history-empty">{query ? 'No matching visits.' : 'No history for this workspace yet.'}</p>}
        {!loading && groups.map(([day, items]) => <section key={day} className="history-day">
          <h2>{day}</h2>
          {items.map((entry) => <article key={entry.id} className="history-entry">
            <button type="button" className="history-entry-main" onClick={() => openEntry(entry)}>
              {entry.favicon ? <img src={entry.favicon} alt="" /> : <span className="history-favicon" />}
              <span><strong>{entry.title}</strong><small>{entry.url}</small></span>
            </button>
            <time dateTime={entry.visitedAt}>{formatTime(entry.visitedAt)}</time>
            <IconButton icon={ExternalLink} aria-label={`Open ${entry.title}`} title="Open" onClick={() => openEntry(entry)} />
            <IconButton icon={Trash2} aria-label={`Remove ${entry.title}`} title="Remove" onClick={() => removeEntry(entry.id)} />
          </article>)}
        </section>)}
      </div>
    </section>
  </div>
}
