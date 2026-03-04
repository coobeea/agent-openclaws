import { app } from 'electron'

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  try { app.quit() } catch { /* noop */ }
  setTimeout(() => process.exit(1), 3000).unref()
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

import { initApp } from './app'
initApp().catch((err) => {
  console.error('App init failed:', err)
  process.exit(1)
})
