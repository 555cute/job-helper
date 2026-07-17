const { app, BrowserWindow, shell, ipcMain, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const http = require('node:http')

app.disableHardwareAcceleration()

const SERVER_PORT = Number(process.env.JOB_HELPER_PORT || 47821)
const VITE_PORT = Number(process.env.VITE_PORT || 5173)
const DEV_URL = process.env.ELECTRON_START_URL || `http://127.0.0.1:${VITE_PORT}`

let mainWindow = null
let serverProcess = null
let viteProcess = null

function rootDir() {
  return path.join(__dirname, '..')
}

function serverHealthUrl() {
  return `http://127.0.0.1:${SERVER_PORT}/api/health`
}

function waitForUrl(url, timeoutMs = 45000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode < 500) resolve(true)
        else retry()
      })
      req.on('error', retry)
      req.setTimeout(1500, () => { req.destroy(); retry() })
    }
    const retry = () => {
      if (Date.now() - start > timeoutMs) reject(new Error(`等待服务超时: ${url}`))
      else setTimeout(tick, 400)
    }
    tick()
  })
}

function killProcess(proc) {
  if (!proc || proc.killed) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    } else {
      proc.kill('SIGTERM')
    }
  } catch { /* ignore */ }
}

function startServer() {
  if (serverProcess) return
  const entry = path.join(rootDir(), 'server', 'index.js')
  if (!fs.existsSync(entry)) return

  const nodeExe = process.env.JOB_HELPER_NODE || 'node'
  serverProcess = spawn(nodeExe, [entry], {
    cwd: rootDir(),
    env: { ...process.env, JOB_HELPER_PORT: String(SERVER_PORT) },
    stdio: 'ignore',
    windowsHide: true,
  })
  serverProcess.on('error', (err) => {
    console.error('[main] server spawn error:', err.message)
    serverProcess = null
  })
  serverProcess.on('exit', (code) => {
    console.log(`[main] server exited (code=${code})`)
    serverProcess = null
  })
}

function startVite() {
  if (viteProcess || !isDevMode()) return
  const viteEntry = path.join(rootDir(), 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(viteEntry)) return

  const nodeExe = process.env.JOB_HELPER_NODE || 'node'
  viteProcess = spawn(nodeExe, [viteEntry, '--host', '127.0.0.1', '--port', String(VITE_PORT), '--strictPort'], {
    cwd: rootDir(),
    env: { ...process.env },
    stdio: 'ignore',
    windowsHide: true,
  })
  viteProcess.on('error', (err) => {
    console.error('[main] vite spawn error:', err.message)
    viteProcess = null
  })
  viteProcess.on('exit', (code) => {
    console.log(`[main] vite exited (code=${code})`)
    viteProcess = null
  })
}

function isDevMode() {
  if (process.env.ELECTRON_START_URL || process.env.JOB_HELPER_FORCE_DEV === '1') return true
  if (app.isPackaged || process.env.JOB_HELPER_FORCE_DIST === '1') return false
  return !fs.existsSync(path.join(rootDir(), 'dist', 'index.html'))
}

const FORCED_CSS = `
html, body, #root, * {
  user-select: none !important;
  -webkit-user-select: none !important;
}
input, textarea, [contenteditable="true"], .allow-select, .allow-select * {
  user-select: text !important;
  -webkit-user-select: text !important;
}
::selection, *::selection {
  background: #bfdbfe !important;
  color: #0f172a !important;
  -webkit-text-fill-color: #0f172a !important;
}
`

const FORCED_JS = `
(function () {
  function editable(el) {
    if (!el || !el.tagName) return false;
    var t = el.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    if (el.closest && el.closest('.allow-select')) return true;
    return false;
  }
  document.addEventListener('selectstart', function (e) {
    if (!editable(e.target)) e.preventDefault();
  }, true);
  document.addEventListener('mousedown', function (e) {
    if (!editable(e.target)) {
      var s = window.getSelection();
      if (s) s.removeAllRanges();
    }
  }, true);
})();
`

