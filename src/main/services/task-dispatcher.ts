import { JsonlCollection } from './jsonl-store'
import { giteaClient } from './gitea-client'
import { log } from '@main/utils/logger'

export interface Task {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  parent_task_id: number | null
  assigned_agent_id: number | null
  gitea_repo: string | null
  gitea_issue_number: number | null
  gitea_pr_number: number | null
  created_at: string
  updated_at: string
}

const tasks = new JsonlCollection<Task>('tasks.jsonl')

export const taskDispatcher = {
  list(status?: string, parentId?: number): Task[] {
    let items = tasks.all()
    if (status) items = items.filter((t) => t.status === status)
    if (parentId !== undefined) items = items.filter((t) => t.parent_task_id === parentId)
    return items.sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  get(id: number): Task | undefined {
    return tasks.get(id)
  },

  create(data: { title: string; description?: string; priority?: string; gitea_repo?: string; parent_task_id?: number }): Task {
    return tasks.insert({
      title: data.title,
      description: data.description || null,
      status: 'pending',
      priority: data.priority || 'medium',
      parent_task_id: data.parent_task_id || null,
      assigned_agent_id: null,
      gitea_repo: data.gitea_repo || null,
      gitea_issue_number: null,
      gitea_pr_number: null,
    } as Omit<Task, 'id'>)
  },

  update(id: number, data: Partial<Task>): Task | undefined {
    const allowed = ['title', 'description', 'status', 'priority', 'assigned_agent_id', 'gitea_issue_number', 'gitea_pr_number']
    const changes: Partial<Task> = {}
    for (const [k, v] of Object.entries(data)) {
      if (allowed.includes(k)) (changes as any)[k] = v
    }
    return tasks.update(id, changes)
  },

  delete(id: number): boolean {
    return tasks.delete(id)
  },

  async syncToGitea(id: number): Promise<Task | undefined> {
    const task = tasks.get(id)
    if (!task?.gitea_repo) throw new Error('Task has no gitea_repo')

    const [owner, repo] = task.gitea_repo.split('/')
    const body = `${task.description || ''}\n\n---\n_Auto-created by OpenClaws | Task #${task.id}_`
    const issue = await giteaClient.createIssue(owner, repo, { title: task.title, body })
    return tasks.update(id, { gitea_issue_number: issue.number, status: 'assigned' } as Partial<Task>)
  },

  decompose(requirement: string, giteaRepo: string, priority = 'medium'): Task {
    const parent = this.create({
      title: `[需求] ${requirement.substring(0, 80)}`,
      description: requirement,
      priority,
      gitea_repo: giteaRepo,
    })
    tasks.update(parent.id, { status: 'decomposing' } as Partial<Task>)
    return tasks.get(parent.id)!
  },
}
