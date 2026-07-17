const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jobHelperDesktop', {
  platform: process.platform,
  isDesktop: true,
  apiBase: process.env.JOB_HELPER_API || 'http://127.0.0.1:47821',
  getCookies: (url, label) => ipcRenderer.invoke('get-cookies', url, label),
})
