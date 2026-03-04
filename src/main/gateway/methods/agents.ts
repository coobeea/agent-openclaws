import type { MethodGroup } from '@shared/gateway-protocol'
import { agentManager } from '@main/services/agent-manager'

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
      String(p.role || 'worker'),
      String(p.description || '')
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
      const agent = await agentManager.startWorker(Number(p.id), Number(p.port || 7861))
      if (!agent) throw new Error('Cannot start agent')
      return agent
    },

    stop: async (p) => {
      const agent = await agentManager.stopWorker(Number(p.id))
      if (!agent) throw new Error('Cannot stop agent')
      return agent
    },

    restart: async (p) => {
      await agentManager.stopWorker(Number(p.id))
      const port = Number(p.port || 7861)
      return agentManager.startWorker(Number(p.id), port)
    },

    files: async (p) => {
      const agent = agentManager.get(Number(p.id))
      if (!agent) throw new Error('Agent not found')
      return { files: agentManager.listFiles(agent.name) }
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
    }
  }
}
