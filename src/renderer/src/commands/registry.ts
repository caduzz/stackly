import type { Workspace } from '../../../shared/contracts/browser'

export type Command = {
  id: string
  label: string
  category: 'Tabs' | 'Workspaces' | 'Environments' | 'Browser' | 'Developer Tools' | 'Application'
  keywords: string[]
  shortcut?: string
  execute: () => void | Promise<unknown>
}

type Context = {
  activeTabId: string | null
  workspaces: Workspace[]
  activeWorkspaceId: string
  toggleDevPanel: () => void
  openPanel: (panel: 'network' | 'console') => void
  openSettings: () => void
}

export function createCommands(context: Context): Command[] {
  const activeWorkspace = context.workspaces.find((item) => item.id === context.activeWorkspaceId)
  return [
    { id: 'new-tab', label: 'New Tab', category: 'Tabs', keywords: ['create', 'tab'], execute: () => window.devBrowser.tabs.create() },
    ...(context.activeTabId ? [{ id: 'close-tab', label: 'Close Tab', category: 'Tabs' as const, keywords: ['remove', 'tab'], execute: () => window.devBrowser.tabs.close(context.activeTabId!) }] : []),
    ...context.workspaces.map((workspace) => ({
      id: `workspace:${workspace.id}`,
      label: `Switch Workspace: ${workspace.name}`,
      category: 'Workspaces' as const,
      keywords: ['project', workspace.name],
      execute: () => window.devBrowser.workspaces.select(workspace.id)
    })),
    ...(activeWorkspace?.environments ?? []).map((environment) => ({
      id: `environment:${environment.id}`,
      label: `Switch Environment: ${environment.name}`,
      category: 'Environments' as const,
      keywords: [environment.kind, environment.baseUrl],
      execute: () => window.devBrowser.environments.select(environment.id)
    })),
    ...(context.activeTabId ? [
      { id: 'reload', label: 'Reload', category: 'Browser' as const, keywords: ['refresh', 'page'], execute: () => window.devBrowser.navigation.reload() },
      { id: 'capture-screenshot', label: 'Capture Screenshot', category: 'Browser' as const, keywords: ['image', 'png', 'viewport'], execute: () => window.devBrowser.screenshots.capture() }
    ] : []),
    { id: 'toggle-dev-panel', label: 'Toggle Dev Panel', category: 'Developer Tools', keywords: ['tools', 'show', 'hide'], execute: context.toggleDevPanel },
    { id: 'open-network', label: 'Open Network', category: 'Developer Tools', keywords: ['requests', 'dev panel'], execute: () => context.openPanel('network') },
    { id: 'open-console', label: 'Open Console', category: 'Developer Tools', keywords: ['logs', 'dev panel'], execute: () => context.openPanel('console') },
    { id: 'open-settings', label: 'Open Settings', category: 'Application', keywords: ['preferences', 'configuration'], execute: context.openSettings }
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
