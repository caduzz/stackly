import { app } from 'electron'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function openDatabase(): Database.Database {
  const directory = join(app.getPath('userData'), 'storage')
  mkdirSync(directory, { recursive: true })
  const database = new Database(join(directory, 'stackly.sqlite'))
  database.pragma('foreign_keys = ON')
  database.pragma('journal_mode = WAL')

  const version = database.pragma('user_version', { simple: true }) as number
  if (version > 1) throw new Error(`Unsupported database schema version: ${version}`)
  if (version === 0) {
    database.exec(`
      BEGIN;
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        session_partition TEXT NOT NULL UNIQUE,
        active_environment_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE environments (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('local', 'staging', 'production', 'custom'))
      );
      CREATE INDEX environments_workspace_id ON environments(workspace_id);
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version = 1;
      COMMIT;
    `)
  }
  return database
}
