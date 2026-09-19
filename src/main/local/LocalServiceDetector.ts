import { createConnection } from 'node:net'
import type { LocalService } from '../../shared/contracts/browser'

const PORTS = [3000, 3001, 4173, 4200, 5000, 5173, 5174, 8000, 8080, 8888] as const
const TIMEOUT_MS = 250

function isHostOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
    let settled = false
    const finish = (open: boolean): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(TIMEOUT_MS)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function isOpen(port: number): Promise<boolean> {
  const states = await Promise.all([isHostOpen('127.0.0.1', port), isHostOpen('::1', port)])
  return states.some(Boolean)
}

export async function scanLocalServices(): Promise<LocalService[]> {
  const states = await Promise.all(PORTS.map(async (port) => ({ port, open: await isOpen(port) })))
  return states.filter(({ open }) => open).map(({ port }) => ({
    host: 'localhost', port, url: `http://localhost:${port}`, framework: 'Unknown'
  }))
}
