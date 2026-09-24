import type { NetworkEntry } from '../../../../shared/contracts/browser'

function HeaderGroup({ title, values }: { title: string; values: Record<string, string> | undefined }): React.JSX.Element {
  const rows = Object.entries(values ?? {})
  return <section className="network-header-group">
    <h4>{title}</h4>
    {rows.length === 0 ? <p>No headers available.</p> : <dl>{rows.map(([name, value]) => <div key={name} className="network-header-row"><dt>{name}</dt><dd>{value}</dd></div>)}</dl>}
  </section>
}

export function NetworkDetails({ entry }: { entry: NetworkEntry }): React.JSX.Element {
  return <aside className="network-details" aria-label="Request details">
    <div className="network-details-title" title={entry.url}>{entry.method} {entry.url}</div>
    {entry.failed && <p className="network-failure">{entry.failureReason ?? 'Request failed'}</p>}
    {entry.blockedBy === 'adblock' && <p className="network-block-reason">{entry.blockReason ?? 'Matched an AdBlock filter.'}</p>}
    <HeaderGroup title="Request Headers" values={entry.requestHeaders} />
    <HeaderGroup title="Response Headers" values={entry.responseHeaders} />
  </aside>
}
