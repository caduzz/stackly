import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import { NetworkInspector } from '../features/network/NetworkInspector'
import { ConsoleInspector } from '../features/console/ConsoleInspector'
import { StorageInspector } from '../features/storage/StorageInspector'
import { ApiClient } from '../features/api/ApiClient'
import { TerminalPanel } from '../features/terminal/TerminalPanel'
import { ErrorCenter } from '../features/errors/ErrorCenter'
import { ElementsInspector } from '../features/elements/ElementsInspector'
import { ProtectedContentDiagnostics } from '../features/drm/ProtectedContentDiagnostics'

export type DevPanelKind = 'elements' | 'errors' | 'network' | 'console' | 'storage' | 'api' | 'terminal' | 'drm'

const panels: { id: DevPanelKind; label: string }[] = [
  { id: 'elements', label: 'Elements' },
  { id: 'errors', label: 'Errors' },
  { id: 'network', label: 'Network' },
  { id: 'console', label: 'Console' },
  { id: 'storage', label: 'Storage' },
  { id: 'drm', label: 'DRM' },
  { id: 'api', label: 'API' },
  { id: 'terminal', label: 'Terminal' }
]

type Props = {
  height: number
  onHeightChange: (height: number) => void
  activePanel: DevPanelKind
  onPanelChange: (panel: DevPanelKind) => void
  onClose: () => void
  networkKey: string
  targetAvailable: boolean
  targetLabel: string
  targetReady: boolean
}

function heightLimits(): { min: number; max: number } {
  return { min: 130, max: Math.max(130, window.innerHeight - 250) }
}

export function DevPanel({ height, onHeightChange, activePanel, onPanelChange, onClose, networkKey, targetAvailable, targetLabel, targetReady }: Props): React.JSX.Element {
  const drag = useRef<{ y: number; height: number } | null>(null)
  const tabRefs = useRef<Record<DevPanelKind, HTMLButtonElement | null>>({ elements: null, errors: null, network: null, console: null, storage: null, api: null, terminal: null, drm: null })
  const limits = heightLimits()

  useEffect(() => () => {
    if (drag.current) void window.devBrowser.layout.setPanelResizing(false).catch(console.error)
  }, [])

  function updateHeight(next: number): void {
    const { min, max } = heightLimits()
    onHeightChange(Math.round(Math.max(min, Math.min(max, next))))
  }

  function finishDrag(): void {
    if (!drag.current) return
    drag.current = null
    void window.devBrowser.layout.setPanelResizing(false).catch(console.error)
  }

  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % panels.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + panels.length) % panels.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = panels.length - 1
    else return
    event.preventDefault()
    onPanelChange(panels[next].id)
    tabRefs.current[panels[next].id]?.focus()
  }

  const needsChromiumTarget = activePanel === 'elements' || activePanel === 'errors' || activePanel === 'network' || activePanel === 'console' || activePanel === 'storage' || activePanel === 'drm'

  return <section className="shell-dev-panel" style={{ height: Math.min(height, limits.max) }} aria-label="Development panel">
    <div
      className="dev-panel-resize"
      role="separator"
      aria-label="Resize development panel"
      aria-orientation="horizontal"
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      aria-valuenow={Math.min(height, limits.max)}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        drag.current = { y: event.clientY, height }
        event.currentTarget.setPointerCapture(event.pointerId)
        void window.devBrowser.layout.setPanelResizing(true).catch(console.error)
      }}
      onPointerMove={(event) => { if (drag.current) updateHeight(drag.current.height + drag.current.y - event.clientY) }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') { event.preventDefault(); updateHeight(height + 20) }
        else if (event.key === 'ArrowDown') { event.preventDefault(); updateHeight(height - 20) }
        else if (event.key === 'Home') { event.preventDefault(); updateHeight(limits.min) }
        else if (event.key === 'End') { event.preventDefault(); updateHeight(limits.max) }
      }}
    />
    <div className="shell-panel-header">
      <div className="dev-panel-tabs" role="tablist" aria-label="Developer tools">
        {panels.map((panel, index) => <button
          key={panel.id}
          ref={(node) => { tabRefs.current[panel.id] = node }}
          id={`dev-tab-${panel.id}`}
          type="button"
          role="tab"
          aria-selected={activePanel === panel.id}
          aria-controls="dev-panel-content"
          tabIndex={activePanel === panel.id ? 0 : -1}
          className={`dev-panel-tab${activePanel === panel.id ? ' is-active' : ''}`}
          onClick={() => onPanelChange(panel.id)}
          onKeyDown={(event) => onTabKeyDown(event, index)}
        >{panel.label}</button>)}
      </div>
      <span className="dev-panel-target" title={targetLabel}>Target: {targetLabel}</span>
      <IconButton icon={X} aria-label="Close Dev Panel" title="Close Dev Panel" onClick={onClose} />
    </div>
    <div className="shell-panel-body shell-panel-body--network" id="dev-panel-content" role="tabpanel" aria-labelledby={`dev-tab-${activePanel}`} tabIndex={0}>
      {needsChromiumTarget && !targetAvailable
        ? <div className="dev-panel-empty-target">Select a Chromium target to inspect.</div>
        : needsChromiumTarget && !targetReady
          ? <div className="dev-panel-empty-target">Binding Dev Panel target...</div>
          : activePanel === 'elements' ? <ElementsInspector key={networkKey} /> : activePanel === 'errors' ? <ErrorCenter key={networkKey} targetLabel={targetLabel} onOpenPanel={onPanelChange} /> : activePanel === 'network' ? <NetworkInspector key={networkKey} /> : activePanel === 'console' ? <ConsoleInspector key={networkKey} /> : activePanel === 'storage' ? <StorageInspector key={networkKey} /> : activePanel === 'drm' ? <ProtectedContentDiagnostics key={networkKey} /> : activePanel === 'api' ? <ApiClient /> : <TerminalPanel />}
    </div>
  </section>
}
