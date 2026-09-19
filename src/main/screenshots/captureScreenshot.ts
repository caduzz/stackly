import { dialog, type BrowserWindow, type WebContents } from 'electron'
import { writeFile } from 'node:fs/promises'
import type { ScreenshotResult } from '../../shared/contracts/browser'

function defaultFilename(): string {
  const timestamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
  return `stackly-${timestamp}.png`
}

export async function captureScreenshot(window: BrowserWindow, contents: WebContents): Promise<ScreenshotResult> {
  const selection = await dialog.showSaveDialog(window, {
    title: 'Save Screenshot',
    defaultPath: defaultFilename(),
    buttonLabel: 'Save',
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  })
  if (selection.canceled || !selection.filePath) return 'cancelled'

  const image = await contents.capturePage(undefined, { stayHidden: true })
  if (image.isEmpty()) throw new Error('The active viewport could not be captured')
  await writeFile(selection.filePath, image.toPNG())
  return 'saved'
}
