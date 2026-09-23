import { Menu, type BrowserWindow } from 'electron'
import { browserChannels } from '../../shared/contracts/browser'
import { acceleratorForShortcut, fixedShortcuts, indexedShortcut, type ShortcutDefinition } from '../../shared/shortcuts'

function sendShortcut(window: BrowserWindow, shortcut: ShortcutDefinition): void {
  if (!window.webContents.isDestroyed()) window.webContents.send(browserChannels.commandShortcut, shortcut.id)
}

export function installCommandShortcutMenu(window: BrowserWindow): void {
  const indexedShortcuts = Array.from({ length: 10 }, (_item, index) => [
    indexedShortcut('workspace', index),
    indexedShortcut('environment', index)
  ]).flat().filter((shortcut): shortcut is ShortcutDefinition => Boolean(shortcut))
  const menuShortcuts = fixedShortcuts.filter((shortcut) => shortcut.id !== 'next-tab' && shortcut.id !== 'previous-tab')
  const shortcuts = [...menuShortcuts, ...indexedShortcuts]

  Menu.setApplicationMenu(Menu.buildFromTemplate([{
    label: 'Stackly',
    submenu: shortcuts.map((shortcut) => ({
      label: shortcut.id,
      accelerator: acceleratorForShortcut(shortcut, process.platform),
      click: () => sendShortcut(window, shortcut)
    }))
  }]))
}
