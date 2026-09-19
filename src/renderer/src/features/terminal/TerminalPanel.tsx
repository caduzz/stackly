import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function TerminalPanel(): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Starting shell…')

  useEffect(() => {
    const node = container.current
    if (!node) return
    let disposed = false
    let id: string | null = null
    const buffered: { id: string; data: string }[] = []
    const styles = getComputedStyle(document.documentElement)
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
      fontSize: 12,
      scrollback: 5000,
      theme: {
        background: styles.getPropertyValue('--color-bg-secondary').trim(),
        foreground: styles.getPropertyValue('--color-text-primary').trim(),
        cursor: styles.getPropertyValue('--color-accent').trim(),
        selectionBackground: styles.getPropertyValue('--color-selection').trim()
      }
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(node)

    const unsubscribeData = window.devBrowser.terminal.onData((event) => {
      if (id === event.id) terminal.write(event.data)
      else if (!id) buffered.push(event)
    })
    const unsubscribeExit = window.devBrowser.terminal.onExit((event) => {
      if (id === event.id) {
        terminal.writeln(`\r\n[process exited with code ${event.exitCode}]`)
        setStatus('Exited')
        id = null
      }
    })
    const input = terminal.onData((data) => { if (id) void window.devBrowser.terminal.write(id, data).catch(console.error) })

    function resize(): void {
      if (!id || disposed) return
      fit.fit()
      void window.devBrowser.terminal.resize(id, terminal.cols, terminal.rows).catch(console.error)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(node)

    void window.devBrowser.terminal.create().then((terminalId) => {
      if (disposed) { void window.devBrowser.terminal.close(terminalId); return }
      id = terminalId
      for (const event of buffered) if (event.id === id) terminal.write(event.data)
      buffered.length = 0
      setStatus('Running')
      resize()
      terminal.focus()
    }).catch((error: unknown) => setStatus(`Failed: ${String(error)}`))

    return () => {
      disposed = true
      observer.disconnect()
      input.dispose()
      unsubscribeData()
      unsubscribeExit()
      if (id) void window.devBrowser.terminal.close(id).catch(console.error)
      terminal.dispose()
    }
  }, [])

  return <div className="terminal-panel">
    <div className="terminal-status" aria-live="polite">Terminal · {status}</div>
    <div ref={container} className="terminal-host" aria-label="Integrated terminal" />
  </div>
}
