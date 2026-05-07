"use strict";
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs");
const Database = require("better-sqlite3");
const betterSqlite3 = require("drizzle-orm/better-sqlite3");
const sqliteCore = require("drizzle-orm/sqlite-core");
const drizzleOrm = require("drizzle-orm");
const projects = sqliteCore.sqliteTable("projects", {
  id: sqliteCore.integer("id").primaryKey({ autoIncrement: true }),
  name: sqliteCore.text("name").notNull(),
  path: sqliteCore.text("path").notNull().unique(),
  description: sqliteCore.text("description"),
  stack: sqliteCore.text("stack"),
  lastOpenedAt: sqliteCore.text("last_opened_at").notNull().default((/* @__PURE__ */ new Date()).toISOString()),
  createdAt: sqliteCore.text("created_at").notNull().default((/* @__PURE__ */ new Date()).toISOString())
});
const chatSessions = sqliteCore.sqliteTable("chat_sessions", {
  id: sqliteCore.integer("id").primaryKey({ autoIncrement: true }),
  projectId: sqliteCore.integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: sqliteCore.text("title").notNull().default("New Chat"),
  createdAt: sqliteCore.text("created_at").notNull().default((/* @__PURE__ */ new Date()).toISOString())
});
const chatMessages = sqliteCore.sqliteTable("chat_messages", {
  id: sqliteCore.integer("id").primaryKey({ autoIncrement: true }),
  sessionId: sqliteCore.integer("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  role: sqliteCore.text("role").notNull(),
  // user | assistant | tool
  content: sqliteCore.text("content").notNull(),
  toolCall: sqliteCore.text("tool_call"),
  // JSON
  toolResult: sqliteCore.text("tool_result"),
  // JSON
  createdAt: sqliteCore.text("created_at").notNull().default((/* @__PURE__ */ new Date()).toISOString())
});
sqliteCore.sqliteTable("app_memory", {
  id: sqliteCore.integer("id").primaryKey({ autoIncrement: true }),
  key: sqliteCore.text("key").notNull().unique(),
  value: sqliteCore.text("value").notNull(),
  updatedAt: sqliteCore.text("updated_at").notNull().default((/* @__PURE__ */ new Date()).toISOString())
});
let _db = null;
let _sqlite = null;
async function initDb() {
  const dbPath = path.join(electron.app.getPath("userData"), "forge.db");
  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _db = betterSqlite3.drizzle(_sqlite);
  _sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      description TEXT,
      stack TEXT,
      last_opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_call TEXT,
      tool_result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS app_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  console.log("[db] Forge SQLite ready at", dbPath);
}
function getDb() {
  if (!_db) throw new Error("DB not initialized. Call initDb() first.");
  return _db;
}
const IPC = {
  // Projects
  PROJECTS_LIST: "projects:list",
  PROJECTS_ADD: "projects:add",
  PROJECTS_REMOVE: "projects:remove",
  // Git
  GIT_STATUS: "git:status",
  GIT_DIFF: "git:diff",
  GIT_LOG: "git:log",
  GIT_COMMIT: "git:commit",
  GIT_PUSH: "git:push",
  GIT_BRANCH: "git:branch",
  // Terminal
  TERM_SPAWN: "terminal:spawn",
  TERM_INPUT: "terminal:input",
  TERM_OUTPUT: "terminal:output",
  TERM_KILL: "terminal:kill",
  // Chat
  CHAT_SESSIONS: "chat:sessions",
  CHAT_MESSAGES: "chat:messages",
  CHAT_SEND: "chat:send",
  // Context
  CONTEXT_GET: "context:get",
  CONTEXT_INDEX: "context:index"
};
const terminals = /* @__PURE__ */ new Map();
function registerMcpHandlers(ipcMain) {
  ipcMain.handle(IPC.PROJECTS_LIST, async () => {
    return getDb().select().from(projects).all();
  });
  ipcMain.handle(IPC.PROJECTS_ADD, async (_e, folderPath) => {
    let targetPath = folderPath;
    if (!targetPath) {
      const result = await electron.dialog.showOpenDialog({
        properties: ["openDirectory"],
        message: "Select a project folder"
      });
      if (result.canceled || !result.filePaths[0]) return null;
      targetPath = result.filePaths[0];
    }
    if (!fs.existsSync(targetPath)) throw new Error("Path does not exist");
    let name = targetPath.split("/").pop() ?? "Project";
    let stack = null;
    let description = null;
    try {
      const pkgPath = `${targetPath}/package.json`;
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(require("fs").readFileSync(pkgPath, "utf-8"));
        name = pkg.name ?? name;
        description = pkg.description ?? null;
      }
    } catch {
    }
    const db = getDb();
    const existing = db.select().from(projects).where(drizzleOrm.eq(projects.path, targetPath)).get();
    if (existing) return existing;
    db.insert(projects).values({ name, path: targetPath, description, stack }).run();
    return db.select().from(projects).where(drizzleOrm.eq(projects.path, targetPath)).get();
  });
  ipcMain.handle(IPC.PROJECTS_REMOVE, async (_e, id) => {
    getDb().delete(projects).where(drizzleOrm.eq(projects.id, id)).run();
    return { success: true };
  });
  const git = (cmd, cwd) => {
    try {
      return { ok: true, out: child_process.execSync(cmd, { cwd, encoding: "utf-8" }).trim() };
    } catch (e) {
      return { ok: false, out: e.message };
    }
  };
  ipcMain.handle(IPC.GIT_STATUS, async (_e, cwd) => {
    const branch = git("git rev-parse --abbrev-ref HEAD", cwd);
    const status = git("git status --porcelain", cwd);
    const lines = status.out.split("\n").filter(Boolean);
    return {
      branch: branch.out,
      clean: lines.length === 0,
      modified: lines.filter((l) => l.startsWith(" M") || l.startsWith("M ")).map((l) => l.slice(3)),
      untracked: lines.filter((l) => l.startsWith("??")).map((l) => l.slice(3)),
      staged: lines.filter((l) => l.match(/^[MADRCU]/)).map((l) => l.slice(3))
    };
  });
  ipcMain.handle(IPC.GIT_DIFF, async (_e, cwd) => {
    return git("git diff HEAD", cwd).out;
  });
  ipcMain.handle(IPC.GIT_LOG, async (_e, cwd, limit = 20) => {
    const out = git(`git log --oneline -${limit} --pretty=format:"%h|%s|%an|%ar"`, cwd).out;
    return out.split("\n").filter(Boolean).map((line) => {
      const [hash, message, author, date] = line.split("|");
      return { hash, message, author, date };
    });
  });
  ipcMain.handle(IPC.GIT_COMMIT, async (_e, cwd, message) => {
    git("git add .", cwd);
    return git(`git commit -m "${message.replace(/"/g, '\\"')}"`, cwd);
  });
  ipcMain.handle(IPC.GIT_PUSH, async (_e, cwd) => {
    return git("git push", cwd);
  });
  ipcMain.handle(IPC.GIT_BRANCH, async (_e, cwd, name) => {
    return git(`git checkout -b "${name}"`, cwd);
  });
  ipcMain.handle(IPC.TERM_SPAWN, async (event, id, cwd) => {
    const shell = process.env.SHELL || "/bin/zsh";
    const pty = child_process.spawn(shell, [], {
      cwd,
      env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    terminals.set(id, pty);
    pty.stdout.on("data", (d) => event.sender.send(IPC.TERM_OUTPUT, id, d.toString()));
    pty.stderr.on("data", (d) => event.sender.send(IPC.TERM_OUTPUT, id, d.toString()));
    pty.on("exit", () => {
      terminals.delete(id);
      event.sender.send(IPC.TERM_OUTPUT, id, "\r\n[Process exited]\r\n");
    });
    return { success: true };
  });
  ipcMain.handle(IPC.TERM_INPUT, async (_e, id, string) => {
    terminals.get(id)?.stdin?.write(data);
  });
  ipcMain.handle(IPC.TERM_KILL, async (_e, id) => {
    terminals.get(id)?.kill();
    terminals.delete(id);
  });
  ipcMain.handle(IPC.CHAT_SESSIONS, async (_e, projectId) => {
    const db = getDb();
    if (projectId) return db.select().from(chatSessions).where(drizzleOrm.eq(chatSessions.projectId, projectId)).all();
    return db.select().from(chatSessions).all();
  });
  ipcMain.handle(IPC.CHAT_MESSAGES, async (_e, sessionId) => {
    return getDb().select().from(chatMessages).where(drizzleOrm.eq(chatMessages.sessionId, sessionId)).all();
  });
  ipcMain.handle(IPC.CHAT_SEND, async (_e, sessionId, role, content) => {
    getDb().insert(chatMessages).values({ sessionId, role, content }).run();
    return { success: true };
  });
  ipcMain.handle(IPC.CONTEXT_GET, async (_e, cwd) => {
    try {
      const ctxPath = `${cwd}/.mcp-context.json`;
      if (fs.existsSync(ctxPath)) {
        return JSON.parse(require("fs").readFileSync(ctxPath, "utf-8"));
      }
      return null;
    } catch {
      return null;
    }
  });
  ipcMain.handle(IPC.CONTEXT_INDEX, async (_e, cwd) => {
    try {
      child_process.execSync(`node -e "console.log('indexing')"`, { cwd });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}
const isDev = !electron.app.isPackaged;
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    // native macOS traffic lights
    backgroundColor: "#0f0e0d",
    vibrancy: "under-window",
    // macOS frosted glass
    visualEffectState: "active",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}
electron.app.whenReady().then(async () => {
  await initDb();
  registerMcpHandlers(electron.ipcMain);
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
