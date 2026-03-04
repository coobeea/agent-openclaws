import type { MethodGroup } from '@shared/gateway-protocol'
import { taskDispatcher } from '@main/services/task-dispatcher'

export const tasksMethods: MethodGroup = {
  namespace: 'tasks',
  methods: {
    list: async (p) => taskDispatcher.list(
      p.status as string | undefined,
      p.parent_id !== undefined ? Number(p.parent_id) : undefined
    ),

    get: async (p) => {
      const task = taskDispatcher.get(Number(p.id))
      if (!task) throw new Error('Task not found')
      return task
    },

    create: async (p) => taskDispatcher.create({
      title: String(p.title),
      description: p.description ? String(p.description) : undefined,
      priority: p.priority ? String(p.priority) : undefined,
      gitea_repo: p.gitea_repo ? String(p.gitea_repo) : undefined,
      parent_task_id: p.parent_task_id ? Number(p.parent_task_id) : undefined
    }),

    update: async (p) => {
      const { id, ...data } = p
      return taskDispatcher.update(Number(id), data)
    },

    delete: async (p) => {
      const ok = taskDispatcher.delete(Number(p.id))
      if (!ok) throw new Error('Task not found')
      return { ok: true }
    },

    syncGitea: async (p) => taskDispatcher.syncToGitea(Number(p.id)),

    decompose: async (p) => {
      const parent = taskDispatcher.decompose(
        String(p.requirement),
        String(p.gitea_repo),
        String(p.priority || 'medium')
      )
      return { parent_task: parent, message: 'Requirement received. Master agent will decompose it.' }
    }
  }
}
