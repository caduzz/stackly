import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type StacklyDatabase = DatabaseSync

export function runTransaction(database: StacklyDatabase, operation: () => void): void {
  database.exec('BEGIN')
  try {
    operation()
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export function openDatabase(): StacklyDatabase {
  const directory = join(app.getPath('userData'), 'storage')
  mkdirSync(directory, { recursive: true })
  const database = new DatabaseSync(join(directory, 'stackly.sqlite'))
  database.exec('PRAGMA foreign_keys = ON')
  database.exec('PRAGMA journal_mode = WAL')

  const versionRow = database.prepare('PRAGMA user_version').get() as { user_version: number }
  const version = versionRow.user_version
  if (version > 8) throw new Error(`Unsupported database schema version: ${version}`)
  if (version === 0) {
    database.exec(`
      BEGIN;
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        session_partition TEXT NOT NULL UNIQUE,
        active_environment_id TEXT,
        repository_path TEXT,
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
      CREATE TABLE tabs (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'normal',
        active INTEGER NOT NULL CHECK (active IN (0, 1)),
        position INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, id)
      );
      CREATE INDEX tabs_workspace_id ON tabs(workspace_id, position);
      CREATE TABLE device_canvas_layouts (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        tab_id TEXT NOT NULL,
        layout_json TEXT NOT NULL,
        PRIMARY KEY (workspace_id, tab_id)
      );
      CREATE TABLE navigation_history (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        favicon TEXT,
        visited_at TEXT NOT NULL
      );
      CREATE INDEX navigation_history_workspace_date ON navigation_history(workspace_id, visited_at DESC);
      CREATE INDEX navigation_history_workspace_url ON navigation_history(workspace_id, url);
      PRAGMA user_version = 8;
      COMMIT;
    `)
  } else if (version === 1) {
    database.exec(`
      BEGIN;
      ALTER TABLE workspaces ADD COLUMN repository_path TEXT;
      CREATE TABLE tabs (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'normal',
        active INTEGER NOT NULL CHECK (active IN (0, 1)),
        position INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, id)
      );
      CREATE INDEX tabs_workspace_id ON tabs(workspace_id, position);
      CREATE TABLE device_canvas_layouts (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        tab_id TEXT NOT NULL,
        layout_json TEXT NOT NULL,
        PRIMARY KEY (workspace_id, tab_id)
      );
      CREATE TABLE navigation_history (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        favicon TEXT,
        visited_at TEXT NOT NULL
      );
      CREATE INDEX navigation_history_workspace_date ON navigation_history(workspace_id, visited_at DESC);
      CREATE INDEX navigation_history_workspace_url ON navigation_history(workspace_id, url);
      PRAGMA user_version = 8;
      COMMIT;
    `)
  } else if (version === 2) {
    database.exec(`
      BEGIN;
      CREATE TABLE tabs (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'normal',
        active INTEGER NOT NULL CHECK (active IN (0, 1)),
        position INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, id)
      );
      CREATE INDEX tabs_workspace_id ON tabs(workspace_id, position);
      CREATE TABLE device_canvas_layouts (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        tab_id TEXT NOT NULL,
        layout_json TEXT NOT NULL,
        PRIMARY KEY (workspace_id, tab_id)
      );
      CREATE TABLE navigation_history (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        favicon TEXT,
        visited_at TEXT NOT NULL
      );
      CREATE INDEX navigation_history_workspace_date ON navigation_history(workspace_id, visited_at DESC);
      CREATE INDEX navigation_history_workspace_url ON navigation_history(workspace_id, url);
      PRAGMA user_version = 8;
      COMMIT;
    `)
  } else if (version === 3) {
    database.exec(`
      BEGIN;
      CREATE TABLE tabs_next (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'normal',
        active INTEGER NOT NULL CHECK (active IN (0, 1)),
        position INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, id)
      );
      INSERT INTO tabs_next (id, workspace_id, url, active, position)
        SELECT id, workspace_id, url, active, position FROM tabs;
      DROP TABLE tabs;
      ALTER TABLE tabs_next RENAME TO tabs;
      CREATE INDEX tabs_workspace_id ON tabs(workspace_id, position);
      CREATE TABLE device_canvas_layouts (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        tab_id TEXT NOT NULL,
        layout_json TEXT NOT NULL,
        PRIMARY KEY (workspace_id, tab_id)
      );
      CREATE TABLE navigation_history (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        favicon TEXT,
        visited_at TEXT NOT NULL
      );
      CREATE INDEX navigation_history_workspace_date ON navigation_history(workspace_id, visited_at DESC);
      CREATE INDEX navigation_history_workspace_url ON navigation_history(workspace_id, url);
      PRAGMA user_version = 8;
      COMMIT;
    `)
  } else if (version === 4) {
    database.exec(`
      BEGIN;
      CREATE TABLE device_canvas_layouts (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        tab_id TEXT NOT NULL,
        layout_json TEXT NOT NULL,
        PRIMARY KEY (workspace_id, tab_id)
      );
      CREATE TABLE navigation_history (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        favicon TEXT,
        visited_at TEXT NOT NULL
      );
      CREATE INDEX navigation_history_workspace_date ON navigation_history(workspace_id, visited_at DESC);
      CREATE INDEX navigation_history_workspace_url ON navigation_history(workspace_id, url);
      PRAGMA user_version = 8;
      COMMIT;
    `)
  } else if (version === 5) {
    database.exec(`
      BEGIN;
      CREATE TABLE device_canvas_layouts_next (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        tab_id TEXT NOT NULL,
        layout_json TEXT NOT NULL,
        PRIMARY KEY (workspace_id, tab_id)
      );
      INSERT INTO device_canvas_layouts_next (workspace_id, tab_id, layout_json)
        SELECT layouts.workspace_id, tabs.id, layouts.layout_json
          FROM device_canvas_layouts layouts
          JOIN tabs ON tabs.workspace_id = layouts.workspace_id
         WHERE tabs.rowid = (
           SELECT preferred.rowid
             FROM tabs preferred
            WHERE preferred.workspace_id = layouts.workspace_id
            ORDER BY preferred.active DESC, preferred.position ASC, preferred.rowid ASC
            LIMIT 1
         );
      DROP TABLE device_canvas_layouts;
      ALTER TABLE device_canvas_layouts_next RENAME TO device_canvas_layouts;
      CREATE TABLE navigation_history (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        favicon TEXT,
        visited_at TEXT NOT NULL
      );
      CREATE INDEX navigation_history_workspace_date ON navigation_history(workspace_id, visited_at DESC);
      CREATE INDEX navigation_history_workspace_url ON navigation_history(workspace_id, url);
      PRAGMA user_version = 8;
      COMMIT;
    `)
  } else if (version === 6) {
    database.exec(`
      BEGIN;
      CREATE TABLE navigation_history (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        favicon TEXT,
        visited_at TEXT NOT NULL
      );
      CREATE INDEX navigation_history_workspace_date ON navigation_history(workspace_id, visited_at DESC);
      CREATE INDEX navigation_history_workspace_url ON navigation_history(workspace_id, url);
      PRAGMA user_version = 8;
      COMMIT;
    `)
  }
  if (version >= 4 && version <= 7) {
    database.exec(`
      BEGIN;
      ALTER TABLE tabs ADD COLUMN kind TEXT NOT NULL DEFAULT 'normal';
      PRAGMA user_version = 8;
      COMMIT;
    `)
  }
  return database
}
