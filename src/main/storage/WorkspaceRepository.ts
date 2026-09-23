import { devicesCanvasLayoutSchema, environmentSchema, navigateSchema, navigationHistoryEntrySchema, navigationHistoryVisitSchema, persistedTabSchema, workspaceSchema, type DevicesCanvasLayout, type Environment, type NavigationHistoryEntry, type NavigationHistoryVisit, type PersistedTab, type Workspace } from '../../shared/contracts/browser'
import { runTransaction, type StacklyDatabase } from './database'

type WorkspaceRow = { id: string; name: string; session_partition: string; active_environment_id: string | null; repository_path: string | null; created_at: string }
type EnvironmentRow = { id: string; workspace_id: string; name: string; base_url: string; kind: string }
type TabRow = { id: string; workspace_id: string; url: string; kind: string; active: number; position: number }
type DevicesCanvasLayoutRow = { layout_json: string }
type HistoryRow = { id: string; workspace_id: string; url: string; title: string; favicon: string | null; visited_at: string }

export class WorkspaceRepository {
  constructor(private readonly database: StacklyDatabase) {}

  list(): Workspace[] {
    const workspaces = this.database.prepare('SELECT * FROM workspaces ORDER BY created_at, rowid').all() as WorkspaceRow[]
    const environments = this.database.prepare('SELECT * FROM environments ORDER BY rowid').all() as EnvironmentRow[]
    return workspaces.map((row) => workspaceSchema.parse({
      id: row.id,
      name: row.name,
      sessionPartition: row.session_partition,
      activeEnvironmentId: row.active_environment_id,
      repositoryPath: row.repository_path,
      createdAt: row.created_at,
      environments: environments.filter((item) => item.workspace_id === row.id).map((item) => environmentSchema.parse({
        id: item.id, name: item.name, baseUrl: item.base_url, kind: item.kind
      }))
    }))
  }

