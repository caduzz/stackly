import { useEffect, useMemo, useRef, useState } from 'react'
import type { ElementNode, ElementsSnapshot } from '../../../../shared/contracts/browser'

function label(node: ElementNode): string {
  if (node.nodeType === 3) return node.nodeValue.trim().slice(0, 80)
  const id = node.attributes.id ? `#${node.attributes.id}` : ''
  const classes = node.attributes.class ? `.${node.attributes.class.split(/\s+/).filter(Boolean).join('.')}` : ''
  return `<${node.nodeName.toLowerCase()}${id}${classes}>`
}

function matches(node: ElementNode, query: string): boolean {
  const text = query.toLowerCase()
  return !text || label(node).toLowerCase().includes(text) || Object.entries(node.attributes).some(([key, value]) => `${key}=${value}`.toLowerCase().includes(text))
}

function filtered(node: ElementNode, query: string): ElementNode | null {
  if (!query) return node
  const children = node.children.flatMap((child) => {
    const next = filtered(child, query)
    return next ? [next] : []
  })
  return matches(node, query) || children.length ? { ...node, children } : null
}

function containsNode(node: ElementNode, nodeId: number | null): boolean {
  return nodeId !== null && (node.nodeId === nodeId || node.children.some((child) => containsNode(child, nodeId)))
}

function DomNode({ node, selectedNodeId, query, onSelect }: { node: ElementNode; selectedNodeId: number | null; query: string; onSelect: (node: ElementNode) => void }): React.JSX.Element {
  const selectedInside = containsNode(node, selectedNodeId)
  const [open, setOpen] = useState(node.nodeName === 'HTML' || Boolean(query) || selectedInside)
  const isSelected = node.nodeId === selectedNodeId
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (query || selectedInside) setOpen(true)
  }, [query, selectedInside])

  useEffect(() => {
    if (isSelected) buttonRef.current?.scrollIntoView({ block: 'nearest' })
  }, [isSelected])

  return <div className="elements-node">
    <button ref={buttonRef} type="button" className={isSelected ? 'is-selected' : ''} onClick={() => onSelect(node)}>
      {node.children.length > 0 && <span onClick={(event) => { event.stopPropagation(); setOpen((current) => !current) }}>{open ? '▾' : '▸'}</span>}
      <code>{label(node)}</code>
    </button>
    {isSelected && node.nodeType === 1 && <div className="elements-attrs">{Object.entries(node.attributes).map(([key, value]) => <span key={key}>{key}="{value}"</span>)}</div>}
    {open && node.children.length > 0 && <div className="elements-children">{node.children.map((child) => <DomNode key={child.nodeId} node={child} selectedNodeId={selectedNodeId} query={query} onSelect={onSelect} />)}</div>}
  </div>
}

export function ElementsInspector(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<ElementsSnapshot>({ root: null, selectedNodeId: null, box: null })
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const root = useMemo(() => snapshot.root ? filtered(snapshot.root, query.trim()) : null, [query, snapshot.root])

  async function refresh(): Promise<void> {
    try { setSnapshot(await window.devBrowser.elements.getSnapshot()) }
    catch (cause) { setError(String(cause)) }
  }

  useEffect(() => {
    let disposed = false
    const unsubscribe = window.devBrowser.elements.onChanged(() => {
      if (disposed) return
      setPicking(false)
      void refresh()
    })
    void refresh()
    return () => {
      disposed = true
      unsubscribe()
      void window.devBrowser.elements.stopPicker().catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!picking) return
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      event.preventDefault()
      void window.devBrowser.elements.stopPicker().finally(() => setPicking(false))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [picking])

  async function select(node: ElementNode): Promise<void> {
    if (node.nodeType !== 1) return
    setError('')
    try {
      await window.devBrowser.elements.selectNode(node.nodeId)
      await refresh()
    } catch (cause) { setError(String(cause)) }
  }

  async function togglePicker(): Promise<void> {
    setError('')
    try {
      if (picking) {
        await window.devBrowser.elements.stopPicker()
        setPicking(false)
      } else {
        await window.devBrowser.elements.startPicker()
        setPicking(true)
      }
    } catch (cause) { setError(String(cause)) }
  }

  return <div className="elements-inspector">
    <div className="elements-toolbar">
      <button type="button" className={picking ? 'is-active' : ''} onClick={() => { void togglePicker() }}>{picking ? 'Stop selecting' : 'Select element'}</button>
      <input aria-label="Search DOM" placeholder="Search tag, .class, #id or text" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button type="button" onClick={() => { void refresh() }}>Refresh</button>
    </div>
    {error && <p className="storage-error">{error}</p>}
    <div className="elements-content">
      <div className="elements-tree" aria-label="DOM tree">{root ? <DomNode node={root} selectedNodeId={snapshot.selectedNodeId} query={query} onSelect={(node) => { void select(node) }} /> : <p>No DOM nodes available.</p>}</div>
      <aside className="elements-side" aria-label="Selected element details">
        <h3>Selected</h3>
        {snapshot.box ? <dl>
          <div><dt>x</dt><dd>{Math.round(snapshot.box.x)}</dd></div>
          <div><dt>y</dt><dd>{Math.round(snapshot.box.y)}</dd></div>
          <div><dt>w</dt><dd>{Math.round(snapshot.box.width)}</dd></div>
          <div><dt>h</dt><dd>{Math.round(snapshot.box.height)}</dd></div>
        </dl> : <p>Select an element to inspect its box.</p>}
        <p>DOM edits and CSS inspection come in the next FEATURE-28 stage.</p>
      </aside>
    </div>
  </div>
}
