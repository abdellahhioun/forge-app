import { useEffect, useRef, useState, useCallback } from 'react'
import { useForgeStore } from '../store'
import { Send, Plus, MessageSquare, Zap, AlertCircle, Trash2 } from 'lucide-react'
import type { ChatSession, ChatMessage, AiModel } from '../../../shared/types'

// ─── Tiny inline markdown renderer ─────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Split on code blocks first
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g)
  parts.forEach((part, i) => {
    if (part.startsWith('```')) {
      const lines = part.slice(3).split('\n')
      const lang = lines[0].trim()
      const code = lines.slice(1).join('\n').replace(/```$/, '').trimEnd()
      nodes.push(
        <div key={i} style={{
          margin: '8px 0', borderRadius: 6, overflow: 'hidden',
          border: '1px solid var(--brd)',
        }}>
          {lang && (
            <div style={{
              padding: '3px 10px', fontSize: 10, fontFamily: 'monospace',
              background: 'var(--offset)', color: 'var(--faint)',
              letterSpacing: '.06em', textTransform: 'uppercase',
            }}>{lang}</div>
          )}
          <pre style={{
            margin: 0, padding: '10px 12px',
            background: 'var(--bg)', fontSize: 12,
            overflowX: 'auto', lineHeight: 1.6,
            fontFamily: 'var(--font-mono, "Fira Code", monospace)',
            color: 'var(--txt)',
          }}><code>{code}</code></pre>
        </div>
      )
    } else if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1)
      nodes.push(
        <code key={i} style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.85em', background: 'var(--offset)',
          border: '1px solid var(--brd)', borderRadius: 4,
          padding: '1px 5px', color: 'var(--txt)',
        }}>{code}</code>
      )
    } else {
      // Handle bold, line breaks
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

// ─── Typing dots ────────────────────────────────────────────────────────────
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
function MessageBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
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
        {isUser
          ? <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
          : isStreaming && msg.content === ''
            ? <TypingDots />
            : renderMarkdown(msg.content)
        }
        {isStreaming && msg.content !== '' && (
          <span style={{
            display: 'inline-block', width: 2, height: '1em',
            background: 'var(--pri)', marginLeft: 2, verticalAlign: 'middle',
            animation: 'cursorblink .8s step-end infinite',
          }} />
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
  { id: 'ollama', label: 'Llama 3.1', sub: 'Local' },
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
  const { activeProject } = useForgeStore()
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

  // ─── Load sessions ────────────────────────────────────────────────────────
  useEffect(() => {
    window.forge.chat.sessions().then(setSessions)
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
    const content = input.trim()
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 0)

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: Math.random().toString(36),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    await window.forge.chat.send(activeSession.id, 'user', content)

    // Add empty assistant message as streaming target
    const aiId = Math.random().toString(36)
    streamingIdRef.current = aiId
    const aiMsg: ChatMessage = {
      id: aiId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, aiMsg])
    setIsStreaming(true)

    // Build history for context (last 20 messages)
    const history = [...messages, userMsg]
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
  }, [input, activeSession, isStreaming, messages, activeProject, model])

  // ─── Textarea auto-resize ────────────────────────────────────────────────
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ── Sessions sidebar ─────────────────────────────────────────────── */}
      <div style={{
        width: sidebarWidth,
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{
          padding: '10px 12px', borderBottom: '1px solid var(--brd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
            textTransform: 'uppercase', color: 'var(--faint)',
          }}>Sessions</span>
          <button
            onClick={newSession}
            title="New chat session"
            style={{
              color: 'var(--muted)', display: 'flex', padding: 4,
              borderRadius: 'var(--r1)',
              transition: 'color .15s, background .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--pri)'; (e.currentTarget as HTMLElement).style.background = 'var(--pri-glow)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <Plus size={13} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '6px 6px' }}>
          {sessions.length === 0 ? (
            <div style={{
              padding: '20px 10px', color: 'var(--faint)',
              fontSize: 12, textAlign: 'center', lineHeight: 1.5,
            }}>
              No sessions<br />
              <span style={{ fontSize: 11 }}>Click + to start</span>
            </div>
          ) : sessions.map(s => (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 1,
              }}
            >
              <button
                onClick={() => setActiveSession(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  width: '100%', padding: '7px 9px', borderRadius: 'var(--r2)',
                  fontSize: 12, textAlign: 'left',
                  color: activeSession?.id === s.id ? 'var(--pri)' : 'var(--muted)',
                  background: activeSession?.id === s.id ? 'var(--pri-glow)' : 'transparent',
                  transition: 'background .12s, color .12s',
                }}
              >
                <MessageSquare size={11} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {s.title}
                </span>
              </button>
              <button
                title="Delete chat session"
                onClick={async (e) => {
                  e.stopPropagation()
                  await deleteSession(s.id)
                }}
                style={{
                  width: 24, height: 24, borderRadius: 'var(--r1)',
                  color: 'var(--faint)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all .12s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--err-txt, #f87171)'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,60,60,.08)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--faint)'
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Model selector */}
        <ModelToggle value={model} onChange={setModel} />
      </div>

      {/* ── Drag separator ───────────────────────────────────────────────── */}
      <div
        onMouseDown={(e) => {
          isResizingRef.current = true
          resizeStartXRef.current = e.clientX
          resizeStartWidthRef.current = sidebarWidth
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
        }}
        title="Drag to resize sessions panel"
        style={{
          width: 6,
          cursor: 'col-resize',
          background: 'transparent',
          borderLeft: '1px solid var(--brd)',
          borderRight: '1px solid transparent',
          flexShrink: 0,
        }}
      />

      {/* ── Chat area ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!activeSession ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--faint)', gap: 12,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--pri-glow)', border: '1px solid var(--brd)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={22} style={{ color: 'var(--pri)' }} strokeWidth={1.5} />
            </div>
            <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
                Forge AI
              </div>
              <div style={{ fontSize: 12, color: 'var(--faint)' }}>
                {model === 'gemini'
                  ? 'Powered by Google · Gemini 2.0 Flash'
                  : model === 'ollama'
                    ? 'Powered by Local Ollama · Llama 3.1'
                    : 'Powered by Groq · Llama 4 Scout'}
              </div>
            </div>
            <button
              onClick={newSession}
              style={{
                marginTop: 4, padding: '8px 18px', borderRadius: 'var(--r3)',
                background: 'var(--pri)', color: '#fff',
                fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={13} /> New Chat
            </button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div style={{
              flex: 1, overflow: 'auto',
              padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              {messages.length === 0 && (
                <div style={{
                  margin: 'auto', textAlign: 'center',
                  color: 'var(--faint)', fontSize: 12, lineHeight: 1.8,
                }}>
                  <Zap size={20} strokeWidth={1} style={{ margin: '0 auto 8px', color: 'var(--pri)', opacity: .5 }} />
                  Ask anything about your code
                </div>
              )}
              {messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
                />
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '10px 14px 12px',
              borderTop: '1px solid var(--brd)',
              background: 'var(--surface)',
              display: 'flex', gap: 8, alignItems: 'flex-end',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder={isStreaming ? 'Waiting for response…' : 'Ask anything… (Enter ↵ send · Shift+Enter newline)'}
                rows={1}
                disabled={isStreaming}
                style={{
                  flex: 1,
                  background: 'var(--offset)', border: '1px solid var(--brd)',
                  borderRadius: 'var(--r3)', color: 'var(--txt)',
                  fontSize: 13, padding: '9px 13px',
                  resize: 'none', outline: 'none',
                  fontFamily: 'var(--font-body)',
                  maxHeight: 120, overflowY: 'auto',
                  lineHeight: 1.5, transition: 'border-color .15s',
                  opacity: isStreaming ? .6 : 1,
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--pri)')}
                onBlur={e => (e.target.style.borderColor = 'var(--brd)')}
              />
              <button
                onClick={send}
                disabled={!input.trim() || isStreaming}
                title="Send (Enter)"
                style={{
                  width: 36, height: 36, borderRadius: 'var(--r2)', flexShrink: 0,
                  background: input.trim() && !isStreaming ? 'var(--pri)' : 'var(--dynamic)',
                  color: input.trim() && !isStreaming ? '#fff' : 'var(--faint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background .15s, color .15s',
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
