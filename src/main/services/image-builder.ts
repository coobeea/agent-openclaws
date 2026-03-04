import { existsSync } from 'fs'
import { join } from 'path'
import { dockerManager } from './docker-manager'
import { configStore } from './config-store'
import { log } from '@main/utils/logger'
import { getGateway } from '@main/gateway/Gateway'

export const imageBuilder = {
  async status(): Promise<{ exists: boolean; id?: string; size?: string; created?: string }> {
    const tag = configStore.get('docker.workerImage') || 'openclaw:local'
    return dockerManager.imageExists(tag)
  },

  async build(opts: {
    installBrowser?: boolean
    installDockerCli?: boolean
  } = {}): Promise<{ ok: boolean; message: string }> {
    const sourcePath = configStore.get('openclaw.sourcePath')
    if (!sourcePath) {
      return { ok: false, message: '未配置 OpenClaw 源码路径（设置 → openclaw.sourcePath）' }
    }

    const dockerfile = join(sourcePath, 'Dockerfile')
    if (!existsSync(dockerfile)) {
      return { ok: false, message: `源码路径下未找到 Dockerfile: ${dockerfile}` }
    }

    const tag = configStore.get('docker.workerImage') || 'openclaw:local'

    log.info(`Building image "${tag}" from ${sourcePath}`)
    broadcastBuildLog(`开始构建镜像 ${tag}...\n源码路径: ${sourcePath}\n`)

    try {
      const docker = dockerManager.getDocker()
      const buildArgs: Record<string, string> = {}
      if (opts.installBrowser) buildArgs['OPENCLAW_INSTALL_BROWSER'] = '1'
      if (opts.installDockerCli) buildArgs['OPENCLAW_INSTALL_DOCKER_CLI'] = '1'

      const stream = await docker.buildImage(
        { context: sourcePath, src: ['.'] },
        { t: tag, buildargs: buildArgs, dockerfile: 'Dockerfile' }
      )

      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(
          stream,
          (err: Error | null) => {
            if (err) {
              broadcastBuildLog(`\n构建失败: ${err.message}\n`)
              reject(err)
            } else {
              broadcastBuildLog('\n构建完成！\n')
              resolve()
            }
          },
          (event: any) => {
            if (event.stream) broadcastBuildLog(event.stream)
            if (event.error) broadcastBuildLog(`ERROR: ${event.error}\n`)
          }
        )
      })

      log.info(`Image "${tag}" built successfully`)
      return { ok: true, message: '镜像构建成功' }
    } catch (err: any) {
      log.error('Image build failed:', err.message)
      return { ok: false, message: err.message }
    }
  },
}

function broadcastBuildLog(line: string): void {
  try {
    getGateway().broadcastEvent('image.buildLog', { line })
  } catch {
    // gateway might not be ready
  }
}
