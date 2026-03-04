import { app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { HttpServer } from '@main/server/httpServer'
import { getGateway } from '@main/gateway/Gateway'
import { createMainWindow, getMainWindow } from '@main/window'
import { initDatabase } from '@main/services/database'
import { log } from '@main/utils/logger'

// Gateway method groups
import { systemMethods } from '@main/gateway/methods/system'
import { agentsMethods } from '@main/gateway/methods/agents'
import { tasksMethods } from '@main/gateway/methods/tasks'
import { giteaMethods } from '@main/gateway/methods/gitea'

export async function initApp(): Promise<void> {
  electronApp.setAppUserModelId('com.openclaws')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await app.whenReady()
  log.info('Electron ready')

  // 1. Database
  initDatabase()
  log.info('Database initialized')

  // 2. HttpServer
  new HttpServer()
  log.info('HttpServer started')

  // 3. Gateway + methods
  const gateway = getGateway()
  gateway.registerMethodGroup(systemMethods)
  gateway.registerMethodGroup(agentsMethods)
  gateway.registerMethodGroup(tasksMethods)
  gateway.registerMethodGroup(giteaMethods)
  gateway.start()
  log.info('Gateway started')

  // 4. Window
  createMainWindow()

  app.on('activate', () => {
    if (!getMainWindow()) createMainWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
