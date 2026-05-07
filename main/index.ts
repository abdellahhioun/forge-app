import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { registerMcpHandlers, registerFileHandlers } from './ipc-handlers'
import { initDb } from './db'

// ─── Load .env into process.env (main process) ─────────────────────────────
try {
  const fs = require('fs')
  const path = require('path')
  const envPath = path.join(app.getAppPath(), '.env')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
      if (key && !(key in process.env)) process.env[key] = val
    }
  }
} catch {}

const isDev = !app.isPackaged

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
    win.loadFile(join(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  // Init local SQLite DB
  await initDb()

  // Register all MCP IPC handlers
  registerMcpHandlers(ipcMain)
  registerFileHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
