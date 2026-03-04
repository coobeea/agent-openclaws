import { getDb } from './database'
import { giteaClient } from './gitea-client'
import { log } from '@main/utils/logger'

export const taskDispatcher = {
  list(status?: string, parentId?: number): any[] {
    let sql = 'SELECT * FROM tasks'
    const conditions: string[] = []
    const params: unknown[] = []

    if (status) { conditions.push('status = ?'); params.push(status) }
    if (parentId !== undefined) { conditions.push('parent_task_id = ?'); params.push(parentId) }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
    sql += ' ORDER BY created_at DESC'

    return getDb().prepare(sql).all(...params)
  },

  get(id: number): any {
    return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  },

  create(data: { title: string; description?: string; priority?: string; gitea_repo?: string; parent_task_id?: number }): any {
    const info = getDb().prepare(
      'INSERT INTO tasks (title, description, priority, gitea_repo, parent_task_id) VALUES (?, ?, ?, ?, ?)'
    ).run(data.title, data.description || null, data.priority || 'medium', data.gitea_repo || null, data.parent_task_id || null)
    return this.get(Number(info.lastInsertRowid))
  },

  update(id: number, data: Record<string, unknown>): any {
    const allowed = ['title', 'description', 'status', 'priority', 'assigned_agent_id', 'gitea_issue_number', 'gitea_pr_number']
    const sets: string[] = []
    const vals: unknown[] = []
    for (const [k, v] of Object.entries(data)) {
      if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v) }
    }
    if (sets.length === 0) return this.get(id)
    sets.push("updated_at = datetime('now')")
    vals.push(id)
    getDb().prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
    return this.get(id)
  },

  delete(id: number): boolean {
    return getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0
  },

  async syncToGitea(id: number): Promise<any> {
    const task = this.get(id)
    if (!task?.gitea_repo) throw new Error('Task has no gitea_repo')

    const [owner, repo] = task.gitea_repo.split('/')
    const body = `${task.description || ''}\n\n---\n_Auto-created by OpenClaws | Task #${task.id}_`
    const issue = await giteaClient.createIssue(owner, repo, { title: task.title, body })
    return this.update(id, { gitea_issue_number: issue.number, status: 'assigned' })
  },

  decompose(requirement: string, giteaRepo: string, priority = 'medium'): any {
    const parent = this.create({
      title: `[需求] ${requirement.substring(0, 80)}`,
      description: requirement,
      priority,
      gitea_repo: giteaRepo
    })
    this.update(parent.id, { status: 'decomposing' })
    return parent
  }
}
