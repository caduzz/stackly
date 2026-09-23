import { useEffect, useRef, useState } from 'react'
import { FileCode2, GitCommitHorizontal, Globe2, LoaderCircle, MonitorSmartphone, Plus, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import type { GitCommit, GitFileDiff } from '../features/source-control/types'
import { useTabsStore } from '../stores/tabs'

export type InternalTab = { id: string; kind: 'commit'; commit: GitCommit } | { id: string; kind: 'diff'; diff: GitFileDiff }

export function TabBar({ internalTabs = [], activeInternalTabId, onSelectBrowserTab, onSelectInternalTab, onCloseInternalTab }: { internalTabs?: InternalTab[]; activeInternalTabId?: string | null; onSelectBrowserTab?: () => void; onSelectInternalTab?: (id: string) => void; onCloseInternalTab?: (id: string) => void }): React.JSX.Element {
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const hasActiveInternalTab = Boolean(activeInternalTabId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<{ tabId: string; startX: number; dragging: boolean; list: HTMLDivElement; item: HTMLElement; startIds: string[]; startIndex: number; targetIndex: number } | null>(null)
  const suppressClickRef = useRef(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string | null } | null>(null)
  const [newTabMenu, setNewTabMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!contextMenu && !newTabMenu) return
    const close = (): void => { setContextMenu(null); setNewTabMenu(null) }
    document.addEventListener('click', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', close)
    }
  }, [contextMenu, newTabMenu])

  function updateDrag(clientX: number): boolean {
    const gesture = gestureRef.current
    if (!gesture) return false
    const deltaX = clientX - gesture.startX
    if (!gesture.dragging && Math.abs(deltaX) < 5) return false
    gesture.dragging = true
    gesture.list.classList.add('is-reordering')
    gesture.item.classList.add('tab-item--reordering')
    gesture.item.style.transform = `translateX(${deltaX}px)`
    const targetIndex = targetIndexForClientX(gesture.tabId, clientX)
    if (targetIndex !== gesture.targetIndex) {
      gesture.targetIndex = targetIndex
      applySiblingTransforms(gesture.tabId, gesture.startIndex, targetIndex)
    }
    return true
  }

  function moveDrag(event: MouseEvent): void {
    if (!updateDrag(event.clientX)) return
    event.preventDefault()
  }

  function stopDrag(): void {
    const gesture = gestureRef.current
    if (!gesture) return
    if (gesture.dragging) suppressNextClick()
    gesture.list.classList.remove('is-reordering', 'is-panning-left', 'is-panning-right')
    gesture.item.classList.remove('tab-item--reordering')
    clearTabTransforms()
    gestureRef.current = null
    window.removeEventListener('mousemove', moveDrag)
    window.removeEventListener('mouseup', stopDrag)
    if (gesture.dragging) {
      const nextIds = reorderedIds(gesture.startIds, gesture.tabId, gesture.targetIndex)
      if (nextIds.join('\0') !== gesture.startIds.join('\0')) {
        void window.devBrowser.tabs.reorder(nextIds).catch(console.error)
      }
    }
  }

  function suppressNextClick(): void {
    suppressClickRef.current = true
    window.addEventListener('click', stopSuppressedClick, { capture: true, once: true })
    window.setTimeout(() => {
      suppressClickRef.current = false
      window.removeEventListener('click', stopSuppressedClick, { capture: true })
    }, 0)
  }

  function stopSuppressedClick(event: MouseEvent): void {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  function startDrag(event: MouseEvent, tabId: string): void {
    if (event.button !== 0) return
    const list = scrollRef.current
    const item = (event.target as HTMLElement | null)?.closest<HTMLElement>('.tab-item[data-tab-id]')
    if (!list || !item) return
    const tabIds = tabs.map((tab) => tab.id)
    const startIndex = tabIds.indexOf(tabId)
    gestureRef.current = { tabId, startX: event.clientX, dragging: false, list, item, startIds: tabIds, startIndex, targetIndex: startIndex }
    window.addEventListener('mousemove', moveDrag, { passive: false })
    window.addEventListener('mouseup', stopDrag)
  }

  function startButtonDrag(tabId: string, event: React.MouseEvent<HTMLButtonElement>): void {
    if (gestureRef.current) return
    startDrag(event.nativeEvent, tabId)
  }

  function closeTabOnMiddleClick(tabId: string, event: React.MouseEvent<HTMLElement>): void {
    if (event.button !== 1) return
    event.preventDefault()
    event.stopPropagation()
    void window.devBrowser.tabs.close(tabId).catch(console.error)
  }

  function toggleMute(tabId: string, muted: boolean, event?: React.MouseEvent<HTMLElement>): void {
    event?.preventDefault()
    event?.stopPropagation()
    void window.devBrowser.tabs.setAudioMuted(tabId, muted).catch(console.error)
  }

  function reopenClosedTab(): void {
    onSelectBrowserTab?.()
    void window.devBrowser.tabs.reopenClosed().catch(console.error)
  }

  function createTab(kind: 'normal' | 'device'): void {
    onSelectBrowserTab?.()
    setNewTabMenu(null)
    void window.devBrowser.tabs.create(undefined, true, kind).catch(console.error)
  }

  function openTabContextMenu(tabId: string, event: React.MouseEvent<HTMLElement>): void {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, tabId })
  }

  function openStripContextMenu(event: React.MouseEvent<HTMLDivElement>): void {
    if ((event.target as HTMLElement | null)?.closest('.tab-item')) return
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, tabId: null })
  }

  function targetIndexForClientX(movingId: string, clientX: number): number {
    const strip = stripRef.current
    if (!strip) return tabs.findIndex((tab) => tab.id === movingId)
    const items = [...strip.querySelectorAll<HTMLElement>('.tab-item[data-tab-id]')]
    let index = 0
    for (const item of items) {
      if (item.dataset.tabId === movingId) continue
      const rect = item.getBoundingClientRect()
      if (clientX > rect.left + rect.width / 2) index += 1
    }
    return index
  }

  function applySiblingTransforms(movingId: string, startIndex: number, targetIndex: number): void {
    const strip = stripRef.current
    if (!strip) return
    const distance = tabMovementDistance()
    const items = [...strip.querySelectorAll<HTMLElement>('.tab-item[data-tab-id]')]
    for (const item of items) {
      if (item.dataset.tabId === movingId) continue
      const index = tabs.findIndex((tab) => tab.id === item.dataset.tabId)
      let offset = 0
      if (targetIndex > startIndex && index > startIndex && index <= targetIndex) offset = -distance
      if (targetIndex < startIndex && index >= targetIndex && index < startIndex) offset = distance
      item.style.transform = offset ? `translateX(${offset}px)` : ''
    }
  }

  function clearTabTransforms(): void {
    const strip = stripRef.current
    if (!strip) return
    for (const item of strip.querySelectorAll<HTMLElement>('.tab-item[data-tab-id]')) item.style.transform = ''
  }

  function tabMovementDistance(): number {
    const strip = stripRef.current
    const item = strip?.querySelector<HTMLElement>('.tab-item[data-tab-id]')
    if (!item) return 170
    const styles = getComputedStyle(item)
    return item.offsetWidth + Number.parseFloat(styles.marginLeft) + Number.parseFloat(styles.marginRight)
  }

  function maybeSuppressClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  function shouldIgnoreClick(event: React.MouseEvent<HTMLElement>): boolean {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  return <div className="tab-bar">
    <div
      ref={scrollRef}
      className="tab-list"
      role="tablist"
      aria-label="Tabs"
      onClickCapture={maybeSuppressClick}
      onContextMenu={openStripContextMenu}
    >
      <div ref={stripRef} className="tab-strip">
        {tabs.map((tab) => {
          return <div
            className={`tab-item${!hasActiveInternalTab && tab.id === activeTabId ? ' tab-item--active' : ''}`}
            key={tab.id}
            data-tab-id={tab.id}
            onMouseUp={(event) => closeTabOnMiddleClick(tab.id, event)}
            onContextMenu={(event) => openTabContextMenu(tab.id, event)}
          >
          <button className="tab-select" role="tab" aria-selected={!hasActiveInternalTab && tab.id === activeTabId} data-tooltip={tab.title} draggable={false} onMouseDownCapture={(event) => startButtonDrag(tab.id, event)} onClick={(event) => {
            if (shouldIgnoreClick(event)) return
            onSelectBrowserTab?.()
            void window.devBrowser.tabs.select(tab.id).catch(console.error)
          }}>
            {tab.isLoading ? <LoaderCircle className="tab-loading" size={14} strokeWidth={1.75} aria-hidden="true" /> : tab.kind === 'device' ? <MonitorSmartphone size={14} strokeWidth={1.75} aria-hidden="true" /> : <Globe2 size={14} strokeWidth={1.75} aria-hidden="true" />}
            <span>{tab.title}</span>
          </button>
          {(tab.isAudible || tab.isMuted) && <button className={`tab-audio${tab.isMuted ? ' is-muted' : ''}`} type="button" aria-label={tab.isMuted ? `Ativar som da guia ${tab.title}` : `Mutar guia ${tab.title}`} data-tooltip={tab.isMuted ? 'Ativar som da guia' : 'Mutar guia'} draggable={false} onMouseDownCapture={(event) => startButtonDrag(tab.id, event)} onClick={(event) => {
            if (shouldIgnoreClick(event)) return
            toggleMute(tab.id, !tab.isMuted, event)
          }}>
            {tab.isMuted ? <VolumeX size={13} strokeWidth={1.8} aria-hidden="true" /> : <Volume2 size={13} strokeWidth={1.8} aria-hidden="true" />}
          </button>}
          <button className="tab-close" type="button" aria-label={`Close ${tab.title}`} data-tooltip={`Close ${tab.title}`} draggable={false} onMouseDownCapture={(event) => startButtonDrag(tab.id, event)} onClick={(event) => {
            if (shouldIgnoreClick(event)) return
            void window.devBrowser.tabs.close(tab.id).catch(console.error)
          }}>
            <X size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        })}
        {internalTabs.map((tab) => <div className={`tab-item${tab.id === activeInternalTabId ? ' tab-item--active' : ''}`} key={tab.id}>
          <button className="tab-select" role="tab" aria-selected={tab.id === activeInternalTabId} data-tooltip={tab.kind === 'commit' ? tab.commit.message : tab.diff.path} draggable={false} onClick={() => onSelectInternalTab?.(tab.id)}>
            {tab.kind === 'commit'
              ? <GitCommitHorizontal size={14} strokeWidth={1.75} aria-hidden="true" />
              : <FileCode2 size={14} strokeWidth={1.75} aria-hidden="true" />}
            <span>{tab.kind === 'commit' ? `Commit ${tab.commit.shortHash}` : `Diff ${fileName(tab.diff.path)}`}</span>
          </button>
          <button className="tab-close" type="button" aria-label={tab.kind === 'commit' ? `Close commit ${tab.commit.shortHash}` : `Close diff ${tab.diff.path}`} data-tooltip={tab.kind === 'commit' ? `Close commit ${tab.commit.shortHash}` : `Close diff ${tab.diff.path}`} draggable={false} onClick={() => onCloseInternalTab?.(tab.id)}>
            <X size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>)}
        <button className="tab-new" type="button" aria-label="New Tab" data-tooltip="New Tab" onClick={(event) => {
          event.stopPropagation()
          const rect = event.currentTarget.getBoundingClientRect()
          setNewTabMenu({ x: rect.left, y: rect.bottom + 4 })
        }}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {newTabMenu && <div className="tab-context-menu" role="menu" style={{ left: newTabMenu.x, top: newTabMenu.y }}>
        <button type="button" role="menuitem" onClick={() => createTab('normal')}><Globe2 size={14} aria-hidden="true" />Nova aba</button>
        <button type="button" role="menuitem" onClick={() => createTab('device')}><MonitorSmartphone size={14} aria-hidden="true" />Nova aba Device</button>
      </div>}
      {contextMenu && <div className="tab-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
        {!contextMenu.tabId && <button type="button" role="menuitem" onClick={() => {
          setContextMenu(null)
          createTab('normal')
        }}><Globe2 size={14} aria-hidden="true" />Nova aba</button>}
        {!contextMenu.tabId && <button type="button" role="menuitem" onClick={() => {
          setContextMenu(null)
          createTab('device')
        }}><MonitorSmartphone size={14} aria-hidden="true" />Nova aba Device</button>}
        {contextMenu.tabId && (() => {
          const tab = tabs.find((item) => item.id === contextMenu.tabId)
          if (!tab) return null
          return <button type="button" role="menuitem" onClick={(event) => {
            setContextMenu(null)
            toggleMute(tab.id, !tab.isMuted, event)
          }}>{tab.isMuted ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}{tab.isMuted ? 'Ativar som da guia' : 'Mutar guia'}</button>
        })()}
        <button type="button" role="menuitem" onClick={() => {
          setContextMenu(null)
          reopenClosedTab()
        }}><RotateCcw size={14} aria-hidden="true" />Reabrir guia fechada</button>
      </div>}
    </div>
  </div>
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

function reorderedIds(ids: string[], movingId: string, targetIndex: number): string[] {
  const next = ids.filter((id) => id !== movingId)
  next.splice(Math.min(next.length, Math.max(0, targetIndex)), 0, movingId)
  return next
}
