import type { MethodGroup } from '@shared/gateway-protocol'
import { agentManager } from '@main/services/agent-manager'
import { dockerManager } from '@main/services/docker-manager'

export const agentsMethods: MethodGroup = {
  namespace: 'agents',
  methods: {
    list: async () => agentManager.list(),

    get: async (p) => {
      const agent = agentManager.get(Number(p.id))
      if (!agent) throw new Error('Agent not found')
      return agent
    },

    create: async (p) => agentManager.create(
      String(p.name),
      (p.role as 'master' | 'worker') || 'worker',
      String(p.description || ''),
      String(p.gitea_repo || '')
    ),

    delete: async (p) => {
      const ok = agentManager.delete(Number(p.id))
      if (!ok) throw new Error('Agent not found')
      return { ok: true }
    },

    update: async (p) => {
      const { id, ...data } = p
      return agentManager.update(Number(id), data)
    },

    start: async (p) => {
      const agent = await agentManager.startWorker(Number(p.id))
      if (!agent) throw new Error('Cannot start agent')
      return agent
    },

    stop: async (p) => {
      const agent = await agentManager.stopWorker(Number(p.id))
      if (!agent) throw new Error('Cannot stop agent')
      return agent
    },

    restart: async (p) => {
      const id = Number(p.id)
      const agent = agentManager.get(id)
      if (agent?.container_id) {
        await dockerManager.restartContainer(agent.container_id)
        return agentManager.update(id, { status: 'running' })
      }
      await agentManager.stopWorker(id)
      return agentManager.startWorker(id)
    },

    logs: async (p) => {
      const agent = agentManager.get(Number(p.id))
      if (!agent?.container_id) throw new Error('Agent has no container')
      const logs = await dockerManager.getContainerLogs(agent.container_id, Number(p.tail || 200))
      return { logs }
    },

    files: async (p) => {
      const agent = agentManager.get(Number(p.id))
      if (!agent) throw new Error('Agent not found')
      return agentManager.listFiles(agent.name)
    },

    readFile: async (p) => {
      const agent = agentManager.get(Number(p.id))
      if (!agent) throw new Error('Agent not found')
      const content = agentManager.readFile(agent.name, String(p.filename))
      if (content === null) throw new Error('File not found')
      return { filename: p.filename, content }
    },

    writeFile: async (p) => {
      const agent = agentManager.get(Number(p.id))
      if (!agent) throw new Error('Agent not found')
      agentManager.writeFile(agent.name, String(p.filename), String(p.content))
      return { ok: true }
    },

    openclawConfig: async (p) => {
      const agent = agentManager.get(Number(p.id))
      if (!agent) throw new Error('Agent not found')
      return agentManager.readOpenClawConfig(agent.name)
    },

    saveOpenclawConfig: async (p) => {
      const agent = agentManager.get(Number(p.id))
      if (!agent) throw new Error('Agent not found')
      agentManager.writeOpenClawConfig(agent.name, p.config as Record<string, unknown>)
      return { ok: true }
    },
  },
}
