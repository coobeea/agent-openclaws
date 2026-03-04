import { app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { HttpServer } from '@main/server/httpServer'
import { getGateway } from '@main/gateway/Gateway'
import { createMainWindow, getMainWindow } from '@main/window'
import { initDataDir } from '@main/services/jsonl-store'
import { log } from '@main/utils/logger'

import { systemMethods } from '@main/gateway/methods/system'
import { agentsMethods } from '@main/gateway/methods/agents'
import { tasksMethods } from '@main/gateway/methods/tasks'
import { giteaMethods } from '@main/gateway/methods/gitea'
import { settingsMethods } from '@main/gateway/methods/settings'
import { imageMethods } from '@main/gateway/methods/image'
import { modelsMethods } from '@main/gateway/methods/models'
import { startHealthMonitor } from '@main/services/health-monitor'

export async function initApp(): Promise<void> {
  electronApp.setAppUserModelId('com.openclaws')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await app.whenReady()
  log.info('Electron ready')

  // 1. Data directory
  initDataDir()

  // 2. HttpServer
  new HttpServer()
  log.info('HttpServer started')

  // 3. Gateway + methods
  const gateway = getGateway()
  gateway.registerMethodGroup(systemMethods)
  gateway.registerMethodGroup(agentsMethods)
  gateway.registerMethodGroup(tasksMethods)
  gateway.registerMethodGroup(giteaMethods)
  gateway.registerMethodGroup(settingsMethods)
  gateway.registerMethodGroup(imageMethods)
  gateway.registerMethodGroup(modelsMethods)
  gateway.start()
  log.info('Gateway started')

  // 4. Health monitor
  startHealthMonitor()

  // 5. Window
  createMainWindow()

  app.on('activate', () => {
    if (!getMainWindow()) createMainWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    try {
      const server = HttpServer.getInstance()
      if (server) {
        server.close().catch(console.error)
      }
    } catch (e) {
      console.error('Error closing server:', e)
    }
  })
}
