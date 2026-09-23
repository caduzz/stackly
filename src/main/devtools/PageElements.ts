import type { WebContents } from 'electron'
import type { ElementBox, ElementNode, ElementsSnapshot } from '../../shared/contracts/browser'

type CdpNode = { nodeId: number; nodeType: number; nodeName: string; nodeValue: string; attributes?: string[]; children?: CdpNode[] }
type BoxModel = { model: { content: number[] } }

const MAX_NODES = 1800

function attrs(values: string[] | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  for (let index = 0; index < (values?.length ?? 0); index += 2) result[values![index]] = values![index + 1] ?? ''
  return result
}

function convert(node: CdpNode, budget: { count: number }): ElementNode | null {
  if (++budget.count > MAX_NODES) return null
  const children = (node.children ?? []).flatMap((child) => {
    const converted = convert(child, budget)
    return converted ? [converted] : []
  })
  return { nodeId: node.nodeId, nodeType: node.nodeType, nodeName: node.nodeName, nodeValue: node.nodeValue, attributes: attrs(node.attributes), children }
}

function boxFromContent(content: number[]): ElementBox {
  const xs = [content[0], content[2], content[4], content[6]]
  const ys = [content[1], content[3], content[5], content[7]]
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export class PageElements {
  private selectedNodeId: number | null = null
  private enabled = false
  private inspecting = false
  private pickerVersion = 0

  constructor(private readonly contents: WebContents, private readonly ensureAttached: () => Promise<void>, private readonly onChange: () => void) {}

  private readonly onMessage = (_event: Electron.Event, method: string, raw: unknown): void => {
    if (method !== 'Overlay.inspectNodeRequested') return
    if (!this.inspecting) return
    const version = this.pickerVersion
    const event = raw as { backendNodeId?: number; nodeId?: number }
    void this.resolveInspectedNode(event).then(async (nodeId) => {
      if (!this.inspecting || version !== this.pickerVersion) return
      if (!nodeId) return
      await this.stopPicker(false)
      this.selectedNodeId = nodeId
      this.onChange()
    }).catch(() => {})
  }

  private async enable(): Promise<void> {
    await this.ensureAttached()
    if (this.enabled) return
    this.contents.debugger.removeListener('message', this.onMessage)
    this.contents.debugger.on('message', this.onMessage)
    await this.contents.debugger.sendCommand('DOM.enable')
    await this.contents.debugger.sendCommand('Overlay.enable')
    this.enabled = true
  }

  async snapshot(): Promise<ElementsSnapshot> {
    await this.enable()
    const document = await this.contents.debugger.sendCommand('DOM.getDocument', { depth: -1, pierce: true }) as { root: CdpNode }
    const root = convert(document.root, { count: 0 })
    let box: ElementBox | null = null
    if (this.selectedNodeId) {
      try { box = boxFromContent((await this.contents.debugger.sendCommand('DOM.getBoxModel', { nodeId: this.selectedNodeId }) as BoxModel).model.content) } catch { this.selectedNodeId = null }
    }
    return { root, selectedNodeId: this.selectedNodeId, box }
  }

  async selectNode(nodeId: number): Promise<void> {
    await this.enable()
    await this.stopPicker(false)
    this.selectedNodeId = nodeId
    await this.hideHighlight()
    this.onChange()
  }

  async startPicker(): Promise<void> {
    await this.enable()
    await this.hideHighlight()
    this.pickerVersion += 1
    await this.contents.debugger.sendCommand('Overlay.setInspectMode', { mode: 'searchForNode', highlightConfig: this.highlightConfig() })
    this.inspecting = true
  }

  async stopPicker(notify = true): Promise<void> {
    const wasInspecting = this.inspecting
    this.inspecting = false
    this.pickerVersion += 1
    if (!this.contents.isDestroyed() && this.contents.debugger.isAttached()) {
      await this.contents.debugger.sendCommand('Overlay.setInspectMode', { mode: 'none' }).catch(() => {})
      await this.hideHighlight()
    }
    if (notify && wasInspecting) this.onChange()
  }

  dispose(): void {
    if (!this.contents.isDestroyed()) {
      this.contents.debugger.removeListener('message', this.onMessage)
      void this.stopPicker()
    }
  }

  private async resolveInspectedNode(event: { backendNodeId?: number; nodeId?: number }): Promise<number | null> {
    if (event.nodeId) return event.nodeId
    if (!event.backendNodeId) return null
    const result = await this.contents.debugger.sendCommand('DOM.pushNodesByBackendIdsToFrontend', { backendNodeIds: [event.backendNodeId] }) as { nodeIds: number[] }
    return result.nodeIds[0] ?? null
  }

  private async hideHighlight(): Promise<void> {
    if (!this.contents.isDestroyed() && this.contents.debugger.isAttached()) await this.contents.debugger.sendCommand('Overlay.hideHighlight').catch(() => {})
  }

  private highlightConfig(): object {
    return { contentColor: { r: 104, g: 143, b: 255, a: 0.28 }, borderColor: { r: 128, g: 98, b: 214, a: 0.9 }, showInfo: true }
  }
}