  create(workspace: Workspace): void {
    const data = workspaceSchema.parse(workspace)
    runTransaction(this.database, () => {
      this.database.prepare('INSERT INTO workspaces (id, name, session_partition, active_environment_id, repository_path, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(data.id, data.name, data.sessionPartition, data.activeEnvironmentId, data.repositoryPath, data.createdAt)
      for (const environment of data.environments) this.insertEnvironment(data.id, environment)
    })
  }

  addEnvironment(workspaceId: string, environment: Environment): void {
    this.insertEnvironment(workspaceId, environmentSchema.parse(environment))
  }

  renameWorkspace(id: string, name: string): void {
    this.database.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(name, id)
  }

  deleteWorkspace(id: string): void {
    this.database.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
  }

  setRepositoryPath(workspaceId: string, repositoryPath: string): void {
    this.database.prepare('UPDATE workspaces SET repository_path = ? WHERE id = ?').run(repositoryPath, workspaceId)
  }

  updateEnvironment(environment: Environment): void {
    const data = environmentSchema.parse(environment)
    this.database.prepare('UPDATE environments SET name = ?, base_url = ?, kind = ? WHERE id = ?')
      .run(data.name, data.baseUrl, data.kind, data.id)
  }

  deleteEnvironment(workspaceId: string, environmentId: string): void {
    runTransaction(this.database, () => {
      this.database.prepare('UPDATE workspaces SET active_environment_id = NULL WHERE id = ? AND active_environment_id = ?').run(workspaceId, environmentId)
      this.database.prepare('DELETE FROM environments WHERE id = ? AND workspace_id = ?').run(environmentId, workspaceId)
    })
  }

  private insertEnvironment(workspaceId: string, environment: Environment): void {
    this.database.prepare('INSERT INTO environments (id, workspace_id, name, base_url, kind) VALUES (?, ?, ?, ?, ?)')
      .run(environment.id, workspaceId, environment.name, environment.baseUrl, environment.kind)
  }

  setActiveEnvironment(workspaceId: string, environmentId: string): void {
    this.database.prepare('UPDATE workspaces SET active_environment_id = ? WHERE id = ?').run(environmentId, workspaceId)
  }

  listTabs(workspaceId: string): PersistedTab[] {
    const rows = this.database.prepare('SELECT * FROM tabs WHERE workspace_id = ? ORDER BY position, rowid').all(workspaceId) as TabRow[]
    return rows.map((row) => persistedTabSchema.parse({ id: row.id, url: row.url, kind: row.kind, active: row.active === 1 }))
  }

  saveTabs(workspaceId: string, tabs: PersistedTab[]): void {
    const data = tabs.map((tab) => persistedTabSchema.parse(tab))
    runTransaction(this.database, () => {
      this.database.prepare('DELETE FROM tabs WHERE workspace_id = ?').run(workspaceId)
      const insert = this.database.prepare('INSERT INTO tabs (id, workspace_id, url, kind, active, position) VALUES (?, ?, ?, ?, ?, ?)')
      data.forEach((tab, index) => insert.run(tab.id, workspaceId, tab.url, tab.kind, tab.active ? 1 : 0, index))
    })
  }

  getDevicesCanvasLayout(workspaceId: string, tabId: string): DevicesCanvasLayout | null {
    const row = this.database.prepare('SELECT layout_json FROM device_canvas_layouts WHERE workspace_id = ? AND tab_id = ?').get(workspaceId, tabId) as DevicesCanvasLayoutRow | undefined
    if (!row) return null
    return devicesCanvasLayoutSchema.parse(JSON.parse(row.layout_json))
  }

  saveDevicesCanvasLayout(workspaceId: string, tabId: string, layout: DevicesCanvasLayout): void {
    const data = devicesCanvasLayoutSchema.parse(layout)
    this.database.prepare('INSERT INTO device_canvas_layouts (workspace_id, tab_id, layout_json) VALUES (?, ?, ?) ON CONFLICT(workspace_id, tab_id) DO UPDATE SET layout_json = excluded.layout_json')
      .run(workspaceId, tabId, JSON.stringify(data))
  }

  listHistory(workspaceId: string, query = ''): NavigationHistoryEntry[] {
    const term = query.trim()
    const rows = term
      ? this.database.prepare("SELECT * FROM navigation_history WHERE workspace_id = ? AND (LOWER(title) LIKE LOWER(?) OR LOWER(url) LIKE LOWER(?)) ORDER BY visited_at DESC, rowid DESC LIMIT 500")
        .all(workspaceId, `%${term}%`, `%${term}%`) as HistoryRow[]
      : this.database.prepare('SELECT * FROM navigation_history WHERE workspace_id = ? ORDER BY visited_at DESC, rowid DESC LIMIT 500')
        .all(workspaceId) as HistoryRow[]
    return rows.map((row) => navigationHistoryEntrySchema.parse({
      id: row.id,
      workspaceId: row.workspace_id,
      url: row.url,
      title: row.title,
      favicon: row.favicon ?? undefined,
      visitedAt: row.visited_at
    }))
  }

  recordHistory(workspaceId: string, visit: NavigationHistoryVisit): void {
    const data = navigationHistoryVisitSchema.parse(visit)
    const url = navigateSchema.parse(data.url)
    const title = (data.title?.trim() || new URL(url).hostname).slice(0, 300)
    const favicon = data.favicon?.trim() || null
    const visitedAt = new Date().toISOString()
    const last = this.database.prepare('SELECT * FROM navigation_history WHERE workspace_id = ? ORDER BY visited_at DESC, rowid DESC LIMIT 1').get(workspaceId) as HistoryRow | undefined
    if (last?.url === url) {
      this.database.prepare('UPDATE navigation_history SET title = ?, favicon = COALESCE(?, favicon), visited_at = ? WHERE id = ? AND workspace_id = ?')
        .run(title, favicon, visitedAt, last.id, workspaceId)
      return
    }
    this.database.prepare('INSERT INTO navigation_history (id, workspace_id, url, title, favicon, visited_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), workspaceId, url, title, favicon, visitedAt)
  }

  deleteHistoryEntry(workspaceId: string, id: string): void {
    this.database.prepare('DELETE FROM navigation_history WHERE workspace_id = ? AND id = ?').run(workspaceId, id)
  }

  clearHistory(workspaceId: string): void {
    this.database.prepare('DELETE FROM navigation_history WHERE workspace_id = ?').run(workspaceId)
  }
}
