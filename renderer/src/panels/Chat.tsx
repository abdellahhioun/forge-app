import { useEffect, useRef, useState, useCallback } from 'react'
import { useForgeStore } from '../store'
import { Send, Plus, MessageSquare, Zap, AlertCircle, Trash2, Paperclip, X as XIcon, History } from 'lucide-react'
import type { ChatSession, ChatMessage, AiModel } from '../../../shared/types'

// ─── CodeBlock with Copy + Apply buttons ──────────────────────────────────
function CodeBlock({ lang, code, onApply }: { lang: string; code: string; onApply?: (code: string) => void }) {
  const [copied, setCopied] = useState(false)
  const [applied, setApplied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const apply = () => {
    onApply?.(code)
    setApplied(true); setTimeout(() => setApplied(false), 2500)
  }
  return (
    <div style={{ margin: '8px 0', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--brd)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '3px 8px', background: 'var(--offset)', borderBottom: '1px solid var(--brd)',
      }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--faint)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          {lang || 'code'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={copy} title="Copy code" style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
            background: copied ? 'rgba(79,152,163,.15)' : 'transparent',
            color: copied ? 'var(--pri)' : 'var(--faint)',
            border: '1px solid var(--brd)', transition: 'all .15s',
          }}>{copied ? '✓ Copied' : 'Copy'}</button>
          {onApply && (
            <button onClick={apply} title="Apply to active file" style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
              background: applied ? 'rgba(79,152,163,.25)' : 'var(--pri)',
              color: '#fff', border: 'none', transition: 'all .15s', fontWeight: 600,
            }}>{applied ? '✓ Applied!' : '⚡ Apply'}</button>
          )}
        </div>
      </div>
      <pre style={{
        margin: 0, padding: '10px 12px', background: 'var(--bg)', fontSize: 12,
        overflowX: 'auto', lineHeight: 1.6,
        fontFamily: 'var(--font-mono, "Fira Code", monospace)', color: 'var(--txt)',
      }}><code>{code}</code></pre>
    </div>
  )
}

