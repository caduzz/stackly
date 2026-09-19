import { useCallback, useEffect, useState } from 'react'
import type { CookieEntry, StorageSnapshot } from '../../../../shared/contracts/browser'

function expiry(value: number | undefined): string {
  return value === undefined ? 'Session' : new Date(value * 1000).toLocaleString()
}

export function StorageInspector(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<StorageSnapshot | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError('')
    try { setSnapshot(await window.devBrowser.storage.getSnapshot()) }
    catch (cause) { setError(String(cause)) }
    finally { setBusy(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function remove(cookie: CookieEntry): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await window.devBrowser.storage.removeCookie({ name: cookie.name, domain: cookie.domain, path: cookie.path, secure: cookie.secure })
      setSnapshot(await window.devBrowser.storage.getSnapshot())
    } catch (cause) { setError(String(cause)) }
    finally { setBusy(false) }
  }

  return <div className="storage-inspector">
    <div className="storage-toolbar">
      <span className="storage-origin" title={snapshot?.url}>{snapshot?.url || 'Current page'}</span>
      <button type="button" onClick={() => { void refresh() }} disabled={busy}>Refresh</button>
    </div>
    <div className="storage-content">
      {error && <p className="storage-error" role="alert">{error}</p>}
      <section className="storage-section" aria-label="Cookies">
        <h3>Cookies <span>{snapshot?.cookies.length ?? 0}</span></h3>
        <div className="storage-table-scroll">
          <table className="storage-table"><thead><tr><th>Name</th><th>Value</th><th>Domain</th><th>Path</th><th>Expires</th><th>Secure</th><th>HttpOnly</th><th>SameSite</th><th>Action</th></tr></thead>
            <tbody>{snapshot?.cookies.map((cookie) => <tr key={`${cookie.name}:${cookie.domain}:${cookie.path}:${cookie.secure}`}>
              <td title={cookie.name}>{cookie.name}</td><td title={cookie.value}>{cookie.value}</td><td title={cookie.domain}>{cookie.domain}</td><td title={cookie.path}>{cookie.path}</td>
              <td>{expiry(cookie.expires)}</td><td>{cookie.secure ? 'Yes' : 'No'}</td><td>{cookie.httpOnly ? 'Yes' : 'No'}</td><td>{cookie.sameSite}</td>
              <td><button type="button" className="storage-delete" disabled={busy} aria-label={`Delete cookie ${cookie.name}`} onClick={() => { void remove(cookie) }}>Delete</button></td>
            </tr>)}</tbody></table>
          {snapshot && snapshot.cookies.length === 0 && <p className="storage-empty">No cookies for this page.</p>}
        </div>
      </section>
      <section className="storage-section" aria-label="Local storage">
        <h3>localStorage <span>{snapshot?.localStorage.length ?? 0}</span></h3>
        {snapshot?.localStorageError && <p className="storage-error">{snapshot.localStorageError}</p>}
        <div className="storage-table-scroll">
          <table className="storage-table storage-table--local"><thead><tr><th>Key</th><th>Value</th></tr></thead>
            <tbody>{snapshot?.localStorage.map((item) => <tr key={item.key}><td title={item.key}>{item.key}</td><td title={item.value}>{item.value}</td></tr>)}</tbody></table>
          {snapshot && snapshot.localStorage.length === 0 && !snapshot.localStorageError && <p className="storage-empty">No localStorage items for this origin.</p>}
        </div>
      </section>
    </div>
  </div>
}
