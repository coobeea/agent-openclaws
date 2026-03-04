import { getDb } from './database'
import { dockerManager } from './docker-manager'
import { getGateway } from '@main/gateway/Gateway'
import { log } from '@main/utils/logger'

const POLL_INTERVAL = 10_000

let timer: NodeJS.Timeout | null = null

export function startHealthMonitor(): void {
  if (timer) return
  timer = setInterval(pollAll, POLL_INTERVAL)
  log.info('Health monitor started')
}

export function stopHealthMonitor(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function pollAll(): Promise<void> {
  const agents = getDb()
    .prepare("SELECT id, name, container_id, gateway_port, status FROM agents WHERE container_id IS NOT NULL")
    .all() as { id: number; name: string; container_id: string; gateway_port: number; status: string }[]

  let changed = false

  for (const agent of agents) {
    try {
      const state = await dockerManager.getContainerState(agent.container_id)

      if (!state) {
        if (agent.status !== 'stopped' && agent.status !== 'error') {
          getDb().prepare("UPDATE agents SET status = 'error', health_ok = 0, updated_at = datetime('now') WHERE id = ?").run(agent.id)
          changed = true
        }
        continue
      }

      const newStatus = state.running ? 'running' : 'stopped'
      const healthOk = state.health === 'healthy' ? 1 : 0

      if (newStatus !== agent.status || healthOk !== (agent as any).health_ok) {
        getDb().prepare("UPDATE agents SET status = ?, health_ok = ?, updated_at = datetime('now') WHERE id = ?")
          .run(newStatus, healthOk, agent.id)
        changed = true
      }
    } catch {
      // container inspect failed, likely removed externally
      if (agent.status === 'running') {
        getDb().prepare("UPDATE agents SET status = 'error', health_ok = 0, updated_at = datetime('now') WHERE id = ?").run(agent.id)
        changed = true
      }
    }
  }

  if (changed) {
    try {
      const allAgents = getDb().prepare('SELECT * FROM agents ORDER BY created_at DESC').all()
      getGateway().broadcastEvent('agents.updated', allAgents)
    } catch {
      // gateway might not be ready
    }
  }
}
