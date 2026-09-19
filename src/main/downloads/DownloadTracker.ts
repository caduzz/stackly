import type { DownloadItem, Session } from 'electron'
import type { DownloadEntry } from '../../shared/contracts/browser'

const MAX_ITEMS = 50

export class DownloadTracker {
  private readonly entries = new Map<string, DownloadEntry>()

  constructor(private readonly session: Session, private readonly onChange: () => void) {
    session.on('will-download', this.handleDownload)
  }

  private readonly handleDownload = (_event: Electron.Event, item: DownloadItem): void => {
    const id = crypto.randomUUID()
    const update = (state = item.getState()): void => {
      this.entries.set(id, {
        id, filename: item.getFilename(), url: item.getURL(), state,
        receivedBytes: item.getReceivedBytes(), totalBytes: item.getTotalBytes(),
        startedAt: this.entries.get(id)?.startedAt ?? Date.now()
      })
      while (this.entries.size > MAX_ITEMS) this.entries.delete(this.entries.keys().next().value!)
      this.onChange()
    }
    item.on('updated', () => update())
    item.once('done', (_doneEvent, state) => update(state))
    update()
  }

  snapshot(): DownloadEntry[] {
    return [...this.entries.values()].sort((a, b) => b.startedAt - a.startedAt)
  }

  dispose(): void { this.session.removeListener('will-download', this.handleDownload) }
}
