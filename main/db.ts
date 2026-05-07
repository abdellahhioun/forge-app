import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { app } from 'electron'
import { join } from 'path'

// ─── Schema ─────────────────────────────────────────────────────────────────
export const projects = sqliteTable('projects', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  name:         text('name').notNull(),
  path:         text('path').notNull().unique(),
  description:  text('description'),
  stack:        text('stack'),
  lastOpenedAt: text('last_opened_at').notNull().default(new Date().toISOString()),
  createdAt:    text('created_at').notNull().default(new Date().toISOString()),
})

export const chatSessions = sqliteTable('chat_sessions', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  title:     text('title').notNull().default('New Chat'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

export const chatMessages = sqliteTable('chat_messages', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role:      text('role').notNull(), // user | assistant | tool
  content:   text('content').notNull(),
  toolCall:  text('tool_call'),  // JSON
  toolResult:text('tool_result'),// JSON
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

export const appMemory = sqliteTable('app_memory', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  key:       text('key').notNull().unique(),
  value:     text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
})

// ─── DB instance (singleton) ──────────────────────────────────────────────────
let _db: ReturnType<typeof drizzle> | null = null
let _sqlite: Database.Database | null = null

export async function initDb() {
  const dbPath = join(app.getPath('userData'), 'forge.db')
  _sqlite = new Database(dbPath)
  _sqlite.pragma('journal_mode = WAL')  // better concurrent performance
  _sqlite.pragma('foreign_keys = ON')

  _db = drizzle(_sqlite)

  // Run migrations inline (simple approach for v0.1)
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
  `)

  console.log('[db] Forge SQLite ready at', dbPath)
}

export function getDb() {
  if (!_db) throw new Error('DB not initialized. Call initDb() first.')
  return _db
}

export function getSqlite() {
  if (!_sqlite) throw new Error('SQLite not initialized.')
  return _sqlite
}
