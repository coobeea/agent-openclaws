import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getDb } from './database'
import { dockerManager } from './docker-manager'
import { log } from '@main/utils/logger'

const WORKSPACES_ROOT = () => join(app.getPath('userData'), 'workspaces')

const DEFAULT_SOUL = `# Worker Agent

You are a development worker in the OpenClaws lobster army.
Your job is to pick up assigned Gitea issues, implement the required changes,
write tests, and submit pull requests.

## Workflow
1. Check Gitea for assigned issues
2. Read the issue description and acceptance criteria
3. Create a feature branch
4. Implement the changes
5. Run tests to verify
6. Submit a PR linking to the issue
`

function ensureWorkspace(name: string): string {
  const ws = join(WORKSPACES_ROOT(), name)
  mkdirSync(ws, { recursive: true })
  const soul = join(ws, 'SOUL.md')
  if (!existsSync(soul)) writeFileSync(soul, DEFAULT_SOUL, 'utf-8')
  return ws
}

export const agentManager = {
  list(): any[] {
    return getDb().prepare('SELECT * FROM agents ORDER BY created_at DESC').all()
  },

  get(id: number): any {
    return getDb().prepare('SELECT * FROM agents WHERE id = ?').get(id)
  },

  create(name: string, role = 'worker', description = ''): any {
    const ws = ensureWorkspace(name)
    const info = getDb().prepare(
      'INSERT INTO agents (name, role, description, workspace_path) VALUES (?, ?, ?, ?)'
    ).run(name, role, description, ws)
    return this.get(Number(info.lastInsertRowid))
  },

  delete(id: number): boolean {
    const r = getDb().prepare('DELETE FROM agents WHERE id = ?').run(id)
    return r.changes > 0
  },

  update(id: number, data: Record<string, unknown>): any {
    const allowed = ['name', 'description', 'status', 'container_id', 'gateway_port']
    const sets: string[] = []
    const vals: unknown[] = []
    for (const [k, v] of Object.entries(data)) {
      if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v) }
    }
    if (sets.length === 0) return this.get(id)
    sets.push("updated_at = datetime('now')")
    vals.push(id)
    getDb().prepare(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
    return this.get(id)
  },

  async startWorker(id: number, gatewayPort: number): Promise<any> {
    const agent = this.get(id)
    if (!agent || agent.role !== 'worker') return null
    const ws = ensureWorkspace(agent.name)
    try {
      const info = await dockerManager.createWorker(agent.name, gatewayPort, ws)
      await dockerManager.startContainer(info.fullId)
      return this.update(id, { status: 'running', container_id: info.fullId, gateway_port: gatewayPort })
    } catch (err: any) {
      this.update(id, { status: 'error' })
      throw err
    }
  },

  async stopWorker(id: number): Promise<any> {
    const agent = this.get(id)
    if (!agent?.container_id) return null
    await dockerManager.stopContainer(agent.container_id)
    return this.update(id, { status: 'stopped' })
  },

  listFiles(name: string): string[] {
    const ws = join(WORKSPACES_ROOT(), name)
    if (!existsSync(ws)) return []
    return readdirSync(ws).filter(f => !f.startsWith('.'))
  },

  readFile(name: string, filename: string): string | null {
    const fp = join(WORKSPACES_ROOT(), name, filename)
    if (!existsSync(fp)) return null
    return readFileSync(fp, 'utf-8')
  },

  writeFile(name: string, filename: string, content: string): boolean {
    const ws = join(WORKSPACES_ROOT(), name)
    mkdirSync(ws, { recursive: true })
    writeFileSync(join(ws, filename), content, 'utf-8')
    return true
  }
}
