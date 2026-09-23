export type ShortcutId =
  | 'palette-toggle'
  | 'new-tab'
  | 'next-tab'
  | 'previous-tab'
  | 'reopen-closed-tab'
  | 'close-tab'
  | 'reload'
  | 'capture-screenshot'
  | 'connect-repository'
  | 'toggle-dev-panel'
  | 'open-network'
  | 'open-console'
  | 'open-settings'
  | 'open-history'
  | `workspace:${number}`
  | `environment:${number}`

export type ShortcutDefinition = {
  id: ShortcutId
  key: string
  macKey?: string
  control?: boolean
  primary?: boolean
  shift?: boolean
  alt?: boolean
}

const digitKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

export const fixedShortcuts: ShortcutDefinition[] = [
  { id: 'palette-toggle', key: 'p', primary: true, shift: true },
  { id: 'new-tab', key: 't', primary: true },
  { id: 'next-tab', key: 'Tab', control: true },
  { id: 'previous-tab', key: 'Tab', control: true, shift: true },
  { id: 'reopen-closed-tab', key: 't', primary: true, shift: true },
  { id: 'close-tab', key: 'w', primary: true },
  { id: 'reload', key: 'r', primary: true },
  { id: 'capture-screenshot', key: 's', primary: true, shift: true },
  { id: 'connect-repository', key: 'o', primary: true, shift: true },
  { id: 'toggle-dev-panel', key: 'i', primary: true, shift: true },
  { id: 'open-network', key: 'n', alt: true, shift: true },
  { id: 'open-console', key: 'c', alt: true, shift: true },
  { id: 'open-history', key: 'h', macKey: 'y', primary: true },
  { id: 'open-settings', key: ',', primary: true }
]

export function indexedShortcut(kind: 'workspace' | 'environment', index: number): ShortcutDefinition | null {
  const key = digitKeys[index]
  if (!key) return null
  return kind === 'workspace'
    ? { id: `workspace:${index}` as ShortcutId, key, primary: true, alt: true }
    : { id: `environment:${index}` as ShortcutId, key, alt: true, shift: true }
}

export function shortcutById(id: ShortcutId): ShortcutDefinition | null {
  const fixed = fixedShortcuts.find((shortcut) => shortcut.id === id)
  if (fixed) return fixed
  const [kind, indexText] = id.split(':') as ['workspace' | 'environment', string]
  const index = Number(indexText)
  return Number.isInteger(index) ? indexedShortcut(kind, index) : null
}

export function formatShortcut(shortcut: ShortcutDefinition, platform: string = 'win32'): string {
  const primary = platform === 'darwin' ? 'Cmd' : 'Ctrl'
  const key = platform === 'darwin' ? shortcut.macKey ?? shortcut.key : shortcut.key
  const parts = [
    shortcut.control ? 'Ctrl' : '',
    shortcut.primary ? primary : '',
    shortcut.alt ? 'Alt' : '',
    shortcut.shift ? 'Shift' : '',
    key === ',' ? ',' : key.toUpperCase()
  ].filter(Boolean)
  return parts.join(' + ')
}

export function acceleratorForShortcut(shortcut: ShortcutDefinition, platform: string = 'win32'): string {
  const key = platform === 'darwin' ? shortcut.macKey ?? shortcut.key : shortcut.key
  const parts = [
    shortcut.control ? 'Control' : '',
    shortcut.primary ? 'CommandOrControl' : '',
    shortcut.alt ? 'Alt' : '',
    shortcut.shift ? 'Shift' : '',
    key === ',' ? ',' : key.toUpperCase()
  ].filter(Boolean)
  return parts.join('+')
}

export function shortcutIdForKeyboardEvent(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }, platform: string = 'win32'): ShortcutId | null {
  const primaryPressed = platform === 'darwin' ? event.metaKey : event.ctrlKey
  const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
  if (platform === 'darwin' && event.metaKey && event.altKey && !event.ctrlKey) {
    if (!event.shiftKey && event.key === 'ArrowRight') return 'next-tab'
    if (!event.shiftKey && event.key === 'ArrowLeft') return 'previous-tab'
  }
  const shortcuts = [
    ...fixedShortcuts,
    ...digitKeys.flatMap((_, index) => [indexedShortcut('workspace', index), indexedShortcut('environment', index)]).filter((shortcut): shortcut is ShortcutDefinition => Boolean(shortcut))
  ]
  return shortcuts.find((shortcut) => {
    const key = platform === 'darwin' ? shortcut.macKey ?? shortcut.key : shortcut.key
    if (key !== normalizedKey) return false
    if (Boolean(shortcut.control) !== event.ctrlKey) return false
    if (!shortcut.control && Boolean(shortcut.primary) !== primaryPressed) return false
    if (shortcut.control && Boolean(shortcut.primary) && !primaryPressed) return false
    if (Boolean(shortcut.alt) !== event.altKey) return false
    if (Boolean(shortcut.shift) !== event.shiftKey) return false
    return true
  })?.id ?? null
}
