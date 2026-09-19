import { useEffect, useMemo, useState } from 'react'
import type { ConsoleEntry } from '../../../../shared/contracts/browser'

const levels = ['all', 'log', 'info', 'warn', 'error', 'debug'] as const
type LevelFilter = typeof levels[number]

export function ConsoleInspector(): React.JSX.Element {
  const [entries, setEntries] = useState<ConsoleEntry[]>([])
  const [level, setLevel] = useState<LevelFilter>('all')
  const [error, setError] = useState('')
  const visible = useMemo(() => level === 'all' ? entries : entries.filter((entry) => entry.level === level), [entries, level])

  useEffect(() => {
    let disposed = false
    let sequence = 0
    async function refresh(): Promise<void> {
      const current = ++sequence
      try {
        const snapshot = await window.devBrowser.console.getEntries()
        if (!disposed && current === sequence) setEntries(snapshot)
      } catch (cause) { if (!disposed) setError(String(cause)) }
    }
    const unsubscribe = window.devBrowser.console.onEntriesChanged(() => { void refresh() })
    void window.devBrowser.console.startCapture().then(refresh).catch((cause: unknown) => { if (!disposed) setError(String(cause)) })
    void refresh()
    return () => { disposed = true; unsubscribe() }
  }, [])

  function clear(): void {
    void window.devBrowser.console.clear().then(() => setEntries([])).catch((cause: unknown) => setError(String(cause)))
  }

  return <div className="console-inspector">
    <div className="console-toolbar">
      <div className="console-filters" role="group" aria-label="Console levels">
        {levels.map((item) => <button key={item} type="button" aria-pressed={item === level} className={item === level ? 'is-active' : ''} onClick={() => setLevel(item)}>{item === 'all' ? 'All' : item}</button>)}
      </div>
      <span className="console-count">{visible.length}/{entries.length}</span>
      <button type="button" className="console-clear" onClick={clear}>Clear</button>
    </div>
    <div className="console-entries" role="log" aria-label="Console output">
      {error && <div className="console-error">{error}</div>}
      {visible.length === 0 && <div className="console-empty">{entries.length ? 'No messages at this level.' : 'Console messages will appear here.'}</div>}
      {visible.map((entry) => <div key={entry.id} className={`console-entry console-entry--${entry.level}`}>
        <span className="console-level">{entry.level}</span>
        <div className="console-message"><span className="console-text">{entry.text}</span>{entry.stack && <pre>{entry.stack}</pre>}</div>
        <span className="console-source" title={entry.source}>{entry.source ?? ''}</span>
        <time dateTime={new Date(entry.timestamp).toISOString()}>{new Date(entry.timestamp).toLocaleTimeString()}</time>
      </div>)}
    </div>
  </div>
}
