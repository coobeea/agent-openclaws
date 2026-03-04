import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { log } from '@main/utils/logger'

let db: Database.Database

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'openclaws.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'worker',
      status TEXT NOT NULL DEFAULT 'stopped',
      container_id TEXT,
      gateway_port INTEGER,
      workspace_path TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      parent_task_id INTEGER REFERENCES tasks(id),
      assigned_agent_id INTEGER REFERENCES agents(id),
      gitea_repo TEXT,
      gitea_issue_number INTEGER,
      gitea_pr_number INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  log.info(`Database initialized at ${dbPath}`)
}

export function getDb(): Database.Database {
  return db
}
