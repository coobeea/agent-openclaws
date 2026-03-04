import { configStore } from './config-store'
import { log } from '@main/utils/logger'

function getBaseUrl(): string {
  const url = configStore.get('gitea.url') || 'http://localhost:13000'
  return `${url}/api/v1`
}

function getToken(): string {
  return configStore.get('gitea.token') || ''
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  const token = getToken()
  if (token) h['Authorization'] = `token ${token}`
  return h
}

async function request(path: string, opts?: RequestInit): Promise<any> {
  const url = `${getBaseUrl()}${path}`
  const res = await fetch(url, { ...opts, headers: { ...headers(), ...opts?.headers } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gitea ${res.status}: ${text}`)
  }
  const contentType = res.headers.get('content-type') || ''
  return contentType.includes('json') ? res.json() : res.text()
}

export const giteaClient = {
  async listRepos(page = 1, limit = 50): Promise<any[]> {
    const data = await request(`/repos/search?limit=${limit}&page=${page}`)
    return data?.data || []
  },

  async getRepo(owner: string, repo: string): Promise<any> {
    return request(`/repos/${owner}/${repo}`)
  },

  async listIssues(owner: string, repo: string, state = 'open', page = 1, limit = 50): Promise<any[]> {
    return request(`/repos/${owner}/${repo}/issues?state=${state}&page=${page}&limit=${limit}&type=issues`)
  },

  async getIssue(owner: string, repo: string, index: number): Promise<any> {
    return request(`/repos/${owner}/${repo}/issues/${index}`)
  },

  async createIssue(owner: string, repo: string, data: { title: string; body?: string }): Promise<any> {
    return request(`/repos/${owner}/${repo}/issues`, { method: 'POST', body: JSON.stringify(data) })
  },

  async updateIssue(owner: string, repo: string, index: number, data: Record<string, unknown>): Promise<any> {
    return request(`/repos/${owner}/${repo}/issues/${index}`, { method: 'PATCH', body: JSON.stringify(data) })
  },

  async listPulls(owner: string, repo: string, state = 'open', page = 1, limit = 50): Promise<any[]> {
    return request(`/repos/${owner}/${repo}/pulls?state=${state}&page=${page}&limit=${limit}`)
  },

  async getPull(owner: string, repo: string, index: number): Promise<any> {
    return request(`/repos/${owner}/${repo}/pulls/${index}`)
  },

  async getPullFiles(owner: string, repo: string, index: number): Promise<any[]> {
    return request(`/repos/${owner}/${repo}/pulls/${index}/files`)
  },

  async mergePull(owner: string, repo: string, index: number, method = 'merge'): Promise<any> {
    return request(`/repos/${owner}/${repo}/pulls/${index}/merge`, {
      method: 'POST',
      body: JSON.stringify({ Do: method })
    })
  }
}
