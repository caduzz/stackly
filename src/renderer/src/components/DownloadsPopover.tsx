import { useEffect, useRef, useState } from 'react'
import { Check, Download, TriangleAlert } from 'lucide-react'
import type { DownloadEntry } from '../../../shared/contracts/browser'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function DownloadsPopover(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<DownloadEntry[]>([])
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.devBrowser.downloads.getAll().then(setItems).catch(console.error)
    return window.devBrowser.downloads.onChange(setItems)
  }, [])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    void window.devBrowser.layout.setPaletteOpen(true)
    const dismiss = (event: Event): void => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false) } }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', onKeyDown, true)
      void window.devBrowser.layout.setPaletteOpen(false).then(() => { if (previous instanceof HTMLElement) previous.focus() }).catch(console.error)
    }
  }, [open])

  const active = items.filter((item) => item.state === 'progressing').length
  return <div className="downloads" ref={root}>
    <button type="button" className={`downloads-trigger${open ? ' is-active' : ''}`} aria-label="Downloads" data-tooltip="Downloads" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Download size={16} strokeWidth={1.75} />{active > 0 && <span>{active}</span>}
    </button>
    {open && <div className="downloads-popover" role="dialog" aria-label="Downloads">
      <header><strong>Downloads</strong><span>{items.length} recent</span></header>
      <div className="downloads-list">
        {items.length === 0 && <p>No downloads yet.</p>}
        {items.map((item) => {
          const progress = item.totalBytes > 0 ? Math.min(100, item.receivedBytes / item.totalBytes * 100) : 0
          return <div className="download-item" key={item.id} title={item.url}>
            {item.state === 'completed' ? <Check size={14} /> : item.state === 'progressing' ? <Download size={14} /> : <TriangleAlert size={14} />}
            <div><strong>{item.filename}</strong><small>{item.state === 'progressing' ? `${formatBytes(item.receivedBytes)} / ${item.totalBytes ? formatBytes(item.totalBytes) : 'unknown'}` : item.state}</small>
              {item.state === 'progressing' && <progress value={progress} max="100" />}
            </div>
          </div>
        })}
      </div>
    </div>}
  </div>
}
