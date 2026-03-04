import { getDb } from './database'
import { log } from '@main/utils/logger'

const DEFAULTS: Record<string, string> = {
  'gitea.url': 'http://localhost:13000',
  'gitea.token': '',
  'docker.workerImage': 'openclaw:local',
  'docker.maxWorkers': '10',
  'docker.network': 'openclaws-net',
  'openclaw.sourcePath': '',
  'openclaw.defaultModel': 'sonnet',
  'openclaw.gatewayPortBase': '18800',
  'openclaw.gatewayToken': '',
}

export const configStore = {
  get(key: string): string {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? DEFAULTS[key] ?? ''
  },

  getAll(): Record<string, string> {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string
    }[]
    const result = { ...DEFAULTS }
    for (const row of rows) {
      result[row.key] = row.value
    }
    return result
  },

  set(key: string, value: string): void {
    getDb()
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(key, value)
    log.info(`Config updated: ${key}`)
  },

  setBatch(entries: Record<string, string>): void {
    const stmt = getDb().prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    const tx = getDb().transaction(() => {
      for (const [k, v] of Object.entries(entries)) {
        stmt.run(k, v)
      }
    })
    tx()
    log.info(`Config batch updated: ${Object.keys(entries).join(', ')}`)
  },

  delete(key: string): void {
    getDb().prepare('DELETE FROM settings WHERE key = ?').run(key)
  },
}
