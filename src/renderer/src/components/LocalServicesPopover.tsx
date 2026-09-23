import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Server } from 'lucide-react'
import type { LocalService } from '../../../shared/contracts/browser'
import { browserDom } from '../browserDomController'

export function LocalServicesPopover(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [services, setServices] = useState<LocalService[]>([])
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null)

  async function scan(): Promise<void> {
    setScanning(true)
    setError('')
    try { setServices(await window.devBrowser.localServices.scan()) }
    catch { setError('Could not scan local services.') }
    finally { setScanning(false) }
  }

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    void window.devBrowser.layout.setPaletteOpen(true).then(scan).catch(() => setError('Could not open local services.'))
    function dismiss(event: Event): void { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
    }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', onKeyDown, true)
      void window.devBrowser.layout.setPaletteOpen(false).then(() => {
        if (previous instanceof HTMLElement) previous.focus()
      }).catch(console.error)
    }
  }, [open])

  async function openService(service: LocalService): Promise<void> {
    setOpen(false)
    await window.devBrowser.layout.setPaletteOpen(false)
    await window.devBrowser.tabs.create()
    await browserDom.navigate(service.url)
  }

  return <div className="local-services" ref={root}>
    <button type="button" className={`local-services-trigger${open ? ' is-active' : ''}`} aria-label="Local Services" data-tooltip="Local Services" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Server size={16} strokeWidth={1.75} />
    </button>
    {open && <div className="local-services-popover" role="dialog" aria-label="Local Services">
      <div className="local-services-header"><div><strong>Local Services</strong><span>Known development ports</span></div><button type="button" aria-label="Refresh local services" data-tooltip="Refresh" disabled={scanning} onClick={() => { void scan() }}><RefreshCw size={14} className={scanning ? 'is-spinning' : ''} /></button></div>
      <div className="local-services-list">
        {scanning && services.length === 0 && <p>Scanning localhost…</p>}
        {!scanning && !error && services.length === 0 && <p>No local services found.</p>}
        {error && <p className="local-services-error">{error}</p>}
        {services.map((service) => <button type="button" key={service.port} onClick={() => { void openService(service).catch(console.error) }}>
          <span className="local-service-dot" aria-hidden="true" />
          <span><strong>{service.host}:{service.port}</strong><small>{service.framework}</small></span>
        </button>)}
      </div>
    </div>}
  </div>
}
