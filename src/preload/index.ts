import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getPort: () => 8765,
  getPlatform: () => process.platform,
  isElectron: true
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore
  window.api = api
}
