import Dockerode from 'dockerode'
import { configStore } from './config-store'
import { log } from '@main/utils/logger'

const docker = new Dockerode()

const CONTAINER_LABEL = 'openclaws.managed'
const INTERNAL_PORT = 18789

export const dockerManager = {
  async ensureNetwork(): Promise<void> {
    const networkName = configStore.get('docker.network') || 'openclaws-net'
    try {
      const networks = await docker.listNetworks({ filters: { name: [networkName] } })
      if (networks.length === 0) {
        await docker.createNetwork({ Name: networkName, Driver: 'bridge' })
        log.info(`Docker network "${networkName}" created`)
      }
    } catch (err: any) {
      log.warn(`Could not ensure network: ${err.message}`)
    }
  },

  async listWorkerContainers(): Promise<any[]> {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: { label: [`${CONTAINER_LABEL}=true`] },
      })
      return containers.map((c) => ({
        id: c.Id.substring(0, 12),
        fullId: c.Id,
        names: c.Names,
        state: c.State,
        status: c.Status,
        image: c.Image,
        labels: c.Labels,
        ports: c.Ports,
      }))
    } catch (err: any) {
      log.error('Docker list error:', err.message)
      return []
    }
  },

  /**
   * Create an OpenClaw gateway container with proper volume mounts,
   * network, and environment variables matching the official docker-compose.yml.
   */
  async createOpenClawContainer(
    name: string,
    hostPort: number,
    workspacePath: string,
    env: Record<string, string> = {}
  ): Promise<{ id: string; fullId: string }> {
    const image = configStore.get('docker.workerImage') || 'openclaw:local'
    const networkName = configStore.get('docker.network') || 'openclaws-net'
    const containerName = `openclaws-${name}`

    await this.ensureNetwork()

    try {
      const existing = docker.getContainer(containerName)
      const info = await existing.inspect()
      if (info) {
        log.info(`Removing existing container: ${containerName}`)
        await existing.remove({ force: true })
      }
    } catch {
      // container doesn't exist, that's fine
    }

    const envList = [
      `HOME=/home/node`,
      `TERM=xterm-256color`,
      ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
    ]

    const configDir = `${workspacePath}/.openclaw`
    const wsDir = `${workspacePath}/workspace`

    const container = await docker.createContainer({
      Image: image,
      name: containerName,
      Labels: {
        [CONTAINER_LABEL]: 'true',
        'openclaws.name': name,
        'openclaws.port': String(hostPort),
      },
      Cmd: [
        'node', 'dist/index.js', 'gateway',
        '--bind', 'lan',
        '--port', String(INTERNAL_PORT),
      ],
      Env: envList,
      ExposedPorts: { [`${INTERNAL_PORT}/tcp`]: {} },
      HostConfig: {
        Binds: [
          `${configDir}:/home/node/.openclaw`,
          `${wsDir}:/home/node/.openclaw/workspace`,
        ],
        PortBindings: {
          [`${INTERNAL_PORT}/tcp`]: [{ HostPort: String(hostPort) }],
        },
        NetworkMode: networkName,
        ExtraHosts: ['host.docker.internal:host-gateway'],
        Init: true,
        RestartPolicy: { Name: 'unless-stopped' },
      },
      Healthcheck: {
        Test: [
          'CMD', 'node', '-e',
          `fetch('http://127.0.0.1:${INTERNAL_PORT}/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`,
        ],
        Interval: 30_000_000_000,
        Timeout: 5_000_000_000,
        Retries: 5,
        StartPeriod: 20_000_000_000,
      },
    })

    log.info(`Container created: ${containerName} (port ${hostPort})`)
    return { id: container.id.substring(0, 12), fullId: container.id }
  },

  async startContainer(id: string): Promise<boolean> {
    try {
      await docker.getContainer(id).start()
      return true
    } catch (e: any) {
      log.error('Start failed:', e.message)
      return false
    }
  },

  async stopContainer(id: string): Promise<boolean> {
    try {
      await docker.getContainer(id).stop()
      return true
    } catch (e: any) {
      log.error('Stop failed:', e.message)
      return false
    }
  },

  async restartContainer(id: string): Promise<boolean> {
    try {
      await docker.getContainer(id).restart()
      return true
    } catch (e: any) {
      log.error('Restart failed:', e.message)
      return false
    }
  },

  async removeContainer(id: string, force = false): Promise<boolean> {
    try {
      await docker.getContainer(id).remove({ force })
      return true
    } catch (e: any) {
      log.error('Remove failed:', e.message)
      return false
    }
  },

  async getContainerLogs(id: string, tail = 200): Promise<string> {
    try {
      const c = docker.getContainer(id)
      const logs = await c.logs({ stdout: true, stderr: true, tail, timestamps: true })
      return typeof logs === 'string' ? logs : logs.toString('utf-8')
    } catch (e: any) {
      log.error('Logs failed:', e.message)
      return ''
    }
  },

  async getContainerState(id: string): Promise<{ running: boolean; health?: string } | null> {
    try {
      const info = await docker.getContainer(id).inspect()
      return {
        running: info.State.Running,
        health: info.State.Health?.Status,
      }
    } catch {
      return null
    }
  },

  async imageExists(tag: string): Promise<{ exists: boolean; id?: string; size?: string; created?: string }> {
    try {
      const info = await docker.getImage(tag).inspect()
      return {
        exists: true,
        id: info.Id,
        size: `${(info.Size / 1024 / 1024).toFixed(0)} MB`,
        created: info.Created,
      }
    } catch {
      return { exists: false }
    }
  },

  getDocker(): Dockerode {
    return docker
  },
}
