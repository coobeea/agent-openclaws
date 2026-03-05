import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { randomBytes } from 'crypto'
import { JsonlCollection } from './jsonl-store'
import { dockerManager } from './docker-manager'
import { configStore } from './config-store'
import { getSoulMd, getAgentsMd, generateOpenClawJson } from '@main/templates/openclaw-config'
import { log } from '@main/utils/logger'
import { hubCore } from '@main/server/hubServer'

export interface Agent {
  id: number
  name: string
  role: 'master' | 'worker' | 'qa'
  status: string
  container_id: string | null
  gateway_port: number | null
  gateway_token: string | null
  workspace_path: string | null
  description: string
  gitea_repo: string | null
  model: string | null
  health_ok: boolean
  created_at: string
  updated_at: string
  // 飞书配置（可选）
  feishu_enabled?: boolean
  feishu_app_id?: string
  feishu_app_secret?: string
}

const agents = new JsonlCollection<Agent>('agents.jsonl')

const WORKSPACES_ROOT = () => {
  const custom = configStore.get('openclaw.workspaceBase')
  return custom ? custom : join(app.getPath('userData'), 'workspaces')
}

function ensureWorkspace(
  name: string, 
  role: 'master' | 'worker' | 'qa', 
  model?: string, 
  token?: string, 
  lobbies?: string[],
  feishuConfig?: any
): string {
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

  const resolvedToken = token || configStore.get('openclaw.gatewayToken') || randomBytes(16).toString('hex')
  const configPath = join(configDir, 'openclaw.json')
  
  // 总是覆盖或者如果不存在则创建，保证配置（如模型、token）是最新的
  const cfg = generateOpenClawJson({ 
    agentName: name, 
    role, 
    gatewayToken: resolvedToken, 
    model,
    lobbies,
    feishuConfig
  })
  writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8')

  return root
}

function nextGatewayPort(): number {
  const base = parseInt(configStore.get('openclaw.gatewayPortBase') || '18800', 10)
  const all = agents.all()
  if (all.length === 0) return base
  const maxPort = all.reduce((m, a) => Math.max(m, a.gateway_port || 0), 0)
  return maxPort >= base ? maxPort + 1 : base
}

export const agentManager = {
  list(): Agent[] {
    return agents.all().sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  get(id: number): Agent | undefined {
    return agents.get(id)
  },

  create(
    name: string, 
    role: 'master' | 'worker' | 'qa' = 'worker', 
    description = '', 
    giteaRepo = '', 
    model?: string,
    feishuConfig?: {
      feishu_enabled?: boolean
      feishu_app_id?: string
      feishu_app_secret?: string
    }
  ): Agent {
    if (!giteaRepo) throw new Error('必须关联一个 Gitea 仓库')
    
    if (role === 'master') {
      const existing = agents.find((a) => a.role === 'master' && a.gitea_repo === giteaRepo)
      if (existing.length > 0) throw new Error(`仓库 ${giteaRepo} 已经有一个 Master 龙虾了`)
    }

    const dup = agents.find((a) => a.name === name)
    if (dup.length > 0) throw new Error(`名称 "${name}" 已存在`)

    const port = nextGatewayPort()
    const token = randomBytes(16).toString('hex')
    const ws = ensureWorkspace(name, role, model, token, undefined, feishuConfig)

    return agents.insert({
      name,
      role,
      status: 'stopped',
      container_id: null,
      gateway_port: port,
      gateway_token: token,
      workspace_path: ws,
      description,
      gitea_repo: giteaRepo || null,
      model: model || null,
      health_ok: false,
      feishu_enabled: feishuConfig?.feishu_enabled,
      feishu_app_id: feishuConfig?.feishu_app_id,
      feishu_app_secret: feishuConfig?.feishu_app_secret,
    } as Omit<Agent, 'id'>)
  },

  delete(id: number): boolean {
    const agent = agents.get(id)
    if (agent?.container_id) {
      dockerManager.removeContainer(agent.container_id, true).catch(() => {})
    }
    return agents.delete(id)
  },

  update(id: number, data: Partial<Agent>): Agent | undefined {
    return agents.update(id, data)
  },

  async startWorker(id: number): Promise<Agent> {
    const agent = agents.get(id)
    if (!agent) throw new Error('Agent not found')

    // 查询该 agent 所属的 lobbies
    const allLobbies = hubCore.listLobbies()
    const agentLobbies = allLobbies
      .filter(l => l.members.includes(agent.id.toString()))
      .map(l => l.id.toString())

    log.info(`[AgentManager] Agent ${agent.name} is member of lobbies: ${agentLobbies.join(', ')}`)

    const port = agent.gateway_port || nextGatewayPort()
    const token = agent.gateway_token || randomBytes(16).toString('hex')
    
    const feishuConfig = agent.feishu_enabled ? {
      feishu_enabled: agent.feishu_enabled,
      feishu_app_id: agent.feishu_app_id,
      feishu_app_secret: agent.feishu_app_secret
    } : undefined
    
    const ws = ensureWorkspace(
      agent.name, 
      agent.role, 
      agent.model || undefined, 
      token,
      agentLobbies,
      feishuConfig
    )

    try {
      const giteaUrl = configStore.get('gitea.url') || 'http://localhost:13000'
      const giteaToken = configStore.get('gitea.token') || ''

      const env: Record<string, string> = {
        OPENCLAW_GATEWAY_TOKEN: token,
        GITEA_URL: giteaUrl.replace('localhost', 'host.docker.internal'),
        GITEA_TOKEN: giteaToken,
        AGENT_NAME: agent.name,
        AGENT_ID: agent.id.toString(),
        LOBSTER_HUB_URL: 'http://host.docker.internal:8765/api/hub/messages',
      }

      const info = await dockerManager.createOpenClawContainer(agent.name, port, ws, env)
      await dockerManager.startContainer(info.fullId)
      return agents.update(id, { status: 'running', container_id: info.fullId, gateway_port: port, gateway_token: token })!
    } catch (err: any) {
      log.error(`Failed to start agent ${agent.name}:`, err.message)
      agents.update(id, { status: 'error' })
      throw err
    }
  },

  async stopWorker(id: number): Promise<Agent | undefined> {
    const agent = agents.get(id)
    if (!agent?.container_id) return undefined
    await dockerManager.stopContainer(agent.container_id)
    return agents.update(id, { status: 'stopped', health_ok: false })
  },

  listFiles(name: string): string[] {
    const wsDir = join(WORKSPACES_ROOT(), name, 'workspace')
    if (!existsSync(wsDir)) return []
    return readdirSync(wsDir).filter((f) => !f.startsWith('.'))
  },

  readFile(name: string, filename: string): string | null {
    const fp = join(WORKSPACES_ROOT(), name, 'workspace', filename)
    if (!existsSync(fp)) return null
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
