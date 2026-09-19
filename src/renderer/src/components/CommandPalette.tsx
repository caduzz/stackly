import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { searchCommands, type Command } from '../commands/registry'

type Props = { commands: Command[]; onClose: () => void }

export function CommandPalette({ commands, onClose }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const matches = useMemo(() => searchCommands(commands, query), [commands, query])
  const groups = useMemo(() => {
    const grouped = new Map<Command['category'], Command[]>()
    for (const command of matches) grouped.set(command.category, [...(grouped.get(command.category) ?? []), command])
    return [...grouped.entries()]
  }, [matches])

  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, matches])

  useEffect(() => {
    const previous = document.activeElement
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onEscape, true)
    void window.devBrowser.layout.setPaletteOpen(true).then(() => inputRef.current?.focus()).catch(console.error)
    return () => {
      document.removeEventListener('keydown', onEscape, true)
      void window.devBrowser.layout.setPaletteOpen(false).then(() => {
        if (previous instanceof HTMLElement && previous !== document.body) previous.focus()
      }).catch(console.error)
    }
  }, [])

  function run(command: Command): void {
    onClose()
    void Promise.resolve().then(() => command.execute()).catch((error: unknown) => console.error('Command failed', error))
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && matches[activeIndex]) {
      event.preventDefault()
      run(matches[activeIndex])
    }
  }

  return <div className="palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="palette-search">
        <Search size={16} strokeWidth={1.75} aria-hidden="true" />
        <input ref={inputRef} aria-label="Search commands" role="combobox" aria-controls="command-results" aria-expanded="true" aria-activedescendant={matches[activeIndex] ? `command-${matches[activeIndex].id}` : undefined} placeholder="Search commands" value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} onKeyDown={onKeyDown} />
        <kbd>Esc</kbd>
      </div>
      <div id="command-results" className="palette-results" role="listbox" aria-label="Commands">
        {matches.length === 0 && <div className="palette-empty">No commands found</div>}
        {groups.map(([category, categoryCommands]) => <section className="palette-group" key={category} role="group" aria-labelledby={`command-category-${category.replaceAll(' ', '-').toLowerCase()}`}>
          <h3 id={`command-category-${category.replaceAll(' ', '-').toLowerCase()}`}>{category}</h3>
          {categoryCommands.map((command) => {
            const index = matches.indexOf(command)
            return <button ref={(node) => { optionRefs.current[index] = node }} id={`command-${command.id}`} key={command.id} type="button" role="option" aria-selected={index === activeIndex} className={`palette-command${index === activeIndex ? ' is-active' : ''}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => run(command)}>
              <span>{command.label}</span>{command.shortcut && <kbd>{command.shortcut}</kbd>}
            </button>
          })}
        </section>)}
      </div>
      <div className="palette-footer">↑ ↓ Navigate <span>↵ Select</span></div>
    </div>
  </div>
}
