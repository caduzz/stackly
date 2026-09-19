import type Database from 'better-sqlite3'
import { environmentSchema, workspaceSchema, type Environment, type Workspace } from '../../shared/contracts/browser'

type WorkspaceRow = { id: string; name: string; session_partition: string; active_environment_id: string | null; created_at: string }
type EnvironmentRow = { id: string; workspace_id: string; name: string; base_url: string; kind: string }

export class WorkspaceRepository {
  constructor(private readonly database: Database.Database) {}

  list(): Workspace[] {
    const workspaces = this.database.prepare('SELECT * FROM workspaces ORDER BY created_at, rowid').all() as WorkspaceRow[]
    const environments = this.database.prepare('SELECT * FROM environments ORDER BY rowid').all() as EnvironmentRow[]
    return workspaces.map((row) => workspaceSchema.parse({
      id: row.id,
      name: row.name,
      sessionPartition: row.session_partition,
      activeEnvironmentId: row.active_environment_id,
      createdAt: row.created_at,
      environments: environments.filter((item) => item.workspace_id === row.id).map((item) => environmentSchema.parse({
        id: item.id, name: item.name, baseUrl: item.base_url, kind: item.kind
      }))
    }))
  }

  create(workspace: Workspace): void {
    const data = workspaceSchema.parse(workspace)
    this.database.transaction(() => {
      this.database.prepare('INSERT INTO workspaces (id, name, session_partition, active_environment_id, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(data.id, data.name, data.sessionPartition, data.activeEnvironmentId, data.createdAt)
      for (const environment of data.environments) this.insertEnvironment(data.id, environment)
    })()
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

  updateEnvironment(environment: Environment): void {
    const data = environmentSchema.parse(environment)
    this.database.prepare('UPDATE environments SET name = ?, base_url = ?, kind = ? WHERE id = ?')
      .run(data.name, data.baseUrl, data.kind, data.id)
  }

  deleteEnvironment(workspaceId: string, environmentId: string): void {
    this.database.transaction(() => {
      this.database.prepare('UPDATE workspaces SET active_environment_id = NULL WHERE id = ? AND active_environment_id = ?').run(workspaceId, environmentId)
      this.database.prepare('DELETE FROM environments WHERE id = ? AND workspace_id = ?').run(environmentId, workspaceId)
    })()
  }

  private insertEnvironment(workspaceId: string, environment: Environment): void {
    this.database.prepare('INSERT INTO environments (id, workspace_id, name, base_url, kind) VALUES (?, ?, ?, ?, ?)')
      .run(environment.id, workspaceId, environment.name, environment.baseUrl, environment.kind)
  }

  setActiveEnvironment(workspaceId: string, environmentId: string): void {
    this.database.prepare('UPDATE workspaces SET active_environment_id = ? WHERE id = ?').run(environmentId, workspaceId)
  }
}
