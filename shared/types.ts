// ─── Project ───────────────────────────────────────────────────────────────
export interface Project {
  id: number
  name: string
  path: string
  description: string | null
  stack: string | null
  lastOpenedAt: string
  createdAt: string
}

// ─── MCP Tool Call ─────────────────────────────────────────────────────────
export interface McpToolCall {
  tool: string
  args: Record<string, unknown>
}

export interface McpToolResult {
  success: boolean
  data?: unknown
  error?: string
}

export type AiModel = 'groq' | 'gemini' | 'ollama'

// ─── Chat ──────────────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  toolCall?: McpToolCall
  toolResult?: McpToolResult
  createdAt: string
}

export interface ChatSession {
  id: number
  projectId: number | null
  title: string
  createdAt: string
}

// ─── Git ───────────────────────────────────────────────────────────────────
export interface GitStatus {
  branch: string
  clean: boolean
  modified: string[]
  untracked: string[]
  staged: string[]
}

export interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

// ─── Terminal ──────────────────────────────────────────────────────────────
export interface TerminalSession {
  id: string
  cwd: string
  title: string
}

// ─── Context Snapshot ──────────────────────────────────────────────────────
export interface ProjectContext {
  name: string
  version: string
  stack: string
  branch: string
  clean: boolean
  lastCommit: string
  fileCount: number
  totalLines: number
  keyFiles: string[]
}

// ─── IPC Channel names ─────────────────────────────────────────────────────
export const IPC = {
  // MCP tools
  MCP_CALL:          'mcp:call',
  MCP_RESULT:        'mcp:result',
  // Projects
  PROJECTS_LIST:     'projects:list',
  PROJECTS_ADD:      'projects:add',
  PROJECTS_REMOVE:   'projects:remove',
  PROJECT_OPEN:      'projects:open',
  // Git
  GIT_STATUS:        'git:status',
  GIT_DIFF:          'git:diff',
  GIT_LOG:           'git:log',
  GIT_COMMIT:        'git:commit',
  GIT_PUSH:          'git:push',
  GIT_BRANCH:        'git:branch',
  GIT_BRANCHES:      'git:branches',
  GIT_BRANCH_SWITCH: 'git:branch:switch',
  GIT_PR:            'git:pr',
  // Terminal
  TERM_SPAWN:        'terminal:spawn',
  TERM_INPUT:        'terminal:input',
  TERM_OUTPUT:       'terminal:output',
  TERM_RESIZE:       'terminal:resize',
  TERM_KILL:         'terminal:kill',
  // Chat
  CHAT_SESSIONS:     'chat:sessions',
  CHAT_MESSAGES:     'chat:messages',
  CHAT_SEND:         'chat:send',
  CHAT_AI:           'chat:ai',
  CHAT_AI_TOKEN:     'chat:ai:token',
  CHAT_AI_DONE:      'chat:ai:done',
  CHAT_AI_ERROR:     'chat:ai:error',
  CHAT_SESSION_NEW:  'chat:session:new',
  CHAT_SESSION_DELETE:'chat:session:delete',
  // Context
  CONTEXT_GET:       'context:get',
  CONTEXT_INDEX:     'context:index',
} as const
