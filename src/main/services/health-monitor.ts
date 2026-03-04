import { agentManager } from './agent-manager'
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
  const all = agentManager.list()
  const withContainers = all.filter((a) => a.container_id)
  if (withContainers.length === 0) return

  let changed = false

  for (const agent of withContainers) {
    try {
      const state = await dockerManager.getContainerState(agent.container_id!)
      if (!state) {
        if (agent.status !== 'stopped' && agent.status !== 'error') {
          agentManager.update(agent.id, { status: 'error', health_ok: false })
          changed = true
        }
        continue
      }

      const newStatus = state.running ? 'running' : 'stopped'
      const healthOk = state.health === 'healthy'

      if (newStatus !== agent.status || healthOk !== agent.health_ok) {
        agentManager.update(agent.id, { status: newStatus, health_ok: healthOk })
        changed = true
      }
    } catch {
      if (agent.status === 'running') {
        agentManager.update(agent.id, { status: 'error', health_ok: false })
        changed = true
      }
    }
  }

  if (changed) {
    try {
      getGateway().broadcastEvent('agents.updated', agentManager.list())
    } catch { /* gateway might not be ready */ }
  }
}
