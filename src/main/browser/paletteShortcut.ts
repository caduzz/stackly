import type { WebContents } from 'electron'
import { browserChannels } from '../../shared/contracts/browser'

export function registerPaletteShortcut(contents: WebContents, shell: WebContents, isPaletteOpen: () => boolean): void {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key.toLowerCase() === 'p' && input.shift && (input.control || input.meta)) {
      event.preventDefault()
      if (!shell.isDestroyed()) shell.send(browserChannels.togglePalette)
    } else if (input.key === 'Escape' && isPaletteOpen()) {
      event.preventDefault()
      if (!shell.isDestroyed()) shell.send(browserChannels.closePalette)
    }
  })
}
