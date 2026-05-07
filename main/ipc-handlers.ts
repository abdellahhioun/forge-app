import { IpcMain, dialog } from 'electron'
import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, renameSync, rmSync, mkdirSync } from 'fs'
import { getDb, getSqlite } from './db'
import { projects, chatSessions, chatMessages } from './db'
import { eq } from 'drizzle-orm'
import type { IpcMainInvokeEvent } from 'electron'
import { IPC } from '../shared/types'
import * as pty from 'node-pty'

// ─── Active terminal processes ───────────────────────────────────────────────────────
const terminals = new Map<string, pty.IPty>()
const MAX_BUFFER = 100 * 1024 * 1024; // 100MB

export function registerMcpHandlers(ipcMain: IpcMain) {

  // ─── PROJECTS ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.PROJECTS_LIST, async () => {
    return getDb().select().from(projects).all()
  })

  ipcMain.handle(IPC.PROJECTS_ADD, async (_e: IpcMainInvokeEvent, folderPath?: string) => {
    let targetPath = folderPath
    if (!targetPath) {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        message: 'Select a project folder'
      })
      if (result.canceled || !result.filePaths[0]) return null
      targetPath = result.filePaths[0]
    }
    if (!existsSync(targetPath)) throw new Error('Path does not exist')

    // Try to get context from the MCP server
    let name = targetPath.split('/').pop() ?? 'Project'
    let stack = null
    let description = null
    try {
      const pkgPath = `${targetPath}/package.json`
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf-8'))
        name = pkg.name ?? name
        description = pkg.description ?? null
      }
    } catch {}

    const db = getDb()
    const existing = db.select().from(projects).where(eq(projects.path, targetPath)).get()
    if (existing) return existing

    db.insert(projects).values({ name, path: targetPath, description, stack }).run()
    return db.select().from(projects).where(eq(projects.path, targetPath)).get()
  })

  ipcMain.handle(IPC.PROJECTS_REMOVE, async (_e: IpcMainInvokeEvent, id: number) => {
    getDb().delete(projects).where(eq(projects.id, id)).run()
    return { success: true }
  })

  // ─── GIT ─────────────────────────────────────────────────────────────────────

  const getDevEnv = () => {
    const env = { ...process.env }
    const paths = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin'
    ]
    env.PATH = paths.join(':') + (env.PATH ? `:${env.PATH}` : '')
    return env
  }

  const git = (cmd: string, cwd: string) => {
    try { return { ok: true, out: execSync(cmd, { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() }).trim() } }
    catch (e: any) { return { ok: false, out: e.message as string } }
  }

  ipcMain.handle(IPC.GIT_STATUS, async (_e, cwd: string) => {
    const branch = git('git rev-parse --abbrev-ref HEAD', cwd)
    let statusOut = ''
    try {
      statusOut = execSync('git status --porcelain', { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() })
    } catch {
      statusOut = ''
    }
    const lines = statusOut.split('\n').filter(Boolean)

    const modified: string[] = []
    const untracked: string[] = []
    const staged: string[] = []

    for (const line of lines) {
      if (line.length < 4) continue
      const indexStatus = line[0]
      const workTreeStatus = line[1]
      const file = line.slice(3)

      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(file)
      } else {
        if (indexStatus !== ' ') {
          staged.push(file)
        }
        if (workTreeStatus !== ' ') {
          modified.push(file)
        }
      }
    }

    return {
      branch: branch.out,
      clean: lines.length === 0,
      modified,
      untracked,
      staged,
    }
  })

  ipcMain.handle(IPC.GIT_DIFF, async (_e, cwd: string, filePath?: string) => {
    const fileArg = filePath ? ` -- ${JSON.stringify(filePath)}` : ''
    const unstaged = git(`git diff${fileArg}`, cwd).out
    const staged   = git(`git diff --cached${fileArg}`, cwd).out

    // Untracked files: build a synthetic diff showing full content as additions
    let untrackedFiles: string[] = []
    if (filePath) {
      const checkRes = git(`git ls-files --others --exclude-standard -- ${JSON.stringify(filePath)}`, cwd)
      if (checkRes.ok && checkRes.out.trim()) {
        untrackedFiles = [checkRes.out.trim()]
      }
    } else {
      const untrackedOut = git('git ls-files --others --exclude-standard', cwd).out
      untrackedFiles = untrackedOut.split('\n').filter(Boolean)
    }

    const untrackedDiffs = untrackedFiles
      .map(file => {
        try {
          const fullPath = `${cwd}/${file}`
          if (!existsSync(fullPath)) return ''
          const content = readFileSync(fullPath, 'utf-8')
          const lines = content.split('\n')
          const added = lines.map(l => '+' + l).join('\n')
          return `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${added}`
        } catch { return '' }
      })
      .filter(Boolean)
      .join('\n')

    return [staged, unstaged, untrackedDiffs].filter(Boolean).join('\n') || ''
  })


  ipcMain.handle(IPC.GIT_LOG, async (_e, cwd: string, limit = 20) => {
    const out = git(`git log --oneline -${limit} --pretty=format:"%h|%s|%an|%ar"`, cwd).out
    return out.split('\n').filter(Boolean).map(line => {
      const [hash, message, author, date] = line.split('|')
      return { hash, message, author, date }
    })
  })

  ipcMain.handle(IPC.GIT_COMMIT, async (_e, cwd: string, message: string) => {
    const add = git('git add .', cwd)
    if (!add.ok) return { ok: false, out: 'git add failed: ' + add.out }
    const status = git('git status --porcelain', cwd)
    if (status.out.trim() === '') return { ok: false, out: 'Nothing to commit — working tree clean' }
    return git(`git commit -m ${JSON.stringify(message)}`, cwd)
  })

  ipcMain.handle(IPC.GIT_PUSH, async (_e, cwd: string) => {
    // auto set-upstream if needed
    const branch = git('git rev-parse --abbrev-ref HEAD', cwd).out
    const hasUpstream = git(`git rev-parse --abbrev-ref --symbolic-full-name @{u}`, cwd)
    if (!hasUpstream.ok) {
      return git(`git push --set-upstream origin "${branch}"`, cwd)
    }
    return git('git push', cwd)
  })

  ipcMain.handle(IPC.GIT_BRANCH, async (_e, cwd: string, name: string) => {
    const create = git(`git checkout -b "${name}"`, cwd)
    if (!create.ok) return create
    // push and set upstream immediately so the branch exists on remote
    const push = git(`git push --set-upstream origin "${name}"`, cwd)
    return { ok: push.ok, out: push.ok ? `Branch '${name}' created and pushed` : create.out + '\n(local only — push failed: ' + push.out + ')' }
  })

  ipcMain.handle(IPC.GIT_BRANCHES, async (_e, cwd: string) => {
    const local = git('git branch', cwd)
    const remote = git('git branch -r', cwd)
    const current = git('git rev-parse --abbrev-ref HEAD', cwd)
    const parseBranch = (line: string) => line.replace(/^[* ]+/, '').trim()
    return {
      current: current.out.trim(),
      local: local.out.split('\n').map(parseBranch).filter(Boolean),
      remote: remote.out.split('\n').map(parseBranch).filter(Boolean),
    }
  })

  ipcMain.handle(IPC.GIT_BRANCH_SWITCH, async (_e, cwd: string, name: string) => {
    // if it's a remote-only branch, checkout tracking branch
    const tracking = name.replace(/^origin\//, '')
    const local = git('git branch', cwd)
    const exists = local.out.split('\n').map(b => b.replace(/^[* ]+/, '').trim()).includes(tracking)
    if (exists) return git(`git checkout "${tracking}"`, cwd)
    return git(`git checkout -b "${tracking}" --track "${name}"`, cwd)
  })

  ipcMain.handle(IPC.GIT_PR, async (_e, cwd: string, title: string, body: string, base: string) => {
    // requires gh CLI installed
    try {
      // Auto-push current branch to remote upstream first so gh can create the PR
      try {
        execSync('git push -u origin HEAD', { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() })
      } catch (err) {
        // If push fails, we still proceed so we can capture the original gh error
      }

      const out = execSync(
        `gh pr create --title ${JSON.stringify(title)} --body ${JSON.stringify(body)} --base ${JSON.stringify(base)}`,
        { cwd, encoding: 'utf-8', env: getDevEnv() }
      ).trim()
      return { ok: true, out }
    } catch (e: any) {
      return { ok: false, out: e.message }
    }
  })

  ipcMain.handle(IPC.GIT_SUGGEST_COMMIT, async (_e, cwd: string) => {
    let diff = ''
    try {
      diff = execSync('git diff HEAD', { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() }).trim()
      if (!diff) {
        const untracked = execSync('git status --porcelain', { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() })
          .split('\n')
          .filter(l => l.startsWith('??'))
          .map(l => l.slice(3))
          .join(', ')
        if (untracked) {
          diff = `Untracked files created: ${untracked}`
        }
      }
    } catch {
      try {
        diff = execSync('git diff', { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() }).trim()
      } catch {}
    }

    if (!diff) {
      return { ok: false, error: 'No changes detected. Stage or modify some files first.' }
    }

    if (diff.length > 25000) {
      diff = diff.slice(0, 25000) + '\n\n...[diff truncated for AI context]...'
    }

    const systemPrompt = "You are an expert developer. Analyze the provided git diff of changes. Pay close attention to the specific files changed, functions modified, and content added or removed. Suggest a highly tailored, clean, precise, and concise commit message following the Conventional Commits style, including a component scope in parentheses (e.g., 'feat(git): add sparkles icon to input', 'fix(sidebar): resolve spinner deadlock'). Give ONLY the raw commit message as your single-line response. No explanation, no markdown backticks, no introductory text, no bullet points, no quotes."
    const userMessage = `Here is the git diff:\n\n${diff}`

    if (process.env.GROQ_API_KEY) {
      try {
        const https = require('https')
        const body = JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 150,
        })
        
        return new Promise((resolve) => {
          const req = https.request(
            {
              hostname: 'api.groq.com',
              path: '/openai/v1/chat/completions',
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
            },
            (res: any) => {
              let data = ''
              res.on('data', (chunk: any) => data += chunk)
              res.on('end', () => {
                try {
                  const parsed = JSON.parse(data)
                  const text = parsed?.choices?.[0]?.message?.content?.trim()
                  if (text) {
                    resolve({ ok: true, message: text.replace(/^[`'"]|[`'"]$/g, '') })
                  } else {
                    resolve({ ok: false, error: 'Empty response from Groq' })
                  }
                } catch {
                  resolve({ ok: false, error: 'Failed to parse Groq response' })
                }
              })
            }
          )
          req.on('error', (e: Error) => resolve({ ok: false, error: e.message }))
          req.write(body)
          req.end()
        })
      } catch {
        // Fallback to Ollama
      }
    }

    try {
      const http = require('http')
      const body = JSON.stringify({
        model: 'llama3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false,
      })
      
      return new Promise((resolve) => {
        const req = http.request(
          { hostname: '127.0.0.1', port: 11434, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json' } },
          (res: any) => {
            let data = ''
            res.on('data', (chunk: any) => data += chunk)
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data)
                const text = parsed?.message?.content?.trim()
                if (text) {
                  resolve({ ok: true, message: text.replace(/^[`'"]|[`'"]$/g, '') })
                } else {
                  resolve({ ok: false, error: 'Empty response from Ollama' })
                }
              } catch {
                resolve({ ok: false, error: 'Failed to parse Ollama response' })
              }
            })
          }
        )
        req.on('error', (e: Error) => resolve({ ok: false, error: 'Ollama not running: ' + e.message }))
        req.write(body)
        req.end()
      })
    } catch (e: any) {
      return { ok: false, error: 'No AI model available or configured.' }
    }
  })

  ipcMain.handle(IPC.GIT_SUGGEST_PR, async (_e, cwd: string, base: string) => {
    let diff = ''
    try {
      diff = execSync(`git diff ${base}...`, { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() }).trim()
    } catch {
      try {
        diff = execSync(`git diff ${base}`, { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() }).trim()
      } catch {
        try {
          diff = execSync('git diff HEAD', { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() }).trim()
        } catch {}
      }
    }

    if (!diff) {
      return { ok: false, error: 'No branch differences detected compared to base.' }
    }

    if (diff.length > 25000) {
      diff = diff.slice(0, 25000) + '\n\n...[diff truncated for AI context]...'
    }

    const systemPrompt = `You are a world-class principal developer. Analyze the provided git diff showing differences between the current branch and the base branch.
Suggest a premium, highly professional Pull Request.
Your output MUST be a single, strict, valid JSON object with EXACTLY two keys:
1. "title": A concise, descriptive, and professional PR title following Conventional Commits style (e.g., "feat(ui): add AI-powered Pull Request suggester").
2. "body": A comprehensive, detailed, "pro" markdown-formatted PR description. Use clean headers, bullet points, and highlight modified components/features under "Overview", "Key Changes", and "Testing & Verification".

Do NOT wrap your response in markdown code blocks (\`\`\`json), do NOT include any introductory or conversational text, and do NOT include any backticks or notes. Output ONLY the raw JSON object.`

    const userMessage = `Here is the branch diff:\n\n${diff}`

    const parseSuggestResponse = (rawText: string) => {
      try {
        const start = rawText.indexOf('{')
        const end = rawText.lastIndexOf('}')
        if (start !== -1 && end !== -1 && end > start) {
          const parsed = JSON.parse(rawText.slice(start, end + 1))
          if (parsed && typeof parsed === 'object') {
            return { ok: true, title: parsed.title || '', body: parsed.body || '' }
          }
        }
        return { ok: false, error: 'Failed to extract JSON keys from AI response' }
      } catch (e: any) {
        return { ok: false, error: 'JSON parsing failed: ' + e.message }
      }
    }

    if (process.env.GROQ_API_KEY) {
      try {
        const https = require('https')
        const body = JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1000,
        })
        
        return new Promise((resolve) => {
          const req = https.request(
            {
              hostname: 'api.groq.com',
              path: '/openai/v1/chat/completions',
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
            },
            (res: any) => {
              let data = ''
              res.on('data', (chunk: any) => data += chunk)
              res.on('end', () => {
                try {
                  const parsed = JSON.parse(data)
                  const text = parsed?.choices?.[0]?.message?.content?.trim()
                  if (text) {
                    resolve(parseSuggestResponse(text))
                  } else {
                    resolve({ ok: false, error: 'Empty response from Groq' })
                  }
                } catch {
                  resolve({ ok: false, error: 'Failed to parse Groq response' })
                }
              })
            }
          )
          req.on('error', (e: Error) => resolve({ ok: false, error: e.message }))
          req.write(body)
          req.end()
        })
      } catch {
        // Fallback to Ollama
      }
    }

    try {
      const http = require('http')
      const body = JSON.stringify({
        model: 'llama3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        format: 'json',
        stream: false,
      })
      
      return new Promise((resolve) => {
        const req = http.request(
          { hostname: '127.0.0.1', port: 11434, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json' } },
          (res: any) => {
            let data = ''
            res.on('data', (chunk: any) => data += chunk)
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data)
                const text = parsed?.message?.content?.trim()
                if (text) {
                  resolve(parseSuggestResponse(text))
                } else {
                  resolve({ ok: false, error: 'Empty response from Ollama' })
                }
              } catch {
                resolve({ ok: false, error: 'Failed to parse Ollama response' })
              }
            })
          }
        )
        req.on('error', (e: Error) => resolve({ ok: false, error: 'Ollama not running: ' + e.message }))
        req.write(body)
        req.end()
      })
    } catch (e: any) {
      return { ok: false, error: 'No AI model available or configured.' }
    }
  })

  // ─── TERMINAL (node-pty — real PTY) ────────────────────────────────────────
  ipcMain.handle(IPC.TERM_SPAWN, async (event, id: string, cwd: string) => {
    const os = require('os')
    const shell = process.env.SHELL || '/bin/zsh'
    const safeCwd = existsSync(cwd) ? cwd : os.homedir()
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'ForgeApp',
      HOME: os.homedir(),
      USER: os.userInfo().username,
      SHELL: shell,
      LANG: process.env.LANG || 'en_US.UTF-8',
    }
    const ptyProc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: safeCwd,
      env,
    })
    terminals.set(id, ptyProc)
    ptyProc.onData(data => event.sender.send(IPC.TERM_OUTPUT, id, data))
    ptyProc.onExit(() => {
      terminals.delete(id)
      event.sender.send(IPC.TERM_OUTPUT, id, '\r\n[Process exited]\r\n')
    })
    return { success: true }
  })

  ipcMain.handle(IPC.TERM_INPUT, async (_e, id: string, data: string) => {
    terminals.get(id)?.write(data)
  })

  ipcMain.handle(IPC.TERM_RESIZE, async (_e, id: string, cols: number, rows: number) => {
    terminals.get(id)?.resize(cols, rows)
  })

  ipcMain.handle(IPC.TERM_KILL, async (_e, id: string) => {
    terminals.get(id)?.kill()
    terminals.delete(id)
  })


  // ─── CHAT AI — Groq + Gemini + Ollama streaming ────────────────────────────
  ipcMain.handle(
    IPC.CHAT_AI,
    async (
      event,
      messages: Array<{ role: string; content: string }>,
      projectCtx?: string,
      model: 'groq' | 'gemini' | 'ollama' = 'groq',
      projectPath?: string,
    ) => {
    const https = require('https')
    const http = require('http')
    const path = require('path')

    function buildFileContext(cwd?: string, userQuery = ''): string {
      if (!cwd || !existsSync(cwd)) return ''
      const TREE_IGNORED_DIRS = new Set(['.git', 'node_modules'])
      const SNIPPET_IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-electron', 'out', '.next', '__pycache__'])
      const IGNORED_NAMES = [/^\.env(\..+)?$/, /\.pem$/i, /\.key$/i, /\.crt$/i, /\.p12$/i, /\.pfx$/i]
      const ALLOWED_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py', '.go', '.rs', '.java', '.css', '.scss', '.html', '.yml', '.yaml'])
      const preferred = ['package.json', 'README.md', 'tsconfig.json', 'electron.vite.config.ts', 'vite.config.ts']

      const maxFiles = 30
      const maxCharsPerFile = 4000
      const maxTotalChars = 80000
      const maxTreeLines = 2000

      const selected: string[] = []
      const discovered: string[] = []
      const snippets: string[] = []
      const treeLines: string[] = []
      let totalChars = 0

      for (const rel of preferred) {
        const full = path.join(cwd, rel)
        if (existsSync(full)) selected.push(full)
      }

      function buildTree(dir: string, prefix = '') {
        if (treeLines.length >= maxTreeLines) return
        let entries: string[] = []
        try { entries = readdirSync(dir).sort((a, b) => a.localeCompare(b)) } catch { return }
        const visible = entries.filter(name => {
          if (name === '.DS_Store') return false
          if (TREE_IGNORED_DIRS.has(name)) return false
          return true
        })
        for (let i = 0; i < visible.length; i++) {
          if (treeLines.length >= maxTreeLines) break
          const name = visible[i]
          const full = path.join(dir, name)
          let st: any
          try { st = statSync(full) } catch { continue }
          const isLast = i === visible.length - 1
          const branch = isLast ? '└── ' : '├── '
          const nextPrefix = prefix + (isLast ? '    ' : '│   ')
          treeLines.push(`${prefix}${branch}${name}${st.isDirectory() ? '/' : ''}`)
          if (st.isDirectory()) buildTree(full, nextPrefix)
        }
      }

      function walk(dir: string, depth = 0) {
        if (depth > 6) return
        let entries: string[] = []
        try { entries = readdirSync(dir) } catch { return }
        for (const name of entries) {
          if (name.startsWith('.') && name !== '.eslintrc' && name !== '.prettierrc') continue
          if (SNIPPET_IGNORED_DIRS.has(name)) continue
          if (IGNORED_NAMES.some(rx => rx.test(name))) continue
          const full = path.join(dir, name)
          let st: any
          try { st = statSync(full) } catch { continue }
          if (st.isDirectory()) { walk(full, depth + 1); continue }
          if (st.size > 200 * 1024) continue
          const ext = path.extname(name).toLowerCase()
          if (!ALLOWED_EXTS.has(ext)) continue
          if (!discovered.includes(full)) discovered.push(full)
        }
      }
      treeLines.push(`${path.basename(cwd)}/`)
      buildTree(cwd)
      walk(cwd)

      const query = userQuery.toLowerCase()
      const requestedPaths = new Set<string>()
      const mentionedBasenames = new Set<string>()
      const filePattern = /([a-z0-9_\-./]+\.(ts|tsx|js|jsx|json|md|py|go|rs|java|css|scss|html|yml|yaml))/gi
      for (const m of query.matchAll(filePattern)) {
        requestedPaths.add(m[1])
        mentionedBasenames.add(path.basename(m[1]))
      }
      if (query.includes('index.ts') && query.includes('main')) requestedPaths.add('main/index.ts')
      if (query.includes('index.ts') && query.includes('preload')) requestedPaths.add('preload/index.ts')

      const dirHints = ['main', 'preload', 'renderer', 'shared', 'components', 'panels', 'types', 'src']
        .filter(d => query.includes(d))

      for (const rel of requestedPaths) {
        const full = path.join(cwd, rel.replace(/^\.\//, ''))
        if (existsSync(full) && !selected.includes(full)) selected.push(full)
      }
      // If user mentions a basename (e.g. "index.ts"), prioritize matching files,
      // optionally constrained by directory hints (e.g. "preload folder").
      for (const full of discovered) {
        const rel = path.relative(cwd, full).toLowerCase()
        const base = path.basename(full).toLowerCase()
        if (!mentionedBasenames.has(base)) continue
        if (dirHints.length > 0 && !dirHints.some(h => rel.includes(`${h}/`) || rel.startsWith(`${h}/`))) continue
        if (!selected.includes(full)) selected.push(full)
      }
      for (const full of discovered) {
        if (!selected.includes(full)) selected.push(full)
      }

      for (const full of selected.slice(0, maxFiles)) {
        try {
          const rel = path.relative(cwd, full)
          const content = readFileSync(full, 'utf-8').slice(0, maxCharsPerFile)
          if (!content.trim()) continue
          const block = `\n### File: ${rel}\n\`\`\`\n${content}\n\`\`\`\n`
          if (totalChars + block.length > maxTotalChars) break
          snippets.push(block)
          totalChars += block.length
        } catch {}
      }

      const treeSection = treeLines.length
        ? `\n\nProject tree (generated from filesystem, excludes node_modules and .git):\n${treeLines.join('\n')}\n`
        : ''
      const snippetSection = snippets.length
        ? `\n\nAttached project file context (truncated, read-only snapshot):${snippets.join('')}`
        : ''
      return `${treeSection}${snippetSection}`
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find(m => m.role === 'user')
      ?.content
      ?.trim()
      .toLowerCase() ?? ''
    const isGreetingOnly = /^(hi|hello|hey|yo|sup|hola|salam|good morning|good afternoon|good evening)[!. ]*$/.test(lastUserMessage)

    const systemPromptBase = projectCtx
      ? `You are Forge AI, an expert coding assistant embedded in a desktop IDE.\nActive project context:\n${projectCtx}\n\nYou help the developer understand, write, debug, and improve code. Be concise and precise.`
      : `You are Forge AI, an expert coding assistant. Be concise, precise, and helpful.`
    const fileContext = isGreetingOnly ? '' : buildFileContext(projectPath, lastUserMessage)
    const systemPrompt = `${systemPromptBase}

General behavior:
- If the user sends only a greeting, respond naturally and briefly, then ask what they want to do.
- Do not mention hidden/system/project context unless the user asks for code/project details.
- You have access to the attached project tree and file snapshots below. Do NOT claim you cannot access files.
- If a requested file is present in the tree/snapshots, answer using it directly.
- Only say a file is missing after checking the provided project tree.

When the user asks for project files/tree/structure:
- Use ONLY the provided "Project tree" section from context.
- Do not invent, rename, or omit paths from that section.
- If user asks for "full tree", return the full tree block exactly as provided (except node_modules/.git exclusion already applied).
${fileContext}`

    // ── helper: parse SSE stream and fire tokens ──────────────────────────────
    function pipeSSE(res: any, getToken: (parsed: any) => string | undefined, isDone?: (parsed: any) => boolean) {
      if ((res.statusCode ?? 500) >= 400) {
        let errBody = ''
        res.on('data', (chunk: Buffer) => { errBody += chunk.toString() })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(errBody)
            const msg = parsed?.error?.message || parsed?.message || `AI request failed (${res.statusCode})`
            event.sender.send(IPC.CHAT_AI_ERROR, msg)
          } catch {
            event.sender.send(IPC.CHAT_AI_ERROR, errBody || `AI request failed (${res.statusCode})`)
          }
        })
        res.on('error', (e: Error) => event.sender.send(IPC.CHAT_AI_ERROR, e.message))
        return
      }

      let buffer = ''
      let doneSent = false
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const json = trimmed.slice(5).trim()
          if (!json || json === '[DONE]') continue
          try {
            const parsed = JSON.parse(json)
            if (isDone?.(parsed)) {
              if (!doneSent) event.sender.send(IPC.CHAT_AI_DONE)
              doneSent = true
              return
            }
            const token = getToken(parsed)
            if (token) event.sender.send(IPC.CHAT_AI_TOKEN, token)
          } catch {}
        }
      })
      res.on('end', () => {
        if (!doneSent) event.sender.send(IPC.CHAT_AI_DONE)
      })
      res.on('error', (e: Error) => event.sender.send(IPC.CHAT_AI_ERROR, e.message))
    }

    function pipeJsonLines(res: any, getToken: (parsed: any) => string | undefined, isDone?: (parsed: any) => boolean) {
      if ((res.statusCode ?? 500) >= 400) {
        let errBody = ''
        res.on('data', (chunk: Buffer) => { errBody += chunk.toString() })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(errBody)
            const msg = parsed?.error || parsed?.message || `AI request failed (${res.statusCode})`
            event.sender.send(IPC.CHAT_AI_ERROR, msg)
          } catch {
            event.sender.send(IPC.CHAT_AI_ERROR, errBody || `AI request failed (${res.statusCode})`)
          }
        })
        res.on('error', (e: Error) => event.sender.send(IPC.CHAT_AI_ERROR, e.message))
        return
      }

      let buffer = ''
      let doneSent = false
      let tokenCount = 0
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            if (isDone?.(parsed)) {
              if (!doneSent) {
                if (tokenCount === 0) {
                  event.sender.send(
                    IPC.CHAT_AI_ERROR,
                    'Ollama returned an empty response. Ensure the model is installed (e.g. `ollama pull llama3.1:8b`) and try again.'
                  )
                } else {
                  event.sender.send(IPC.CHAT_AI_DONE)
                }
              }
              doneSent = true
              return
            }
            const token = getToken(parsed)
            if (token) {
              tokenCount++
              event.sender.send(IPC.CHAT_AI_TOKEN, token)
            }
          } catch {}
        }
      })
      res.on('end', () => {
        if (!doneSent) {
          if (tokenCount === 0) {
            event.sender.send(
              IPC.CHAT_AI_ERROR,
              'Ollama stream ended without text. Check that Ollama is running and the selected model exists locally.'
            )
          } else {
            event.sender.send(IPC.CHAT_AI_DONE)
          }
        }
      })
      res.on('error', (e: Error) => event.sender.send(IPC.CHAT_AI_ERROR, e.message))
    }

    if (model === 'ollama') {
      // ── Local Ollama (default model: llama3.1:8b) ─────────────────────────
      const body = JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
      })
      const req = http.request(
        { hostname: '127.0.0.1', port: 11434, path: '/api/chat', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res: any) => pipeJsonLines(
          res,
          parsed => parsed?.message?.content,
          parsed => parsed?.done === true,
        )
      )
      req.on('error', () => {
        event.sender.send(
          IPC.CHAT_AI_ERROR,
          'Cannot connect to Ollama on http://127.0.0.1:11434. Start Ollama first (e.g. `ollama serve`).'
        )
      })
      req.write(body)
      req.end()
    } else if (model === 'gemini') {
      // ── Gemini 2.0 Flash ────────────────────────────────────────────────────
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY
      if (!GEMINI_API_KEY) {
        event.sender.send(IPC.CHAT_AI_ERROR, 'GEMINI_API_KEY not found in environment')
        return
      }
      // Convert messages: assistant → model role, merge with system instruction
      const geminiContents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }))
      const body = JSON.stringify({
        contents: geminiContents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 2048 },
      })
      const path = `/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`
      const req = https.request(
        { hostname: 'generativelanguage.googleapis.com', path, method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res: any) => pipeSSE(
          res,
          parsed => {
            const parts = parsed?.candidates?.[0]?.content?.parts
            if (!Array.isArray(parts)) return undefined
            return parts.map((p: any) => p?.text).filter(Boolean).join('')
          },
        )
      )
      req.on('error', (e: Error) => event.sender.send(IPC.CHAT_AI_ERROR, e.message))
      req.write(body)
      req.end()
    } else {
      // ── Groq — Llama 4 Scout ────────────────────────────────────────────────
      const GROQ_API_KEY = process.env.GROQ_API_KEY
      if (!GROQ_API_KEY) {
        event.sender.send(IPC.CHAT_AI_ERROR, 'GROQ_API_KEY not found in environment')
        return
      }
      const body = JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
        max_tokens: 2048,
      })
      const req = https.request(
        { hostname: 'api.groq.com', path: '/openai/v1/chat/completions', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Length': Buffer.byteLength(body) } },
        (res: any) => pipeSSE(
          res,
          parsed => parsed.choices?.[0]?.delta?.content,
        )
      )
      req.on('error', (e: Error) => event.sender.send(IPC.CHAT_AI_ERROR, e.message))
      req.write(body)
      req.end()
    }
  })

  // ─── CHAT SESSIONS ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.CHAT_SESSION_NEW, async (_e, title: string, projectId?: number) => {
    const db = getDb()
    db.insert(chatSessions).values({ title: title || 'New Chat', projectId: projectId ?? null }).run()
    return db.select().from(chatSessions).all()
  })

  ipcMain.handle(IPC.CHAT_SESSION_DELETE, async (_e, sessionId: number) => {
    const db = getDb()
    db.delete(chatSessions).where(eq(chatSessions.id, sessionId)).run()
    return { success: true }
  })

  ipcMain.handle(IPC.CHAT_SESSIONS, async (_e, projectId?: number) => {
    const db = getDb()
    if (projectId) return db.select().from(chatSessions).where(eq(chatSessions.projectId, projectId)).all()
    return db.select().from(chatSessions).all()
  })

  ipcMain.handle(IPC.CHAT_MESSAGES, async (_e, sessionId: number) => {
    return getDb().select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).all()
  })

  ipcMain.handle(IPC.CHAT_SEND, async (_e, sessionId: number, role: string, content: string) => {
    getDb().insert(chatMessages).values({ sessionId, role, content }).run()
    return { success: true }
  })

  // ─── CONTEXT ─────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.CONTEXT_GET, async (_e, cwd: string) => {
    try {
      const ctxPath = `${cwd}/.mcp-context.json`
      if (existsSync(ctxPath)) {
        return JSON.parse(require('fs').readFileSync(ctxPath, 'utf-8'))
      }
      return null
    } catch { return null }
  })

  ipcMain.handle(IPC.CONTEXT_INDEX, async (_e, cwd: string) => {
    try {
      const fs = require('fs')
      const path = require('path')

      // Count files and lines
      const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-electron', 'out', '.next', '__pycache__'])
      const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.css', '.scss', '.html', '.json', '.md'])
      let fileCount = 0
      let totalLines = 0
      const keyFiles: string[] = []
      const KEY_NAMES = ['package.json', 'README.md', 'tsconfig.json', 'vite.config.ts', 'electron.vite.config.ts', 'Cargo.toml', 'go.mod', 'pyproject.toml']

      function walk(dir: string, depth = 0) {
        if (depth > 6) return
        try {
          for (const name of fs.readdirSync(dir)) {
            if (IGNORED_DIRS.has(name) || name.startsWith('.')) continue
            const full = path.join(dir, name)
            const stat = fs.statSync(full)
            if (stat.isDirectory()) { walk(full, depth + 1); continue }
            if (KEY_NAMES.includes(name) && depth <= 1) keyFiles.push(path.relative(cwd, full))
            const ext = path.extname(name)
            if (!CODE_EXTS.has(ext)) continue
            fileCount++
            try {
              const content = fs.readFileSync(full, 'utf-8')
              totalLines += content.split('\n').length
            } catch {}
          }
        } catch {}
      }
      walk(cwd)

      // Git info
      let branch = 'unknown'
      let clean = true
      let lastCommit = 'No commits yet'
      try { branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() }).trim() } catch {}
      try { clean = execSync('git status --porcelain', { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() }).trim() === '' } catch {}
      try { lastCommit = execSync('git log -1 --pretty=format:"%h %s (%ar)"', { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER, env: getDevEnv() }).trim() } catch {}

      // Stack detection
      let stack = 'Unknown'
      try {
        const pkgPath = path.join(cwd, 'package.json')
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
          const deps = { ...pkg.dependencies, ...pkg.devDependencies }
          const tags: string[] = []
          if (deps['electron']) tags.push('Electron')
          if (deps['react']) tags.push('React')
          if (deps['vite']) tags.push('Vite')
          if (deps['typescript'] || deps['ts-node']) tags.push('TypeScript')
          if (deps['tailwindcss']) tags.push('Tailwind')
          if (deps['next']) tags.push('Next.js')
          if (deps['express']) tags.push('Express')
          stack = tags.join(' + ') || 'Node.js'
        }
      } catch {}

      const context = { branch, clean, lastCommit, fileCount, totalLines, stack, keyFiles: keyFiles.slice(0, 8), indexedAt: new Date().toISOString() }
      fs.writeFileSync(path.join(cwd, '.mcp-context.json'), JSON.stringify(context, null, 2))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}