// ─── Tiny inline markdown renderer ─────────────────────────────────────────
function renderMarkdown(text: string, onApply?: (code: string) => void): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g)
  parts.forEach((part, i) => {
    if (part.startsWith('```')) {
      const lines = part.slice(3).split('\n')
      const lang = lines[0].trim()
      const code = lines.slice(1).join('\n').replace(/```$/, '').trimEnd()
      nodes.push(<CodeBlock key={i} lang={lang} code={code} onApply={onApply} />)
    } else if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1)
      nodes.push(
        <code key={i} style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85em',
          background: 'var(--offset)', border: '1px solid var(--brd)',
          borderRadius: 4, padding: '1px 5px', color: 'var(--txt)',
        }}>{code}</code>
      )
    } else {
      const inline = part.split(/(\*\*[^*]+\*\*|\n)/g)
      inline.forEach((seg, j) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          nodes.push(<strong key={`${i}-${j}`}>{seg.slice(2, -2)}</strong>)
        } else if (seg === '\n') {
          nodes.push(<br key={`${i}-${j}`} />)
        } else {
          nodes.push(<span key={`${i}-${j}`}>{seg}</span>)
        }
      })
    }
  })
  return nodes
}


// ─── Tool call card ─────────────────────────────────────────────────────
const TOOL_ICONS: Record<string, string> = {
  git_diff: '📄', git_status: '📊', git_log: '📜', git_commit: '✅',
  run_tests: '🧪', lint_file: '🔍', read_file: '📖',
  list_files: '📁', explain_code: '🧠', get_dependency_graph: '🕸',
}
function ToolCallCard({ tool, status, result }: {
  tool: string; status: 'running' | 'done' | 'error'; result?: string
}) {
  return (
    <div style={{ border: '1px solid var(--brd)', borderRadius: 8, overflow: 'hidden', margin: '4px 0', fontSize: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', background: 'var(--offset)',
        borderBottom: result ? '1px solid var(--brd)' : 'none',
      }}>
        <span>{TOOL_ICONS[tool] ?? '⚙️'}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--pri)', fontWeight: 600 }}>{tool}</span>
        <span style={{
          marginLeft: 'auto', fontSize: 11,
          color: status === 'done' ? 'var(--pri)' : status === 'error' ? '#f87171' : 'var(--faint)',
        }}>
          {status === 'running' ? '⏳ running…' : status === 'done' ? '✓ done' : '✗ error'}
        </span>
      </div>
      {result && (
        <pre style={{
          margin: 0, padding: '10px 12px', background: 'var(--bg)', fontSize: 11,
          overflowX: 'auto', lineHeight: 1.6, fontFamily: 'var(--font-mono)',
          color: 'var(--txt)', maxHeight: 300, overflowY: 'auto',
        }}>{result}</pre>
      )}
    </div>
  )
}

// ─── Typing dots ─────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--pri)',
          animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: .4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Message bubble ──────────────────────────────────────────────────────────
function MessageBubble({ msg, isStreaming, onApply }: { msg: ChatMessage; isStreaming?: boolean; onApply?: (code: string) => void }) {
  const isUser = msg.role === 'user'
  const isError = (msg as any).isError
  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 8, alignItems: 'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'var(--pri)' : isError ? 'var(--err, #7a2020)' : 'var(--offset)',
        border: '1px solid var(--brd)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
        color: isUser ? '#fff' : 'var(--muted)',
        marginTop: 2,
      }}>
        {isUser ? 'A' : isError ? <AlertCircle size={12} /> : <Zap size={11} />}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '76%', minWidth: 40,
        background: isUser ? 'var(--pri-glow)' : isError ? 'rgba(255,60,60,.06)' : 'var(--surface)',
        border: `1px solid ${
          isUser ? 'rgba(79,152,163,.3)' : isError ? 'rgba(255,60,60,.3)' : 'var(--brd)'
        }`,
        borderRadius: isUser
          ? 'var(--r3) var(--r1) var(--r3) var(--r3)'
          : 'var(--r1) var(--r3) var(--r3) var(--r3)',
        padding: '9px 13px',
        fontSize: 13, lineHeight: 1.65,
        color: isError ? 'var(--err-txt, #f87171)' : 'var(--txt)',
        userSelect: 'text',
      }}>
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
        ) : msg.content.startsWith('__TOOL__:') ? (
          (() => {
            const parts = msg.content.slice('__TOOL__:'.length).split(':')
            const tool = parts[0]
            const rest = parts.slice(1).join(':')
            const nlIdx = rest.indexOf('\n')
            const status = (nlIdx === -1 ? rest : rest.slice(0, nlIdx)) as 'running' | 'done' | 'error'
            const result = nlIdx === -1 ? undefined : rest.slice(nlIdx + 1)
            return <ToolCallCard tool={tool} status={status} result={result} />
          })()
        ) : isStreaming && msg.content === '' ? (
          <TypingDots />
        ) : (
          renderMarkdown(msg.content, onApply)
        )}
        <style>{`
          @keyframes cursorblink { 0%,100%{opacity:1} 50%{opacity:0} }
        `}</style>
      </div>
    </div>
  )
}

// ─── Model toggle ────────────────────────────────────────────────────────────
const MODEL_OPTIONS: { id: AiModel; label: string; sub: string }[] = [
  { id: 'groq',   label: 'Llama 4',  sub: 'Groq'   },
  { id: 'gemini', label: 'Gemini 2', sub: 'Google' },
  { id: 'ollama', label: 'Qwen 2.5', sub: 'Local' },
]

function ModelToggle({ value, onChange }: { value: AiModel; onChange: (m: AiModel) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '6px 10px',
      borderTop: '1px solid var(--brd)',
    }}>
      {MODEL_OPTIONS.map(opt => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              flex: 1, padding: '5px 6px', borderRadius: 'var(--r2)',
              fontSize: 11, lineHeight: 1.3, textAlign: 'center',
              background: active ? 'var(--pri-glow)' : 'transparent',
              border: `1px solid ${active ? 'rgba(79,152,163,.35)' : 'var(--brd)'}`,
              color: active ? 'var(--pri)' : 'var(--faint)',
              transition: 'all .15s', cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 600 }}>{opt.label}</div>
            <div style={{ fontSize: 9, opacity: .7 }}>{opt.sub}</div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Main panel ─────────────────────────────────────────────────────────────
export default function ChatPanel() {
  const { activeProject, activeFile, openFiles, updateFileContent, markFileSaved, setPendingDiff } = useForgeStore()

  // ─── Apply AI code block to active file ─────────────────────────────────────
  const onApply = useCallback(async (code: string) => {
    if (!activeFile) return
    const currentFile = openFiles.find(f => f.path === activeFile)
    if (!currentFile) return
    
    setPendingDiff({
      path: activeFile,
      original: currentFile.content,
      modified: code
    })
  }, [activeFile, openFiles, setPendingDiff])

  // ─── MCP tool intent detection ───────────────────────────────────────────────
  const TOOL_INTENTS = [
    { pattern: /git diff|what changed|show diff/i,            tool: 'git_diff' },
    { pattern: /git status|what.?s staged|unstaged/i,         tool: 'git_status' },
    { pattern: /git log|recent commits|commit history/i,      tool: 'git_log' },
    { pattern: /run tests?|test suite|npm test/i,             tool: 'run_tests' },
    { pattern: /lint|eslint|code issues|code quality/i,       tool: 'lint_file' },
    { pattern: /list files|file tree|show files|what files/i, tool: 'list_files' },
    { pattern: /explain.*(this |the )?code|analyse.*file|what does.*do/i, tool: 'explain_code' },
    { pattern: /dependency graph|import graph|who imports/i,  tool: 'get_dependency_graph' },
  ]

  const runTool = useCallback(async (tool: string): Promise<string> => {
    const args: Record<string, unknown> = { cwd: activeProject?.path ?? '' }
    if (tool === 'lint_file' || tool === 'explain_code' || tool === 'read_file') {
      args.filePath = activeFile ?? ''
    }
    const result = await (window.forge as any).tools.run(tool, args)
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  }, [activeProject, activeFile])

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [model, setModel] = useState<AiModel>('groq')
  const [sidebarWidth, setSidebarWidth] = useState(210)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamingIdRef = useRef<string | null>(null)
  const activeSessionRef = useRef<ChatSession | null>(null)
  const isResizingRef = useRef(false)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(210)

  // ─── @file context state ──────────────────────────────────────────────────
  const [atQuery, setAtQuery] = useState<string | null>(null)       // null = picker closed
  const [atResults, setAtResults] = useState<string[]>([])
  const [attachedFiles, setAttachedFiles] = useState<{ path: string; content: string }[]>([])
  const atIndexRef = useRef(0)

  // ─── Auto-inject active file when it changes (split mode) ────────────────
  useEffect(() => {
    if (!activeFile) return
    const fileObj = openFiles.find(f => f.path === activeFile)
    if (!fileObj) return
    setAttachedFiles(prev => {
      const filtered = prev.filter(f => f.path !== activeFile)
      return [{ path: activeFile, content: fileObj.content }, ...filtered]
    })
  }, [activeFile, openFiles])

  // ─── Load sessions & reset active session when project changes ──────────
  useEffect(() => {
    window.forge.chat.sessions(activeProject?.id).then(setSessions)
    setActiveSession(null)
    setMessages([])
    setAttachedFiles([])
  }, [activeProject])

  // ─── Sync activeSession to ref (for use in effect closures) ─────────────
  useEffect(() => {
    activeSessionRef.current = activeSession
  }, [activeSession])

  // ─── Load messages ───────────────────────────────────────────────────────
  useEffect(() => {
    if (activeSession) {
      window.forge.chat.messages(activeSession.id).then(setMessages)
    }
  }, [activeSession])

  // ─── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─── Sidebar resize handling ─────────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const delta = e.clientX - resizeStartXRef.current
      const next = resizeStartWidthRef.current + delta
      const clamped = Math.max(180, Math.min(420, next))
      setSidebarWidth(clamped)
    }
    const onMouseUp = () => {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // ─── Register stream listeners once ──────────────────────────────────────
  useEffect(() => {
    const offToken = window.forge.chat.onToken((token: string) => {
      setMessages(prev => prev.map(m =>
        m.id === streamingIdRef.current
          ? { ...m, content: m.content + token }
          : m
      ))
    })
    const offDone = window.forge.chat.onDone(() => {
      setIsStreaming(false)
      // Persist the completed AI reply to DB
      setMessages(prev => {
        const aiMsg = prev.find(m => m.id === streamingIdRef.current)
        if (aiMsg && activeSessionRef.current) {
          window.forge.chat.send(activeSessionRef.current.id, 'assistant', aiMsg.content)
        }
        streamingIdRef.current = null
        return prev
      })
    })
    const offError = window.forge.chat.onError((err: string) => {
      setIsStreaming(false)
      const sid = streamingIdRef.current
      streamingIdRef.current = null
      const errMsg: ChatMessage = {
        id: Math.random().toString(36),
        role: 'assistant',
        content: `Error: ${err}`,
        createdAt: new Date().toISOString(),
        isError: true,
      } as any
      setMessages(prev => [
        ...prev.filter(m => m.id !== sid),
        errMsg,
      ])
    })
    return () => { offToken?.(); offDone?.(); offError?.() }
  }, [])

  // ─── New session ─────────────────────────────────────────────────────────
  const newSession = useCallback(async () => {
    const title = `Chat ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    const updated = await window.forge.chat.newSession(title, activeProject?.id)
    setSessions(updated)
    const newest = [...updated].sort((a, b) => b.id - a.id)[0]
    if (newest) { setActiveSession(newest); setMessages([]) }
  }, [activeProject])

  const deleteSession = useCallback(async (sessionId: number) => {
    const previousSessions = sessions
    const wasActive = activeSessionRef.current?.id === sessionId

    // Optimistic UI update for instant feedback
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (wasActive) {
      setActiveSession(null)
      setMessages([])
      activeSessionRef.current = null
    }

    try {
      if (!window.forge.chat.deleteSession) {
        throw new Error('deleteSession API is unavailable. Please restart the app.')
      }
      await window.forge.chat.deleteSession(sessionId)
      // Re-sync from DB to ensure renderer and storage stay aligned
      const updated = await window.forge.chat.sessions(activeProject?.id)
      setSessions(updated)
    } catch (e: any) {
      // Rollback optimistic state if delete failed
      setSessions(previousSessions)
      if (wasActive) {
        const prevActive = previousSessions.find(s => s.id === sessionId) ?? null
        setActiveSession(prevActive)
        activeSessionRef.current = prevActive
        if (prevActive) {
          const msgs = await window.forge.chat.messages(prevActive.id)
          setMessages(msgs)
        }
      }
      alert(e?.message || 'Failed to delete chat session')
    }
  }, [sessions, activeProject?.id])

  // ─── Send ────────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    if (!input.trim() || !activeSession || isStreaming) return
    const rawContent = input.trim()

    // ── MCP tool intent detection ───────────────────────────────────────
    const matched = TOOL_INTENTS.find(t => t.pattern.test(rawContent))
    if (matched && activeProject?.path) {
      setInput('')
      setAttachedFiles([])
      setTimeout(() => inputRef.current?.focus(), 0)

      // User message
      const userMsg: ChatMessage = {
        id: Math.random().toString(36), role: 'user',
        content: rawContent, createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, userMsg])
      await window.forge.chat.send(activeSession.id, 'user', rawContent)

      // Tool card — running state
      const toolMsgId = Math.random().toString(36)
      setMessages(prev => [...prev, {
        id: toolMsgId, role: 'assistant',
        content: `__TOOL__:${matched.tool}:running`,
        createdAt: new Date().toISOString(),
      }])
      setIsStreaming(true)

      try {
        const result = await runTool(matched.tool)

        // Update card to done
        setMessages(prev => prev.map(m =>
          m.id === toolMsgId
            ? { ...m, content: `__TOOL__:${matched.tool}:done\n${result}` }
            : m
        ))

        // Stream AI summary of the tool result
        const aiId = Math.random().toString(36)
        streamingIdRef.current = aiId
        setMessages(prev => [...prev, {
          id: aiId, role: 'assistant', content: '',
          createdAt: new Date().toISOString(),
        }])
        const history = [
          ...messages, userMsg,
          { role: 'assistant', content: `Tool \`${matched.tool}\` output:\n${result}` },
          { role: 'user', content: 'Give a brief, useful summary of this output.' },
        ].slice(-20).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
        window.forge.chat.ai(history, undefined, model, activeProject.path)
      } catch (err: any) {
        setMessages(prev => prev.map(m =>
          m.id === toolMsgId
            ? { ...m, content: `__TOOL__:${matched.tool}:error\n${err.message}` }
            : m
        ))
        setIsStreaming(false)
      }
      return
    }

    // ── Normal AI send ──────────────────────────────────────────────
    setInput('')
    setAttachedFiles([]) // clear pills after send
    setTimeout(() => inputRef.current?.focus(), 0)

    // Prepend attached file contents as code blocks
    const fileBlocks = attachedFiles
      .map(f => {
        const ext = f.path.split('.').pop() ?? ''
        return `**@${f.path.split('/').pop()}** \`${f.path}\`\n\`\`\`${ext}\n${f.content}\n\`\`\``
      })
      .join('\n\n')
    const content = fileBlocks ? `${fileBlocks}\n\n${rawContent}` : rawContent

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: Math.random().toString(36),
      role: 'user',
      content: attachedFiles.length
        ? `📎 ${attachedFiles.map(f => f.path.split('/').pop()).join(', ')}\n\n${rawContent}`
        : rawContent,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    await window.forge.chat.send(activeSession.id, 'user', userMsg.content)

    // Add empty assistant message as streaming target
    const aiId = Math.random().toString(36)
    streamingIdRef.current = aiId
    const aiMsg: ChatMessage = {
      id: aiId, role: 'assistant', content: '',
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, aiMsg])
    setIsStreaming(true)

    // Build history (last 20 messages)
    const history = [...messages, { ...userMsg, content }]
      .slice(-20)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

    // Optionally inject project context
    let projectCtx: string | undefined
    if (activeProject?.path) {
      try {
        const ctx = await window.forge.context.get(activeProject.path)
        if (ctx) projectCtx = JSON.stringify(ctx, null, 2)
      } catch {}
    }

    window.forge.chat.ai(history, projectCtx, model, activeProject?.path)
  }, [input, attachedFiles, activeSession, isStreaming, messages, activeProject, model, runTool])
  // ─── Textarea auto-resize + @file detection ──────────────────────────────
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
    const atMatch = val.match(/@([\.\w/\-]*)$/)
    if (atMatch) {
      const query = atMatch[1].toLowerCase()
      setAtQuery(query)
      atIndexRef.current = 0
      if (activeProject?.path) {
        window.forge.files.list(activeProject.path)
          .then((files: string[]) =>
            setAtResults(files.filter(f => f.toLowerCase().includes(query)).slice(0, 8))
          ).catch(() => setAtResults([]))
      }
    } else { setAtQuery(null); setAtResults([]) }
  }

  // ─── @file keyboard nav ────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (atQuery !== null && atResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); atIndexRef.current = (atIndexRef.current + 1) % atResults.length; setAtResults(r => [...r]); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); atIndexRef.current = (atIndexRef.current - 1 + atResults.length) % atResults.length; setAtResults(r => [...r]); return }
      if (e.key === 'Tab' || (e.key === 'Enter')) { e.preventDefault(); attachFile(atResults[atIndexRef.current]); return }
      if (e.key === 'Escape')    { setAtQuery(null); setAtResults([]); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ─── Attach a file ─────────────────────────────────────────────────────────
  const attachFile = useCallback(async (filePath: string) => {
    if (!attachedFiles.find(f => f.path === filePath)) {
      try {
        const res = await window.forge.files.read(filePath)
        const content = typeof res === 'string' ? res : (res?.content ?? '')
        setAttachedFiles(prev => [...prev, { path: filePath, content: String(content) }])
      } catch { setAttachedFiles(prev => [...prev, { path: filePath, content: '(could not read)' }]) }
    }
    setInput(prev => prev.replace(/@[\.\w/\-]*$/, ''))
    setAtQuery(null); setAtResults([])
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [attachedFiles])

  const removeAttached = (path: string) => setAttachedFiles(prev => prev.filter(f => f.path !== path))

  const [historyOpen, setHistoryOpen] = useState(false)

  // Model label helper
  const modelLabel = model === 'gemini' ? 'Gemini 2' : model === 'ollama' ? 'Qwen 2.5' : 'Llama 4'
  const modelSub   = model === 'gemini' ? 'Google'   : model === 'ollama' ? 'Local'    : 'Groq'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', position: 'relative', background: 'var(--bg)' }}>

      {/* ── History slide-over ──────────────────────────────────────────── */}
      {historyOpen && (
        <div
          onClick={() => setHistoryOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(2px)' }}
        />
      )}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 30,
        width: 260,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--brd)',
        display: 'flex', flexDirection: 'column',
        transform: historyOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 220ms cubic-bezier(0.4,0,0.2,1)',
        boxShadow: historyOpen ? '-6px 0 32px rgba(0,0,0,.22)' : 'none',
      }}>
        {/* Drawer header */}
        <div style={{
          padding: '14px 14px 12px', borderBottom: '1px solid var(--brd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)', letterSpacing: '-.01em' }}>Sessions</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={newSession}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 'var(--r2)',
                fontSize: 11, fontWeight: 600,
                background: 'var(--pri)', color: '#fff', border: 'none',
              }}
            >
              <Plus size={11} /> New
            </button>
            <button
              onClick={() => setHistoryOpen(false)}
              style={{ display: 'flex', padding: 4, borderRadius: 'var(--r1)', color: 'var(--muted)', border: 'none', background: 'transparent' }}
            >
              <XIcon size={13} />
            </button>
          </div>
        </div>

        {/* Session list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '6px 8px' }}>
          {sessions.length === 0 ? (
            <div style={{ padding: '32px 16px', color: 'var(--faint)', fontSize: 12, textAlign: 'center', lineHeight: 1.8 }}>
              No sessions yet
            </div>
          ) : sessions.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 1 }}>
              <button
                onClick={() => { setActiveSession(s); setHistoryOpen(false) }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 'var(--r2)',
                  fontSize: 12, textAlign: 'left',
                  color: activeSession?.id === s.id ? 'var(--pri)' : 'var(--txt)',
                  background: activeSession?.id === s.id ? 'var(--pri-glow)' : 'transparent',
                  border: `1px solid ${activeSession?.id === s.id ? 'rgba(79,152,163,.25)' : 'transparent'}`,
                  transition: 'all .12s', minWidth: 0, cursor: 'pointer',
                }}
              >
                <MessageSquare size={11} style={{ flexShrink: 0, opacity: .7 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.title}</span>
              </button>
              <button
                title="Delete"
                onClick={async (e) => { e.stopPropagation(); await deleteSession(s.id) }}
                style={{
                  width: 26, height: 26, borderRadius: 'var(--r1)', flexShrink: 0,
                  color: 'var(--faint)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', background: 'transparent', cursor: 'pointer', transition: 'all .12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px',
        height: 42,
        borderBottom: '1px solid var(--brd)',
        flexShrink: 0,
        background: 'var(--surface)',
      }}>
        {/* Left: Model pill */}
        <div style={{ position: 'relative', display: 'flex' }}>
          <button
            id="model-toggle-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px 4px 8px', borderRadius: 'var(--r2)',
              border: '1px solid var(--brd)',
              background: 'var(--offset)',
              color: 'var(--txt)', fontSize: 11, fontWeight: 500,
              cursor: 'pointer', transition: 'all .15s',
            }}
            onClick={() => {
              const menu = document.getElementById('model-menu')
              if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none'
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pri)', flexShrink: 0 }} />
            <span>{modelLabel}</span>
            <span style={{ color: 'var(--faint)', fontSize: 10 }}>· {modelSub}</span>
          </button>
          <div
            id="model-menu"
            style={{
              display: 'none', flexDirection: 'column',
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
              background: 'var(--surface)', border: '1px solid var(--brd)',
              borderRadius: 'var(--r2)', overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,.2)',
              minWidth: 160,
            }}
          >
            {MODEL_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => {
                  setModel(opt.id)
                  const menu = document.getElementById('model-menu')
                  if (menu) menu.style.display = 'none'
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', textAlign: 'left',
                  fontSize: 12, fontWeight: model === opt.id ? 600 : 400,
                  background: model === opt.id ? 'var(--pri-glow)' : 'transparent',
                  color: model === opt.id ? 'var(--pri)' : 'var(--txt)',
                  borderBottom: '1px solid var(--brd)', cursor: 'pointer',
                  transition: 'background .1s',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: model === opt.id ? 'var(--pri)' : 'var(--faint)', flexShrink: 0 }} />
                <span>{opt.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--faint)', fontWeight: 400 }}>{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Session title (center) */}
        {activeSession && (
          <span style={{
            fontSize: 11, color: 'var(--muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 140,
          }}>
            {activeSession.title}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Right: New + History */}
        <button
          onClick={newSession}
          title="New chat"
          style={{
            width: 28, height: 28, borderRadius: 'var(--r2)',
            border: '1px solid var(--brd)',
            background: 'var(--offset)',
            color: 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--pri)'; (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--pri)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--offset)'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--brd)' }}
        >
          <Plus size={13} />
        </button>
        <button
          onClick={() => setHistoryOpen(h => !h)}
          title="Chat history"
          style={{
            width: 28, height: 28, borderRadius: 'var(--r2)',
            border: `1px solid ${historyOpen ? 'var(--pri)' : 'var(--brd)'}`,
            background: historyOpen ? 'var(--pri-glow)' : 'var(--offset)',
            color: historyOpen ? 'var(--pri)' : 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all .15s',
          }}
        >
          <History size={13} />
        </button>
      </div>

      {/* ── Empty / No session state ────────────────────────────────────── */}
      {!activeSession ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: 24,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'var(--pri-glow)', border: '1px solid rgba(79,152,163,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={24} style={{ color: 'var(--pri)' }} strokeWidth={1.5} />
          </div>
          <div style={{ textAlign: 'center', lineHeight: 1.7 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--txt)', marginBottom: 4, letterSpacing: '-.01em' }}>Forge AI</div>
            <div style={{ fontSize: 12, color: 'var(--faint)' }}>
              {model === 'gemini' ? 'Gemini 2.0 Flash · Google'
                : model === 'ollama' ? 'Qwen 2.5 Coder · Local Ollama'
                : 'Llama 4 Scout · Groq'}
            </div>
          </div>
          <button
            onClick={newSession}
            style={{
              padding: '8px 20px', borderRadius: 'var(--r3)',
              background: 'var(--pri)', color: '#fff',
              fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            <Plus size={14} /> New Chat
          </button>
        </div>
      ) : (
        <>
          {/* ── Messages ─────────────────────────────────────────────────── */}
          <div style={{
            flex: 1, overflow: 'auto',
            padding: '20px 16px 8px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {messages.length === 0 && (
              <div style={{
                margin: 'auto', textAlign: 'center',
                color: 'var(--faint)', fontSize: 12, lineHeight: 1.9,
              }}>
                <Zap size={18} strokeWidth={1} style={{ margin: '0 auto 10px', color: 'var(--pri)', opacity: .4 }} />
                Ask anything about your code<br />
                <span style={{ fontSize: 11, opacity: .6 }}>Type @ to attach a file</span>
              </div>
            )}
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
                onApply={onApply}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* ── Input area ───────────────────────────────────────────────── */}
          <div style={{
            padding: '8px 12px 12px',
            borderTop: '1px solid var(--brd)',
            background: 'var(--surface)',
            position: 'relative',
            flexShrink: 0,
          }}>
            {/* Attached file pills */}
            {attachedFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                {attachedFiles.map(f => (
                  <div key={f.path} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'var(--pri-glow)', border: '1px solid rgba(79,152,163,.3)',
                    borderRadius: 'var(--r3)', padding: '3px 8px',
                    fontSize: 11, color: 'var(--pri)', fontFamily: 'var(--font-mono)',
                  }}>
                    <Paperclip size={10} />
                    <span>{f.path.split('/').pop()}</span>
                    <button onClick={() => removeAttached(f.path)} style={{ color: 'var(--pri)', display: 'flex', opacity: .7, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <XIcon size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* @file dropdown */}
            {atQuery !== null && atResults.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 12, right: 12, zIndex: 50,
                background: 'var(--surface)', border: '1px solid var(--brd)',
                borderRadius: 'var(--r2)', overflow: 'hidden',
                boxShadow: '0 -8px 24px rgba(0,0,0,.18)', marginBottom: 4,
              }}>
                {atResults.map((f, i) => (
                  <button key={f} onClick={() => attachFile(f)} style={{
                    width: '100%', textAlign: 'left', padding: '7px 12px',
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                    color: i === atIndexRef.current ? 'var(--pri)' : 'var(--txt)',
                    background: i === atIndexRef.current ? 'var(--pri-glow)' : 'transparent',
                    borderBottom: i < atResults.length - 1 ? '1px solid var(--brd)' : 'none',
                    display: 'flex', gap: 10, alignItems: 'center',
                    border: 'none', cursor: 'pointer',
                  }}>
                    <Paperclip size={10} style={{ flexShrink: 0, opacity: .5 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.split('/').pop()}</span>
                    <span style={{ color: 'var(--faint)', fontSize: 10, flexShrink: 0 }}>{f.replace(activeProject?.path ?? '', '')}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Input box */}
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 8,
              background: 'var(--offset)',
              border: '1px solid var(--brd)',
              borderRadius: 'var(--r3)',
              padding: '8px 10px 8px 12px',
              transition: 'border-color .15s',
            }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--pri)')}
              onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--brd)')}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? 'Waiting…' : 'Ask anything… · @ to attach'}
                rows={1}
                disabled={isStreaming}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--txt)',
                  fontSize: 13,
                  resize: 'none',
                  fontFamily: 'var(--font-body)',
                  maxHeight: 120,
                  overflowY: 'auto',
                  lineHeight: 1.55,
                  opacity: isStreaming ? .6 : 1,
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || isStreaming}
                title="Send (Enter)"
                style={{
                  width: 30, height: 30, borderRadius: 'var(--r2)', flexShrink: 0,
                  background: input.trim() && !isStreaming ? 'var(--pri)' : 'transparent',
                  color: input.trim() && !isStreaming ? '#fff' : 'var(--faint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${input.trim() && !isStreaming ? 'var(--pri)' : 'var(--brd)'}`,
                  cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
                  transition: 'all .15s',
                }}
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
