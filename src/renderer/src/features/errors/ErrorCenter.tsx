import { useEffect, useMemo, useState } from 'react'
import type { ConsoleEntry, NetworkEntry } from '../../../../shared/contracts/browser'
import type { DevPanelKind } from '../../components/DevPanel'

type ProblemType = 'all' | 'javascript' | 'network' | 'resource'
type Severity = 'all' | 'error' | 'warning'
type Problem = {
  id: string
  type: Exclude<ProblemType, 'all'>
  severity: Exclude<Severity, 'all'>
  message: string
  source: string
  url: string
  timestamp: number
  context: 'console' | 'network'
}

const typeFilters: ProblemType[] = ['all', 'javascript', 'network', 'resource']
const severityFilters: Severity[] = ['all', 'error', 'warning']
const intentionalNetworkFailures = new Set(['net::ERR_ABORTED', 'net::ERR_BLOCKED_BY_CLIENT'])

function requestName(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

function problemKey(problem: Omit<Problem, 'id'>): string {
  return [problem.type, problem.severity, problem.message, problem.source, problem.url, Math.floor(problem.timestamp / 1000)].join('|')
}

function consoleProblem(entry: ConsoleEntry): Problem | null {
  if (entry.level !== 'error' && entry.level !== 'warn') return null
  const problem = {
    type: 'javascript',
    severity: entry.level === 'warn' ? 'warning' : 'error',
    message: entry.text,
    source: entry.source ?? 'Console',
    url: entry.source?.split(':').slice(0, -2).join(':') ?? '',
    timestamp: entry.timestamp,
    context: 'console'
  } satisfies Omit<Problem, 'id'>
  return { id: problemKey(problem), ...problem }
}

function networkProblem(entry: NetworkEntry): Problem | null {
  if (entry.failureReason && intentionalNetworkFailures.has(entry.failureReason)) return null
  if (!entry.failed && (!entry.status || entry.status < 400)) return null
  const failed = entry.failed
  const problem = {
    type: failed ? 'network' : 'resource',
    severity: 'error',
    message: failed ? entry.failureReason ?? 'Network request failed' : `HTTP ${entry.status}`,
    source: entry.method,
    url: entry.url,
    timestamp: entry.startTime,
    context: 'network'
  } satisfies Omit<Problem, 'id'>
  return { id: problemKey(problem), ...problem }
}

export function ErrorCenter({ targetLabel, onOpenPanel }: { targetLabel: string; onOpenPanel: (panel: DevPanelKind) => void }): React.JSX.Element {
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const [networkEntries, setNetworkEntries] = useState<NetworkEntry[]>([])
  const [type, setType] = useState<ProblemType>('all')
  const [severity, setSeverity] = useState<Severity>('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false
    let sequence = 0
    async function refresh(): Promise<void> {
      const current = ++sequence
      try {
        const [consoleSnapshot, networkSnapshot] = await Promise.all([
          window.devBrowser.console.getEntries(),
          window.devBrowser.network.getEntries()
        ])
        if (!disposed && current === sequence) {
          setConsoleEntries(consoleSnapshot)
          setNetworkEntries(networkSnapshot)
        }
      } catch (cause) {
        if (!disposed) setError(String(cause))
      }
    }
    const offConsole = window.devBrowser.console.onEntriesChanged(() => { void refresh() })
    const offNetwork = window.devBrowser.network.onEntriesChanged(() => { void refresh() })
    void Promise.all([window.devBrowser.console.startCapture(), window.devBrowser.network.startCapture()]).then(refresh).catch((cause: unknown) => {
      if (!disposed) setError(String(cause))
    })
    void refresh()
    return () => { disposed = true; offConsole(); offNetwork() }
  }, [])

  const problems = useMemo(() => {
    const seen = new Set<string>()
    return [...consoleEntries.map(consoleProblem), ...networkEntries.map(networkProblem)]
      .filter((problem): problem is Problem => Boolean(problem))
      .filter((problem) => {
        if (seen.has(problem.id)) return false
        seen.add(problem.id)
        return true
      })
      .sort((left, right) => right.timestamp - left.timestamp)
  }, [consoleEntries, networkEntries])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return problems.filter((problem) => {
      if (type !== 'all' && problem.type !== type) return false
      if (severity !== 'all' && problem.severity !== severity) return false
      return !needle || `${problem.message} ${problem.source} ${problem.url}`.toLowerCase().includes(needle)
    })
  }, [problems, query, severity, type])

  function clear(): void {
    void Promise.all([window.devBrowser.console.clear(), window.devBrowser.network.clear()])
      .then(() => { setConsoleEntries([]); setNetworkEntries([]) })
      .catch((cause: unknown) => setError(String(cause)))
  }

  return <div className="error-center">
    <div className="error-center-toolbar">
      <input aria-label="Search errors" placeholder="Search errors" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="error-center-filters" role="group" aria-label="Problem types">
        {typeFilters.map((item) => <button key={item} type="button" className={item === type ? 'is-active' : ''} aria-pressed={item === type} onClick={() => setType(item)}>{item === 'all' ? 'All' : item}</button>)}
      </div>
      <div className="error-center-filters" role="group" aria-label="Severity">
        {severityFilters.map((item) => <button key={item} type="button" className={item === severity ? 'is-active' : ''} aria-pressed={item === severity} onClick={() => setSeverity(item)}>{item === 'all' ? 'Any' : item}</button>)}
      </div>
      <span className="error-center-count">{visible.length}/{problems.length}</span>
      <button type="button" className="console-clear" onClick={clear}>Clear</button>
    </div>
    <div className="error-center-context">Workspace target: {targetLabel}</div>
    <div className="error-center-list" role="log" aria-label="Detected problems">
      {error && <div className="console-error">{error}</div>}
      {visible.length === 0 && <div className="network-empty">{problems.length ? 'No matching problems.' : 'Detected errors will appear here.'}</div>}
      {visible.map((problem) => <article key={problem.id} className={`error-center-row error-center-row--${problem.severity}`}>
        <span className="error-center-pill">{problem.type}</span>
        <div className="error-center-main">
          <strong>{problem.message}</strong>
          <span title={problem.url || problem.source}>{problem.url ? requestName(problem.url) : problem.source}</span>
        </div>
        <time dateTime={new Date(problem.timestamp).toISOString()}>{new Date(problem.timestamp).toLocaleTimeString()}</time>
        <button type="button" onClick={() => onOpenPanel(problem.context)}>{problem.context === 'console' ? 'Open Console' : 'Open Network'}</button>
      </article>)}
    </div>
  </div>
}
