import Dockerode from 'dockerode'
import { log } from '@main/utils/logger'

const docker = new Dockerode()

export const dockerManager = {
  async listWorkerContainers(): Promise<any[]> {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: { label: ['openclaws.role=worker'] }
      })
      return containers.map(c => ({
        id: c.Id.substring(0, 12),
        fullId: c.Id,
        names: c.Names,
        state: c.State,
        status: c.Status,
        image: c.Image,
        labels: c.Labels,
        ports: c.Ports
      }))
    } catch (err: any) {
      log.error('Docker list error:', err.message)
      return []
    }
  },

  async createWorker(name: string, gatewayPort: number, workspacePath: string, env?: Record<string, string>): Promise<any> {
    const container = await docker.createContainer({
      Image: process.env.OPENCLAWS_WORKER_IMAGE || 'openclaws-worker:latest',
      name: `openclaws-worker-${name}`,
      Labels: { 'openclaws.role': 'worker', 'openclaws.name': name },
      Env: [
        `OPENCLAW_GATEWAY_PORT=${gatewayPort}`,
        ...Object.entries(env || {}).map(([k, v]) => `${k}=${v}`)
      ],
      HostConfig: {
        Binds: [`${workspacePath}:/workspace`],
        PortBindings: { [`${gatewayPort}/tcp`]: [{ HostPort: String(gatewayPort) }] }
      },
      ExposedPorts: { [`${gatewayPort}/tcp`]: {} }
    })
    return { id: container.id.substring(0, 12), fullId: container.id }
  },

  async startContainer(id: string): Promise<boolean> {
    try { const c = docker.getContainer(id); await c.start(); return true }
    catch (e: any) { log.error('Start failed:', e.message); return false }
  },

  async stopContainer(id: string): Promise<boolean> {
    try { const c = docker.getContainer(id); await c.stop(); return true }
    catch (e: any) { log.error('Stop failed:', e.message); return false }
  },

  async restartContainer(id: string): Promise<boolean> {
    try { const c = docker.getContainer(id); await c.restart(); return true }
    catch (e: any) { log.error('Restart failed:', e.message); return false }
  },

  async removeContainer(id: string, force = false): Promise<boolean> {
    try { const c = docker.getContainer(id); await c.remove({ force }); return true }
    catch (e: any) { log.error('Remove failed:', e.message); return false }
  },

  async getContainerLogs(id: string, tail = 100): Promise<string> {
    try {
      const c = docker.getContainer(id)
      const logs = await c.logs({ stdout: true, stderr: true, tail })
      return typeof logs === 'string' ? logs : logs.toString('utf-8')
    } catch (e: any) { log.error('Logs failed:', e.message); return '' }
  }
}
