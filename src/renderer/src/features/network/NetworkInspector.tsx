import { useEffect, useMemo, useState } from 'react'
import type { NetworkEntry } from '../../../../shared/contracts/browser'
import { NetworkDetails } from './NetworkDetails'
import { durationLabel, filterNetworkEntries, networkFilters, requestName, statusTone, type NetworkFilter } from './networkFilters'

export function NetworkInspector(): React.JSX.Element {
  const [entries, setEntries] = useState<NetworkEntry[]>([])
  const [filter, setFilter] = useState<NetworkFilter>('All')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visibleEntries = useMemo(() => filterNetworkEntries(entries, filter, query), [entries, filter, query])
  const selected = entries.find((entry) => entry.requestId === selectedId)

  useEffect(() => {
    let disposed = false
    let sequence = 0
    async function refresh(): Promise<void> {
      const current = ++sequence
      try {
        const snapshot = await window.devBrowser.network.getEntries()
        if (!disposed && current === sequence) setEntries(snapshot)
      } catch (error) { if (!disposed) console.error('Failed to read network entries', error) }
    }
    const unsubscribe = window.devBrowser.network.onEntriesChanged(() => { void refresh() })
    void window.devBrowser.network.startCapture().then(refresh).catch((error: unknown) => console.error('Failed to start network capture', error))
    void refresh()
    return () => { disposed = true; unsubscribe() }
  }, [])

  return <div className="network-inspector">
    <div className="network-toolbar">
      <input aria-label="Filter requests" placeholder="Filter requests" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="network-filters" role="group" aria-label="Request types">
        {networkFilters.map((item) => <button key={item} type="button" className={item === filter ? 'is-active' : ''} aria-pressed={item === filter} onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      <span className="network-count">{visibleEntries.length}/{entries.length}</span>
    </div>
    <div className="network-content">
      <div className="network-list" aria-label="Requests">
        <div className="network-row network-row--heading" aria-hidden="true"><span>Status</span><span>Method</span><span>Name / Path</span><span>Type</span><span>Duration</span></div>
        <div className="network-rows">
          {visibleEntries.length === 0 && <div className="network-empty">{entries.length ? 'No matching requests.' : 'Requests will appear here.'}</div>}
          {visibleEntries.map((entry) => <button
            key={entry.requestId}
            type="button"
            className={`network-row network-row--request${selectedId === entry.requestId ? ' is-selected' : ''}${entry.blockedBy === 'adblock' ? ' is-blocked' : ''}`}
            aria-pressed={selectedId === entry.requestId}
            title={entry.url}
            onClick={() => setSelectedId(entry.requestId)}
          >
            <span className={`network-status network-status--${statusTone(entry)}`}>{entry.blockedBy === 'adblock' ? 'ADB' : entry.failed ? 'ERR' : entry.status ?? '—'}</span>
            <span>{entry.method}</span>
            <span className="network-path">{requestName(entry.url)}</span>
            <span>{entry.type ?? '—'}</span>
            <span>{durationLabel(entry.duration)}</span>
          </button>)}
        </div>
      </div>
      {selected && <NetworkDetails entry={selected} />}
    </div>
  </div>
}
