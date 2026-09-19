import type { BrowserWindow } from 'electron'
import { homedir } from 'node:os'
import { spawn, type IPty } from 'node-pty'
import { browserChannels } from '../../shared/contracts/browser'

export class TerminalManager {
  private readonly terminals = new Map<string, IPty>()

  constructor(private readonly window: BrowserWindow) {}

  create(): string {
    const id = crypto.randomUUID()
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/sh'
    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    const terminal = spawn(shell, [], {
      name: 'xterm-256color', cols: 80, rows: 24, cwd: homedir(), env: { ...env, TERM: 'xterm-256color' }
    })
    this.terminals.set(id, terminal)
    terminal.onData((data) => {
      if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.terminalData, { id, data })
    })
    terminal.onExit(({ exitCode, signal }) => {
      this.terminals.delete(id)
      if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.terminalExit, { id, exitCode, signal: signal || undefined })
    })
    return id
  }

  write(id: string, data: string): void { this.get(id).write(data) }
  resize(id: string, cols: number, rows: number): void { this.get(id).resize(cols, rows) }

  close(id: string): void {
    const terminal = this.terminals.get(id)
    if (!terminal) return
    this.terminals.delete(id)
    terminal.kill()
  }

  dispose(): void {
    for (const id of [...this.terminals.keys()]) this.close(id)
  }

  private get(id: string): IPty {
    const terminal = this.terminals.get(id)
    if (!terminal) throw new Error('Terminal is unavailable')
    return terminal
  }
}
