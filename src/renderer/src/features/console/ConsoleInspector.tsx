import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConsoleEntry } from '../../../../shared/contracts/browser'

const levels = ['all', 'log', 'info', 'warn', 'error', 'debug', 'command', 'result'] as const
type LevelFilter = typeof levels[number]

export function ConsoleInspector(): React.JSX.Element {
  const [entries, setEntries] = useState<ConsoleEntry[]>([])
  const [level, setLevel] = useState<LevelFilter>('all')
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
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

  useEffect(() => {
    const prefix = input.match(/(?:^|[^\w$])([\w$]{2,})$/)?.[1] ?? ''
    if (!prefix) { setSuggestions([]); return }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void window.devBrowser.console.completions(prefix).then((items) => { if (!cancelled) setSuggestions(items) }).catch(() => { if (!cancelled) setSuggestions([]) })
    }, 150)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [input])

  function clear(): void {
    void window.devBrowser.console.clear().then(() => setEntries([])).catch((cause) => setError(String(cause)))
  }

  async function execute(): Promise<void> {
    const expression = input.trim()
    if (!expression) return
    setInput('')
    setHistory((current) => [expression, ...current.filter((item) => item !== expression)].slice(0, 50))
    setHistoryIndex(null)
    setError('')
    try {
      await window.devBrowser.console.execute(expression)
      setEntries(await window.devBrowser.console.getEntries())
    } catch (cause) { setError(String(cause)) }
    finally { inputRef.current?.focus() }
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void execute()
    } else if (event.key === 'ArrowUp' && event.currentTarget.selectionStart === 0) {
      event.preventDefault()
      const next = Math.min((historyIndex ?? -1) + 1, history.length - 1)
      if (history[next]) { setHistoryIndex(next); setInput(history[next]) }
    } else if (event.key === 'ArrowDown' && historyIndex !== null) {
      event.preventDefault()
      const next = historyIndex - 1
      setHistoryIndex(next >= 0 ? next : null)
      setInput(next >= 0 ? history[next] : '')
    } else if (event.key === 'Tab' && suggestions[0]) {
      event.preventDefault()
      setInput((current) => current.replace(/([\w$]{2,})$/, suggestions[0]))
    }
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
        <div className="console-message"><span className="console-text">{entry.text}</span>{entry.stack && <details><summary>Inspect</summary><pre>{entry.stack}</pre></details>}</div>
        <span className="console-source" title={entry.source}>{entry.source ?? ''}</span>
        <div className="console-entry-actions"><time dateTime={new Date(entry.timestamp).toISOString()}>{new Date(entry.timestamp).toLocaleTimeString()}</time><button type="button" onClick={() => { void navigator.clipboard.writeText(entry.text) }}>Copy</button></div>
      </div>)}
    </div>
    <div className="console-input-wrap">
      <span aria-hidden="true">&gt;</span>
      <textarea ref={inputRef} aria-label="JavaScript console input" placeholder="Run JavaScript in the selected page" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onInputKeyDown} rows={Math.min(5, Math.max(1, input.split('\n').length))} />
      <button type="button" onClick={() => { void execute() }}>Run</button>
      {suggestions.length > 0 && <div className="console-suggestions" role="listbox">{suggestions.slice(0, 8).map((item) => <button key={item} type="button" onClick={() => { setInput((current) => current.replace(/([\w$]{2,})$/, item)); inputRef.current?.focus() }}>{item}</button>)}</div>}
    </div>
  </div>
}
