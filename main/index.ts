import { app, BrowserWindow, shell, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { registerMcpHandlers, registerFileHandlers, registerToolHandlers } from './ipc-handlers'
import { initDb } from './db'

const isDev = !app.isPackaged

// ─── Register custom scheme before app is ready ──────────────────────────────
if (!isDev) {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    }
  }])
}

// ─── Load .env from userData (persists across app updates) ───────────────────
// userData = ~/Library/Application Support/forge-app/
// On first launch we seed it from the bundled .env if the user doesn't have one yet.
function loadEnv() {
  const fs = require('fs')
  const path = require('path')

  const userDataEnv = path.join(app.getPath('userData'), '.env')

  // Seed from bundled .env on first launch (only if userData .env doesn't exist)
  if (!fs.existsSync(userDataEnv)) {
    const bundledEnv = path.join(app.getAppPath(), '.env')
    if (fs.existsSync(bundledEnv)) {
      try { fs.copyFileSync(bundledEnv, userDataEnv) } catch {}
    }
  }

  // Load from userData
  if (fs.existsSync(userDataEnv)) {
    try {
      const lines = fs.readFileSync(userDataEnv, 'utf-8').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq < 0) continue
        const key = trimmed.slice(0, eq).trim()
        const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
        if (key && !(key in process.env)) process.env[key] = val
      }
    } catch {}
  }
}

// ─── Auto-start Ollama if installed but not running ──────────────────────────
function startOllama() {
  const http = require('http')
  // Ping Ollama — if it responds, it's already running
  const req = http.request(
    { hostname: '127.0.0.1', port: 11434, path: '/', method: 'GET', timeout: 1000 },
    () => { /* already running, do nothing */ }
  )
  req.on('error', () => {
    // Not running — try to spawn it
    try {
      const proc = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore',
        // On macOS, search common install paths in addition to PATH
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:/usr/bin`,
        },
      })
      proc.unref()
    } catch {
      // Ollama not installed — the UI already shows a helpful error message
    }
  })
  req.on('timeout', () => req.destroy())
  req.end()
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // native macOS traffic lights
    backgroundColor: '#0f0e0d',
    vibrancy: 'under-window',     // macOS frosted glass
    visualEffectState: 'active',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Show once ready to avoid white flash
  win.once('ready-to-show', () => win.show())

  // Open external links in browser, not in app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadURL('app://forge/index.html')
  }
}

app.whenReady().then(async () => {
  // Load API keys from ~/Library/Application Support/forge-app/.env
  loadEnv()

  // Auto-start Ollama in the background (no-op if already running or not installed)
  startOllama()

  // Init local SQLite DB
  await initDb()

  // Register all IPC handlers
  registerMcpHandlers(ipcMain)
  registerToolHandlers(ipcMain)
  registerFileHandlers()

  // In production, serve renderer via custom protocol to support ES modules
  if (!isDev) {
    const rendererRoot = join(__dirname, '../../out/renderer')
    protocol.handle('app', (request) => {
      const url = new URL(request.url)
      let filePath = url.pathname
      if (filePath === '/' || filePath === '') filePath = '/index.html'
      const fullPath = join(rendererRoot, filePath)
      return net.fetch(`file://${fullPath}`)
    })
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

