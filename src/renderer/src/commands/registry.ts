import type { TabState, Workspace } from '../../../shared/contracts/browser'
import { formatShortcut, indexedShortcut, shortcutById, type ShortcutId } from '../../../shared/shortcuts'
import { browserDom } from '../browserDomController'

export type Command = {
  id: string
  label: string
  category: 'Tabs' | 'Workspaces' | 'Environments' | 'Browser' | 'Source Control' | 'Developer Tools' | 'Application'
  keywords: string[]
  shortcutId: ShortcutId
  shortcut: string
  execute: () => void | Promise<unknown>
}

type Context = {
  activeTabId: string | null
  tabs: TabState[]
  workspaces: Workspace[]
  activeWorkspaceId: string
  toggleDevPanel: () => void
  openPanel: (panel: 'network' | 'console') => void
  openSettings: () => void
  openHistory: () => void
  platform: string
}

function adjacentTabId(tabs: TabState[], activeTabId: string | null, direction: 1 | -1): string | null {
  if (tabs.length === 0) return null
  const currentIndex = activeTabId ? tabs.findIndex((tab) => tab.id === activeTabId) : -1
  const index = currentIndex >= 0 ? currentIndex : direction > 0 ? -1 : 0
  return tabs[(index + direction + tabs.length) % tabs.length]?.id ?? null
}

function withShortcut(command: Omit<Command, 'shortcut' | 'shortcutId'>, shortcutId: ShortcutId, platform: string): Command {
  const shortcut = shortcutById(shortcutId)
  return { ...command, shortcutId, shortcut: shortcut ? formatShortcut(shortcut, platform) : '' }
}

export function createCommands(context: Context): Command[] {
  const activeWorkspace = context.workspaces.find((item) => item.id === context.activeWorkspaceId)
  return [
    withShortcut({ id: 'new-tab', label: 'New Tab', category: 'Tabs', keywords: ['create', 'tab'], execute: () => window.devBrowser.tabs.create() }, 'new-tab', context.platform),
    withShortcut({ id: 'next-tab', label: 'Next Tab', category: 'Tabs', keywords: ['switch', 'cycle', 'right'], execute: () => { const id = adjacentTabId(context.tabs, context.activeTabId, 1); if (id) return window.devBrowser.tabs.select(id) } }, 'next-tab', context.platform),
    withShortcut({ id: 'previous-tab', label: 'Previous Tab', category: 'Tabs', keywords: ['switch', 'cycle', 'left'], execute: () => { const id = adjacentTabId(context.tabs, context.activeTabId, -1); if (id) return window.devBrowser.tabs.select(id) } }, 'previous-tab', context.platform),
    withShortcut({ id: 'reopen-closed-tab', label: 'Reopen Closed Tab', category: 'Tabs', keywords: ['restore', 'closed', 'tab'], execute: () => window.devBrowser.tabs.reopenClosed() }, 'reopen-closed-tab', context.platform),
    ...(context.activeTabId ? [withShortcut({ id: 'close-tab', label: 'Close Tab', category: 'Tabs' as const, keywords: ['remove', 'tab'], execute: () => window.devBrowser.tabs.close(context.activeTabId!) }, 'close-tab', context.platform)] : []),
    ...context.workspaces.map((workspace, index) => withShortcut({
      id: `workspace:${workspace.id}`,
      label: `Switch Workspace: ${workspace.name}`,
      category: 'Workspaces' as const,
      keywords: ['project', workspace.name],
      execute: () => window.devBrowser.workspaces.select(workspace.id)
    }, indexedShortcut('workspace', index)?.id ?? `workspace:${index}`, context.platform)),
    ...(activeWorkspace?.environments ?? []).map((environment, index) => withShortcut({
      id: `environment:${environment.id}`,
      label: `Switch Environment: ${environment.name}`,
      category: 'Environments' as const,
      keywords: [environment.kind, environment.baseUrl],
      execute: () => window.devBrowser.environments.select(environment.id)
    }, indexedShortcut('environment', index)?.id ?? `environment:${index}`, context.platform)),
    ...(context.activeTabId ? [
      withShortcut({ id: 'reload', label: 'Reload', category: 'Browser' as const, keywords: ['refresh', 'page'], execute: () => browserDom.reload() }, 'reload', context.platform),
      withShortcut({ id: 'capture-screenshot', label: 'Capture Screenshot', category: 'Browser' as const, keywords: ['image', 'png', 'viewport'], execute: () => window.devBrowser.screenshots.capture() }, 'capture-screenshot', context.platform)
    ] : []),
    withShortcut({ id: 'connect-repository', label: 'Connect Repository', category: 'Source Control', keywords: ['git', 'source', 'folder'], execute: () => window.devBrowser.sourceControl.connectRepository() }, 'connect-repository', context.platform),
    withShortcut({ id: 'toggle-dev-panel', label: 'Toggle Dev Panel', category: 'Developer Tools', keywords: ['tools', 'show', 'hide'], execute: context.toggleDevPanel }, 'toggle-dev-panel', context.platform),
    withShortcut({ id: 'open-network', label: 'Open Network', category: 'Developer Tools', keywords: ['requests', 'dev panel'], execute: () => context.openPanel('network') }, 'open-network', context.platform),
    withShortcut({ id: 'open-console', label: 'Open Console', category: 'Developer Tools', keywords: ['logs', 'dev panel'], execute: () => context.openPanel('console') }, 'open-console', context.platform),
    withShortcut({ id: 'open-history', label: 'Open History', category: 'Browser', keywords: ['visited', 'pages', 'navigation'], execute: context.openHistory }, 'open-history', context.platform),
    withShortcut({ id: 'open-settings', label: 'Open Settings', category: 'Application', keywords: ['preferences', 'configuration'], execute: context.openSettings }, 'open-settings', context.platform)
  ]
}

export function searchCommands(commands: Command[], query: string): Command[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return commands
  return commands.filter((command) => {
    const text = `${command.category} ${command.label} ${command.keywords.join(' ')}`.toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
}
