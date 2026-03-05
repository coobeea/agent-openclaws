import { getGatewayClient } from '@/services/GatewayClient'

function gw() { return getGatewayClient() }

export const agentsApi = {
  list: () => gw().request('agents.list'),
  get: (id: number) => gw().request('agents.get', { id }),
  create: (data: { name: string; role?: string; description?: string; gitea_repo?: string; model?: string }) => gw().request('agents.create', data),
  update: (id: number, data: Record<string, unknown>) => gw().request('agents.update', { id, ...data }),
  delete: (id: number) => gw().request('agents.delete', { id }),
  start: (id: number) => gw().request('agents.start', { id }),
  stop: (id: number) => gw().request('agents.stop', { id }),
  restart: (id: number) => gw().request('agents.restart', { id }),
  logs: (id: number, tail?: number) => gw().request('agents.logs', { id, tail }),
  files: (id: number) => gw().request('agents.files', { id }),
  readFile: (id: number, filename: string) => gw().request('agents.readFile', { id, filename }),
  writeFile: (id: number, filename: string, content: string) => gw().request('agents.writeFile', { id, filename, content }),
  openclawConfig: (id: number) => gw().request('agents.openclawConfig', { id }),
  saveOpenclawConfig: (id: number, config: Record<string, unknown>) => gw().request('agents.saveOpenclawConfig', { id, config }),
}

export const tasksApi = {
  list: (params?: { status?: string; parent_id?: number }) => gw().request('tasks.list', params || {}),
  get: (id: number) => gw().request('tasks.get', { id }),
  create: (data: { title: string; description?: string; priority?: string; gitea_repo?: string }) => gw().request('tasks.create', data),
  update: (id: number, data: Record<string, unknown>) => gw().request('tasks.update', { id, ...data }),
  delete: (id: number) => gw().request('tasks.delete', { id }),
  syncGitea: (id: number) => gw().request('tasks.syncGitea', { id }),
  decompose: (data: { requirement: string; gitea_repo: string; priority?: string }) => gw().request('tasks.decompose', data),
}

export const giteaApi = {
  repos: (page?: number) => gw().request('gitea.repos', { page }),
  issues: (owner: string, repo: string, state?: string, page?: number) => gw().request('gitea.issues', { owner, repo, state, page }),
  issueDetail: (owner: string, repo: string, index: number) => gw().request('gitea.issueDetail', { owner, repo, index }),
  createIssue: (owner: string, repo: string, data: { title: string; body?: string }) => gw().request('gitea.createIssue', { owner, repo, ...data }),
  pulls: (owner: string, repo: string, state?: string, page?: number) => gw().request('gitea.pulls', { owner, repo, state, page }),
  pullDetail: (owner: string, repo: string, index: number) => gw().request('gitea.pullDetail', { owner, repo, index }),
  pullFiles: (owner: string, repo: string, index: number) => gw().request('gitea.pullFiles', { owner, repo, index }),
  mergePull: (owner: string, repo: string, index: number) => gw().request('gitea.mergePull', { owner, repo, index }),
}

export const settingsApi = {
  getAll: () => gw().request('settings.getAll'),
  get: (key: string) => gw().request('settings.get', { key }),
  set: (key: string, value: string) => gw().request('settings.set', { key, value }),
  setBatch: (entries: Record<string, string>) => gw().request('settings.setBatch', { entries }),
}

export const imageApi = {
  status: () => gw().request('image.status'),
  build: (opts?: Record<string, unknown>) => gw().request('image.build', opts || {}),
}

export const modelsApi = {
  getProviders: () => gw().request('models.getProviders'),
  saveProviders: (providers: any[]) => gw().request('models.saveProviders', { providers }),
}

export const channelsApi = {
  list: () => gw().request('channels.list'),
  create: (data: { name: string; type: string; config: Record<string, any> }) => gw().request('channels.create', data),
  update: (id: number, data: { name: string; type: string; config: Record<string, any> }) => gw().request('channels.update', { id, ...data }),
  delete: (id: number) => gw().request('channels.delete', { id }),
}

export const systemApi = {
  health: () => gw().request('system.health'),
  methods: () => gw().request('system.methods'),
}
