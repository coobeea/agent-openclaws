import { JsonStore } from './jsonl-store'
import { log } from '@main/utils/logger'

const DEFAULTS: Record<string, string> = {
  'gitea.url': 'http://localhost:13000',
  'gitea.token': '',
  'docker.socketPath': '',
  'docker.workerImage': 'openclaw:local',
  'docker.maxWorkers': '10',
  'docker.network': 'openclaws-net',
  'openclaw.sourcePath': '',
  'openclaw.workspaceBase': '',
  'openclaw.gatewayPortBase': '18800',
  'openclaw.gatewayToken': '',
}

const store = new JsonStore('settings.json')

export const configStore = {
  get(key: string): string {
    const val = store.get(key)
    return val != null ? String(val) : DEFAULTS[key] ?? ''
  },

  getAll(): Record<string, string> {
    const all = store.getAll() as Record<string, string>
    const result = { ...DEFAULTS }
    for (const [k, v] of Object.entries(all)) {
      result[k] = String(v)
    }
    return result
  },

  set(key: string, value: string): void {
    store.set(key, value)
    log.info(`Config updated: ${key}`)
  },

  setBatch(entries: Record<string, string>): void {
    store.setAll(entries)
    log.info(`Config batch updated: ${Object.keys(entries).join(', ')}`)
  },

  delete(key: string): void {
    store.delete(key)
  },
}