// NOTE: FILE_LIST and FILE_READ handlers — appended

export function registerFileHandlers() {
  const { ipcMain } = require('electron')
  const IGNORED = new Set(['.git', 'node_modules', '.DS_Store', 'dist', 'dist-electron', 'out', '.next', '__pycache__'])

  function buildTree(dir: string, depth = 0): any[] {
    if (depth > 6) return []
    try {
      return readdirSync(dir)
        .filter(n => !IGNORED.has(n) && !n.startsWith('.'))
        .sort((a, b) => {
          const aIsDir = statSync(`${dir}/${a}`).isDirectory()
          const bIsDir = statSync(`${dir}/${b}`).isDirectory()
          if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
          return a.localeCompare(b)
        })
        .map(name => {
          const path = `${dir}/${name}`
          const isDir = statSync(path).isDirectory()
          return { name, path, isDir, children: isDir ? buildTree(path, depth + 1) : [] }
        })
    } catch { return [] }
  }

  ipcMain.handle('files:list', (_e: any, cwd: string) => buildTree(cwd))
  ipcMain.handle('files:read', (_e: any, path: string) => {
    try { return { ok: true, content: readFileSync(path, 'utf-8') } }
    catch (e: any) { return { ok: false, error: e.message } }
  })
  ipcMain.handle('files:write', (_e: any, path: string, content: string) => {
    try { writeFileSync(path, content, 'utf-8'); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })
  ipcMain.handle('files:rename', (_e: any, oldPath: string, newPath: string) => {
    try { renameSync(oldPath, newPath); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })
  ipcMain.handle('files:delete', (_e: any, path: string) => {
    try { rmSync(path, { recursive: true, force: true }); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })
  ipcMain.handle('files:mkdir', (_e: any, path: string) => {
    try { mkdirSync(path, { recursive: true }); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })
  ipcMain.handle('files:newfile', (_e: any, path: string) => {
    try { writeFileSync(path, '', 'utf-8'); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  const BINARY_EXTS = new Set([
    'png','jpg','jpeg','gif','svg','ico','webp','bmp',
    'ttf','woff','woff2','eot','otf',
    'mp3','mp4','wav','ogg','webm',
    'zip','tar','gz','dmg','pkg','exe',
    'pdf','lock',
  ])

  ipcMain.handle('files:search', (_e: any, cwd: string, query: string, opts: { matchCase?: boolean; regex?: boolean } = {}) => {
    if (!query.trim()) return { ok: true, results: [] }

    const escaped = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const parseOutput = (raw: string, isGitGrep: boolean) => {
      const results: { file: string; line: number; text: string }[] = []
      for (const l of raw.split('\n')) {
        if (!l) continue
        const m = l.match(isGitGrep ? /^([^:]+?):(\d+):(.*)$/ : /^\.\/(.+?):(\d+):(.*)$/)
        if (!m) continue
        const [, relPath, lineStr, text] = m
        const ext = relPath.split('.').pop()?.toLowerCase() ?? ''
        if (BINARY_EXTS.has(ext)) continue
        results.push({ file: relPath, line: parseInt(lineStr, 10), text: text.trim() })
        if (results.length >= 500) break
      }
      return results
    }

    try {
      // 1. Lightning fast search using git grep (respects .gitignore, ignores binaries automatically)
      const gitFlags = ['-n', '-I', '--untracked']
      if (!opts.matchCase) gitFlags.push('-i')
      
      const raw = execSync(
        `git grep ${gitFlags.join(' ')} -e ${JSON.stringify(escaped)} -- .`,
        { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER }
      )
      return { ok: true, results: parseOutput(raw, true) }
    } catch (e: any) {
      // Exit code 1 means "no matches found" in git grep — which is success
      if (e.status === 1) return { ok: true, results: [] }

      // 2. Fallback to standard grep if not a git repository (or other failure)
      try {
        const flags = ['-rn', '--include=*.*', '--color=never']
        if (!opts.matchCase) flags.push('-i')
        const ignoreDirs = ['node_modules', '.git', 'dist', 'dist-electron', 'out', '.next', '__pycache__']
        const excludeDirs = ignoreDirs.map(d => `--exclude-dir=${d}`).join(' ')
        const raw = execSync(
          `grep ${flags.join(' ')} ${excludeDirs} -e ${JSON.stringify(escaped)} .`,
          { cwd, encoding: 'utf-8', maxBuffer: MAX_BUFFER }
        )
        return { ok: true, results: parseOutput(raw, false) }
      } catch (fallbackErr: any) {
        if (fallbackErr.status === 1) return { ok: true, results: [] }
        return { ok: false, error: fallbackErr.message }
      }
    }
  })
}