async function createWindow() {
  const iconPath = [
    path.join(rootDir(), 'public', 'logo-v2.png'),
    path.join(rootDir(), 'public', 'app-icon.png'),
    path.join(rootDir(), 'dist', 'logo-v2.png'),
    path.join(rootDir(), 'build', 'icon.png'),
  ].find((p) => fs.existsSync(p))

  const options = {
    width: 1380,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#ffffff',
    title: '求职助手',
    autoHideMenuBar: true,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:job-helper-v4',
    },
  }

  if (process.platform === 'win32') {
    options.titleBarStyle = 'hidden'
    options.titleBarOverlay = { color: '#ffffff', symbolColor: '#4b5563', height: 48 }
  }

  mainWindow = new BrowserWindow(options)

  try { const ses = mainWindow.webContents.session; await ses.clearCache() } catch { /* ignore */ }

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const inject = async () => {
    try {
      await mainWindow?.webContents.insertCSS(FORCED_CSS)
      await mainWindow?.webContents.executeJavaScript(FORCED_JS, true)
    } catch { /* ignore */ }
  }
  mainWindow.webContents.on('dom-ready', () => void inject())
  mainWindow.webContents.on('did-finish-load', () => void inject())

  if (isDevMode()) {
    await mainWindow.loadURL(`${DEV_URL}?v=${Date.now()}`)
  } else {
    const indexHtml = path.join(rootDir(), 'dist', 'index.html')
    if (!fs.existsSync(indexHtml)) throw new Error('请先 npm run build')
    await mainWindow.loadFile(indexHtml, { query: { v: String(Date.now()) } })
  }
}

app.whenReady().then(async () => {
  // IPC: 获取浏览器 Cookie
  ipcMain.handle('get-cookies', async (_event, url, label) => {
    return new Promise((resolve) => {
      const loginUrls = {
        'Boss直聘': { login: 'https://www.zhipin.com/web/user/?ka=header-login', home: 'zhipin.com/web/geek' },
        '智联招聘': { login: 'https://passport.zhaopin.com/login', home: 'zhaopin.com/sou' },
        '猎聘': { login: 'https://www.liepin.com/login/', home: 'liepin.com/zhaopin' },
      }
      const cfg = loginUrls[label] || { login: url, home: '' }

      const win = new BrowserWindow({
        width: 1100, height: 750,
        title: `登录 ${label}`,
        webPreferences: { sandbox: false, partition: 'persist:cookie-extract' },
      })
      win.loadURL(cfg.login)

      let loggedIn = false

      const closeAndResolve = async () => {
        if (closed) return
        closed = true
        await new Promise(r => setTimeout(r, 500))

        if (!loggedIn) {
          if (!win.isDestroyed()) win.close()
          resolve('')
          return
        }

        try {
          const ses = session.fromPartition('persist:cookie-extract')
          const cookies = await ses.cookies.get({})
          // 只保留认证相关的 cookie
          const authKeys = ['zp_token', '__zp_stoken__', 'ZPL_LOGIN_TOKEN', 'clientId', 'token', 'JSESSIONID', '_bl_uid', 'wt2', 'li_remember']
          const relevant = cookies.filter(c => authKeys.some(k => c.name.toLowerCase().includes(k.toLowerCase())))
          const allCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ')
          // 优先返回认证 cookie，没有则返回全部
          const cookieStr = relevant.length > 0
            ? relevant.map(c => `${c.name}=${c.value}`).join('; ')
            : allCookies
          resolve(cookieStr)
        } catch { resolve('') }
        if (!win.isDestroyed()) win.close()
      }

      // 监听 URL 变化，跳转到非登录页就自动关闭
      win.webContents.on('did-navigate', (_e, newUrl) => {
        if (cfg.home && newUrl.includes(cfg.home)) {
          loggedIn = true
          closeAndResolve()
        }
      })
      win.webContents.on('did-navigate-in-page', (_e, newUrl) => {
        if (cfg.home && newUrl.includes(cfg.home)) {
          loggedIn = true
          closeAndResolve()
        }
      })

      // 兜底：手动关闭时读取
      win.on('closed', () => {
        if (!closed) closeAndResolve()
      })
    })
  })
  if (process.platform === 'win32') {
    try { app.setAppUserModelId('com.jobhelper.desktop') } catch { /* ignore */ }
  }

  startServer()
  startVite()

  try {
    await waitForUrl(serverHealthUrl(), 30000)
    if (isDevMode()) { await waitForUrl(DEV_URL, 30000) }
  } catch (err) {
    console.error('[main] waitForUrl error:', err.message)
  }

  try {
    await createWindow()
  } catch (err) {
    console.error('[main] createWindow error:', err.message)
    app.quit()
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  killProcess(serverProcess)
  killProcess(viteProcess)
  serverProcess = null
  viteProcess = null
})
