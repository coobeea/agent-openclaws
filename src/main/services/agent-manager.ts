import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { randomBytes } from 'crypto'
import { getDb } from './database'
import { dockerManager } from './docker-manager'
import { configStore } from './config-store'
import { getSoulMd, getAgentsMd, generateOpenClawJson } from '@main/templates/openclaw-config'
import { log } from '@main/utils/logger'

const WORKSPACES_ROOT = () => join(app.getPath('userData'), 'workspaces')

/**
 * Initialize an OpenClaw-compliant workspace for an agent.
 * Structure:
 *   workspaces/{name}/.openclaw/openclaw.json
 *   workspaces/{name}/workspace/SOUL.md
 *   workspaces/{name}/workspace/AGENTS.md
 */
function ensureWorkspace(name: string, role: 'master' | 'worker', opts?: { giteaRepo?: string }): string {
  const root = join(WORKSPACES_ROOT(), name)
  const configDir = join(root, '.openclaw')
  const workspaceDir = join(root, 'workspace')

  mkdirSync(configDir, { recursive: true })
  mkdirSync(workspaceDir, { recursive: true })

  const soulPath = join(workspaceDir, 'SOUL.md')
  if (!existsSync(soulPath)) {
    writeFileSync(soulPath, getSoulMd(role), 'utf-8')
  }

  const agentsPath = join(workspaceDir, 'AGENTS.md')
  if (!existsSync(agentsPath)) {
    writeFileSync(agentsPath, getAgentsMd(role), 'utf-8')
  }

  const token = configStore.get('openclaw.gatewayToken') || randomBytes(16).toString('hex')
  const configPath = join(configDir, 'openclaw.json')
  if (!existsSync(configPath)) {
    const openclawConfig = generateOpenClawJson({
      agentName: name,
      role,
      gatewayToken: token,
    })
    writeFileSync(configPath, JSON.stringify(openclawConfig, null, 2), 'utf-8')
  }

  return root
}

function nextGatewayPort(): number {
  const base = parseInt(configStore.get('openclaw.gatewayPortBase') || '18800', 10)
  const agents = getDb().prepare('SELECT gateway_port FROM agents WHERE gateway_port IS NOT NULL ORDER BY gateway_port DESC LIMIT 1').get() as { gateway_port: number } | undefined
  return agents ? agents.gateway_port + 1 : base
}

export const agentManager = {
  list(): any[] {
    return getDb().prepare('SELECT * FROM agents ORDER BY created_at DESC').all()
  },

  get(id: number): any {
    return getDb().prepare('SELECT * FROM agents WHERE id = ?').get(id)
  },

  create(name: string, role: 'master' | 'worker' = 'worker', description = '', giteaRepo = ''): any {
    if (role === 'master') {
      const existing = getDb().prepare("SELECT id FROM agents WHERE role = 'master' LIMIT 1").get()
      if (existing) throw new Error('只能有一个 Master 龙虾')
    }

    const ws = ensureWorkspace(name, role, { giteaRepo })
    const port = nextGatewayPort()
    const token = randomBytes(16).toString('hex')

    const info = getDb().prepare(
      'INSERT INTO agents (name, role, description, workspace_path, gateway_port, gateway_token, gitea_repo) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(name, role, description, ws, port, token, giteaRepo || null)
    return this.get(Number(info.lastInsertRowid))
  },

  delete(id: number): boolean {
    const agent = this.get(id)
    if (agent?.container_id) {
      dockerManager.removeContainer(agent.container_id, true).catch(() => {})
    }
    return getDb().prepare('DELETE FROM agents WHERE id = ?').run(id).changes > 0
  },

  update(id: number, data: Record<string, unknown>): any {
    const allowed = ['name', 'description', 'status', 'container_id', 'gateway_port', 'gateway_token', 'gitea_repo', 'health_ok']
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

  async startWorker(id: number): Promise<any> {
    const agent = this.get(id)
    if (!agent) throw new Error('Agent not found')

    const ws = ensureWorkspace(agent.name, agent.role as 'master' | 'worker')
    const port = agent.gateway_port || nextGatewayPort()
    const token = agent.gateway_token || randomBytes(16).toString('hex')

    try {
      const giteaUrl = configStore.get('gitea.url') || 'http://localhost:13000'
      const giteaToken = configStore.get('gitea.token') || ''

      const env: Record<string, string> = {
        OPENCLAW_GATEWAY_TOKEN: token,
        GITEA_URL: giteaUrl.replace('localhost', 'host.docker.internal'),
        GITEA_TOKEN: giteaToken,
      }

      const info = await dockerManager.createOpenClawContainer(agent.name, port, ws, env)
      await dockerManager.startContainer(info.fullId)
      return this.update(id, { status: 'running', container_id: info.fullId, gateway_port: port, gateway_token: token })
    } catch (err: any) {
      log.error(`Failed to start agent ${agent.name}:`, err.message)
      this.update(id, { status: 'error' })
      throw err
    }
  },

  async stopWorker(id: number): Promise<any> {
    const agent = this.get(id)
    if (!agent?.container_id) return null
    await dockerManager.stopContainer(agent.container_id)
    return this.update(id, { status: 'stopped', health_ok: 0 })
  },

  listFiles(name: string): string[] {
    const wsDir = join(WORKSPACES_ROOT(), name, 'workspace')
    if (!existsSync(wsDir)) {
      const legacyDir = join(WORKSPACES_ROOT(), name)
      if (!existsSync(legacyDir)) return []
      return readdirSync(legacyDir).filter(f => !f.startsWith('.'))
    }
    return readdirSync(wsDir).filter(f => !f.startsWith('.'))
  },

  readFile(name: string, filename: string): string | null {
    const wsDir = join(WORKSPACES_ROOT(), name, 'workspace')
    let fp = join(wsDir, filename)
    if (!existsSync(fp)) {
      fp = join(WORKSPACES_ROOT(), name, filename)
      if (!existsSync(fp)) return null
    }
    return readFileSync(fp, 'utf-8')
  },

  writeFile(name: string, filename: string, content: string): boolean {
    const wsDir = join(WORKSPACES_ROOT(), name, 'workspace')
    mkdirSync(wsDir, { recursive: true })
    writeFileSync(join(wsDir, filename), content, 'utf-8')
    return true
  },

  readOpenClawConfig(name: string): Record<string, unknown> | null {
    const fp = join(WORKSPACES_ROOT(), name, '.openclaw', 'openclaw.json')
    if (!existsSync(fp)) return null
    try { return JSON.parse(readFileSync(fp, 'utf-8')) } catch { return null }
  },

  writeOpenClawConfig(name: string, config: Record<string, unknown>): void {
    const dir = join(WORKSPACES_ROOT(), name, '.openclaw')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'openclaw.json'), JSON.stringify(config, null, 2), 'utf-8')
  },
}
