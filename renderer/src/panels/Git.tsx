import { useEffect, useState, useRef } from 'react'
import { useForgeStore } from '../store'
import { GitBranch, GitCommit, RefreshCw, Upload, Plus, Check, X, GitPullRequest, ChevronsUpDown, Sparkles } from 'lucide-react'
import type { GitStatus, GitCommit as IGitCommit } from '../../../shared/types'

type Toast = { ok: boolean; msg: string }
type Branches = { current: string; local: string[]; remote: string[] }

export default function GitPanel() {
  const { activeProject, refreshFileTree } = useForgeStore()
  const [status, setStatus]     = useState<GitStatus | null>(null)
  const [log, setLog]           = useState<IGitCommit[]>([])
  const [diff, setDiff]         = useState('')
  const [branches, setBranches] = useState<Branches | null>(null)
  const [commitMsg, setCommitMsg] = useState('')
  const [newBranch, setNewBranch] = useState('')
  const [loading, setLoading]   = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [toast, setToast]       = useState<Toast | null>(null)
  const [showBranches, setShowBranches] = useState(false)
  const [showPR, setShowPR]     = useState(false)

  const [sidebarWidth, setSidebarWidth] = useState(280)
  const isResizingRef = useRef(false)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(280)

  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const selectedFileRef = useRef<string | null>(null)
  selectedFileRef.current = selectedFile

  const notify = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const load = async (showSpinner = false) => {
    if (!activeProject) return
    if (showSpinner) setLoading(true)
    try {
      const [s, l, d, b] = await Promise.all([
        window.forge.git.status(activeProject.path),
        window.forge.git.log(activeProject.path, 20),
        window.forge.git.diff(activeProject.path, selectedFileRef.current || undefined),
        window.forge.git.branches(activeProject.path),
      ])
      setStatus(s); setLog(l); setDiff(d); setBranches(b)
    } catch (e: any) {
      notify(false, e.message)
    }
    if (showSpinner) setLoading(false)
  }

  const loadDiffOnly = async (file: string | null) => {
    if (!activeProject) return
    try {
      const d = await window.forge.git.diff(activeProject.path, file || undefined)
      setDiff(d)
    } catch (e: any) {
      notify(false, e.message)
    }
  }

  useEffect(() => {
    setSelectedFile(null)
    load(true)
    // auto-refresh every 5s so file changes appear without manual refresh
    const interval = setInterval(() => load(false), 5000)
    return () => clearInterval(interval)
  }, [activeProject])

  useEffect(() => {
    loadDiffOnly(selectedFile)
  }, [selectedFile])

  // ─── Sidebar resize handling ─────────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const delta = e.clientX - resizeStartXRef.current
      const next = resizeStartWidthRef.current + delta
      const clamped = Math.max(200, Math.min(600, next))
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

  // ─── Auto-resize sidebar to accommodate long branch names ────────────────
  useEffect(() => {
    if (status?.branch) {
      // Estimated width required = fixed elements (approx 155px) + monospace characters (7.2px each)
      const neededWidth = Math.ceil(155 + status.branch.length * 7.2)
      setSidebarWidth(prev => Math.max(prev, Math.min(500, neededWidth)))
    }
  }, [status?.branch])

  const handleSuggestCommit = async () => {
    if (!activeProject) return
    setSuggesting(true)
    try {
      const res = await window.forge.git.suggestCommit(activeProject.path)
      if (res.ok && res.message) {
        setCommitMsg(res.message)
        notify(true, 'AI suggested a commit message!')
      } else {
        notify(false, res.error || 'Failed to generate commit message')
      }
    } catch (e: any) {
      notify(false, e.message)
    } finally {
      setSuggesting(false)
    }
  }

  const handleCommit = async () => {
    if (!activeProject || !commitMsg.trim()) return
    const res = await window.forge.git.commit(activeProject.path, commitMsg)
    if (res.ok) { setCommitMsg(''); notify(true, 'Committed successfully') }
    else notify(false, res.out)
    load()
  }

  const handlePush = async () => {
    if (!activeProject) return
    setLoading(true)
    const res = await window.forge.git.push(activeProject.path)
    notify(res.ok, res.ok ? 'Pushed to remote' : res.out)
    setLoading(false)
    load(false)
  }

  const handleBranch = async () => {
    if (!activeProject || !newBranch.trim()) return
    setLoading(true)
    try {
      const res = await window.forge.git.branch(activeProject.path, newBranch.trim())
      notify(res.ok, res.out)
      setNewBranch('')
    } catch (e: any) {
      notify(false, e.message)
    } finally {
      setLoading(false)
      load()
    }
  }

  const handleSwitch = async (name: string) => {
    if (!activeProject) return
    const displayName = name.replace(/^origin\//, '')
    if (displayName === status?.branch) { setShowBranches(false); return }
    setLoading(true)
    setShowBranches(false)
    const res = await window.forge.git.switchBranch(activeProject.path, name)
    if (res.ok) {
      // Re-read every open file from disk so the editor reflects the new branch's content
      const { openFiles, updateFileContent, markFileSaved } = useForgeStore.getState()
      await Promise.all(
        openFiles.map(async (f) => {
          const result = await window.forge.files.read(f.path)
          if (result.ok && result.content !== undefined) {
            updateFileContent(f.path, result.content)
            markFileSaved(f.path)
          }
        })
      )
      refreshFileTree()
      notify(true, `Switched to ${displayName}`)
    } else {
      notify(false, res.out)
    }
    setLoading(false)
    load(false)
  }

  const renderDiff = (raw: string) => {
    if (!raw) return <div style={{ color: 'var(--faint)', paddingTop: 8 }}>No changes</div>
    const lines = raw.split('\n')
    const elements: React.ReactNode[] = []
    let key = 0
    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        const match = line.match(/b\/(.+)$/)
        const fileName = match ? match[1] : line
        elements.push(<div key={key++} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 6px', padding: '5px 10px', background: 'var(--offset)', borderRadius: 6, borderLeft: '3px solid var(--pri)', fontSize: 12, fontWeight: 600, color: 'var(--txt)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--pri)', fontSize: 11 }}>&#128196;</span>{fileName}
        </div>)
        continue
      }
      if (line.startsWith('new file')) {
        elements.push(<div key={key++} style={{ display: 'inline-block', fontSize: 10, padding: '1px 7px', background: 'oklch(from var(--ok) l c h / 0.15)', color: 'var(--ok)', borderRadius: 99, marginBottom: 6, fontFamily: 'var(--font-body)', fontWeight: 600 }}>NEW FILE</div>)
        continue
      }
      if (line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('index ') || line.startsWith('old mode') || line.startsWith('deleted file')) continue
      if (line.startsWith('@@')) {
        const match = line.match(/@@ .* @@(.*)$/)
        const ctx = match?.[1]?.trim()
        elements.push(<div key={key++} style={{ color: 'var(--faint)', fontSize: 10, padding: '3px 0 3px 4px', borderBottom: '1px solid var(--div)', marginBottom: 2, fontFamily: 'var(--font-mono)' }}>{ctx ? `\u2014 ${ctx}` : '\u2014\u2014\u2014\u2014\u2014\u2014'}</div>)
        continue
      }
      if (line.startsWith('+')) {
        elements.push(<div key={key++} style={{ display: 'flex', gap: 8, background: 'oklch(from var(--ok) l c h / 0.08)', borderLeft: '2px solid var(--ok)', padding: '0 8px', whiteSpace: 'pre', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--ok)', userSelect: 'none', flexShrink: 0 }}>+</span>
          <span style={{ color: 'var(--ok)' }}>{line.slice(1)}</span>
        </div>)
        continue
      }
      if (line.startsWith('-')) {
        elements.push(<div key={key++} style={{ display: 'flex', gap: 8, background: 'oklch(from var(--err) l c h / 0.08)', borderLeft: '2px solid var(--err)', padding: '0 8px', whiteSpace: 'pre', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--err)', userSelect: 'none', flexShrink: 0 }}>-</span>
          <span style={{ color: 'var(--err)' }}>{line.slice(1)}</span>
        </div>)
        continue
      }
      if (line.trim()) elements.push(<div key={key++} style={{ padding: '0 8px', whiteSpace: 'pre', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{line}</div>)
    }
    return <>{elements}</>
  }

  if (!activeProject) return (

    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 13 }}>
      Open a project to see git status
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 100,
          background: toast.ok ? 'var(--ok-bg)' : 'var(--err-bg, #3a1a1a)',
          color: toast.ok ? 'var(--ok)' : 'var(--err)',
          border: `1px solid ${toast.ok ? 'var(--ok)' : 'var(--err)'}`,
          borderRadius: 'var(--r2)', padding: '8px 14px',
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 7,
          maxWidth: 360, boxShadow: '0 4px 16px rgba(0,0,0,.3)',
        }}>
          {toast.ok ? <Check size={13} /> : <X size={13} />}
          <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>{toast.msg}</span>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left sidebar ── */}
        <div style={{
          width: sidebarWidth,
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', flexShrink: 0,
        }}>

          {/* Branch header & Actions */}
          <div style={{
            borderBottom: '1px solid var(--brd)',
            background: 'var(--surface)',
          }}>
            {/* Main branch switcher row */}
            <div style={{
              padding: '10px 12px 6px',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <GitBranch size={13} style={{ color: 'var(--pri)', flexShrink: 0 }} />

              {/* Branch switcher button */}
              <button
                onClick={() => setShowBranches(v => !v)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--offset)', border: '1px solid var(--brd)',
                  borderRadius: 'var(--r2)', padding: '4px 8px',
                  color: 'var(--txt)', fontSize: 12, fontFamily: 'var(--font-mono)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {status?.branch ?? '—'}
                </span>
                <ChevronsUpDown size={11} style={{ color: 'var(--faint)', flexShrink: 0 }} />
              </button>

              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 99, flexShrink: 0,
                background: status?.clean ? 'var(--ok-bg)' : 'var(--warn-bg)',
                color: status?.clean ? 'var(--ok)' : 'var(--warn)',
              }}>
                {status?.clean ? 'clean' : 'dirty'}
              </span>

              <button onClick={() => load(true)} style={{ color: 'var(--muted)', display: 'flex', padding: 2, borderRadius: 'var(--r1)', flexShrink: 0 }}>
                <RefreshCw size={12} className={loading ? 'spin' : ''} />
              </button>
            </div>

            {/* New branch creation row */}
            <div style={{
              padding: '0 12px 10px',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <GitBranch size={13} style={{ color: 'var(--faint)', flexShrink: 0 }} />
              <input
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
                placeholder="Create branch…"
                style={{
                  flex: 1, background: 'var(--offset)',
                  border: '1px solid var(--brd)', borderRadius: 'var(--r2)',
                  color: 'var(--txt)', fontSize: 11.5, padding: '5px 8px',
                  outline: 'none', fontFamily: 'var(--font-body)',
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleBranch() }}
              />
              <button
                onClick={handleBranch}
                disabled={!newBranch.trim() || loading}
                title="Create branch"
                className="git-btn"
                style={{
                  padding: '5px 10px', background: 'var(--offset)',
                  border: '1px solid var(--brd)', borderRadius: 'var(--r2)',
                  color: !newBranch.trim() ? 'var(--faint)' : 'var(--pri)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Branch dropdown */}
          {showBranches && branches && (
            <div style={{
              borderBottom: '1px solid var(--brd)',
              background: 'var(--bg)', maxHeight: 220, overflow: 'auto',
            }}>
              {/* local */}
              <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--faint)' }}>Local</div>
              {branches.local.map(b => (
                <BranchRow key={b} name={b} active={b === status?.branch} onSwitch={handleSwitch} />
              ))}
              {/* remote — hide origin/HEAD, hide already-tracked local branches */}
              {branches.remote.filter(b => !b.endsWith('/HEAD')).length > 0 && (
                <>
                  <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--faint)', borderTop: '1px solid var(--brd)', marginTop: 4 }}>Remote</div>
                  {branches.remote
                    .filter(b => !b.endsWith('/HEAD'))
                    .map(b => (
                      <BranchRow key={b} name={b} active={b.replace(/^origin\//, '') === status?.branch} onSwitch={handleSwitch} remote />
                    ))}
                </>
              )}
            </div>
          )}

          {/* Changed files */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
            {!status?.clean && (
              <button
                onClick={() => setSelectedFile(null)}
                className="git-btn"
                style={{
                  width: '100%', textAlign: 'left', padding: '6px 14px',
                  background: selectedFile === null ? 'color-mix(in oklch, var(--pri) 10%, transparent)' : 'transparent',
                  color: selectedFile === null ? 'var(--pri)' : 'var(--muted)',
                  fontSize: 12, fontWeight: selectedFile === null ? 600 : 400,
                  display: 'flex', alignItems: 'center', gap: 8,
                  border: 'none', cursor: 'pointer',
                }}
              >
                All Changes
              </button>
            )}

            {(status?.staged ?? []).map(f => (
              <FileRow
                key={f}
                file={f}
                type="staged"
                active={selectedFile === f}
                onClick={() => setSelectedFile(selectedFile === f ? null : f)}
              />
            ))}
            {(status?.modified ?? []).map(f => (
              <FileRow
                key={f}
                file={f}
                type="modified"
                active={selectedFile === f}
                onClick={() => setSelectedFile(selectedFile === f ? null : f)}
              />
            ))}
            {(status?.untracked ?? []).map(f => (
              <FileRow
                key={f}
                file={f}
                type="untracked"
                active={selectedFile === f}
                onClick={() => setSelectedFile(selectedFile === f ? null : f)}
              />
            ))}
            {status?.clean && (
              <div style={{ padding: '20px 14px', color: 'var(--faint)', fontSize: 12, textAlign: 'center' }}>
                Nothing to commit
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding: 12, borderTop: '1px solid var(--brd)', display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Commit Message Textarea */}
            <div style={{ position: 'relative', width: '100%' }}>
              <textarea
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                placeholder={suggesting ? "Analyzing changes..." : "Commit message… (⌘↵ to commit)"}
                rows={2}
                disabled={suggesting}
                style={{
                  width: '100%', background: 'var(--offset)',
                  border: '1px solid var(--brd)', borderRadius: 'var(--r2)',
                  color: 'var(--txt)', fontSize: 12, padding: '6px 32px 6px 9px',
                  resize: 'none', fontFamily: 'var(--font-body)', outline: 'none',
                  transition: 'border-color 0.15s',
                  opacity: suggesting ? 0.7 : 1,
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--pri)')}
                onBlur={e => (e.target.style.borderColor = 'var(--brd)')}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleCommit() }}
              />
              <button
                onClick={handleSuggestCommit}
                disabled={suggesting || loading}
                title="AI Suggest Commit Message"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: suggesting ? 'var(--pri)' : 'var(--faint)',
                  cursor: (suggesting || loading) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '5px',
                  borderRadius: 'var(--r1)',
                  transition: 'color 0.15s, background-color 0.15s',
                }}
                onMouseEnter={e => { if (!suggesting && !loading) { e.currentTarget.style.color = 'var(--pri)'; e.currentTarget.style.backgroundColor = 'var(--dynamic)' } }}
                onMouseLeave={e => { if (!suggesting && !loading) { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.backgroundColor = 'transparent' } }}
              >
                <Sparkles
                  size={14}
                  style={{
                    animation: suggesting ? 'spin 2s linear infinite' : 'none',
                  }}
                />
              </button>
            </div>

            {/* Actions Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {/* Commit Button */}
                <button
                  onClick={handleCommit}
                  disabled={!commitMsg.trim() || loading}
                  className="git-btn git-btn-pri"
                  style={{
                    flex: 1, padding: '7px 0',
                    background: commitMsg.trim() ? 'var(--pri)' : 'var(--dynamic)',
                    color: commitMsg.trim() ? '#fff' : 'var(--faint)',
                    border: 'none',
                    borderRadius: 'var(--r2)', fontSize: 12, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  <GitCommit size={13} /> Commit
                </button>

                {/* Push Button */}
                <button
                  onClick={handlePush}
                  disabled={loading}
                  className="git-btn"
                  title="Push commits to remote"
                  style={{
                    flex: 1, padding: '7px 0',
                    background: 'var(--offset)',
                    border: '1px solid var(--brd)',
                    borderRadius: 'var(--r2)', color: 'var(--muted)', fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  <Upload size={13} /> Push
                </button>
              </div>

              {/* Pull Request Button */}
              <button
                onClick={() => setShowPR(true)}
                className="git-btn"
                style={{
                  width: '100%', padding: '7px 0',
                  background: 'var(--offset)', border: '1px solid var(--brd)',
                  borderRadius: 'var(--r2)', color: 'var(--muted)', fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <GitPullRequest size={13} /> Open Pull Request
              </button>
            </div>
          </div>
        </div>

        {/* ── Drag separator ── */}
        <div
          onMouseDown={(e) => {
            isResizingRef.current = true
            resizeStartXRef.current = e.clientX
            resizeStartWidthRef.current = sidebarWidth
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
          title="Drag to resize panel"
          style={{
            width: 6,
            cursor: 'col-resize',
            background: 'transparent',
            borderLeft: '1px solid var(--brd)',
            borderRight: '1px solid transparent',
            flexShrink: 0,
            zIndex: 10,
            marginLeft: -3,
            marginRight: -3,
          }}
        />

        {/* ── Right: diff + log ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            flex: 1, overflow: 'auto', padding: 16,
            fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6,
            background: 'var(--bg)',
          }}>
            {renderDiff(diff)}
          </div>



          <div style={{ height: 200, borderTop: '1px solid var(--brd)', overflow: 'auto', background: 'var(--surface)' }}>
            <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>
              Recent commits
            </div>
            {log.map(c => (
              <div key={c.hash} style={{
                display: 'flex', alignItems: 'baseline', gap: 10,
                padding: '6px 14px', borderBottom: '1px solid var(--div)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--pri)', flexShrink: 0 }}>{c.hash}</span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
                <span style={{ fontSize: 10, color: 'var(--faint)', flexShrink: 0 }}>{c.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PR Modal */}
      {showPR && activeProject && (
        <PRModal
          cwd={activeProject.path}
          currentBranch={status?.branch ?? ''}
          onClose={() => setShowPR(false)}
          onDone={(msg, ok) => { notify(ok, msg); setShowPR(false) }}
        />
      )}

      <style>{`
        .spin { animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .git-btn {
          cursor: pointer;
          transition: all 0.15s ease-in-out;
        }
        .git-btn:hover:not(:disabled) {
          background: var(--offset) !important;
          color: var(--txt) !important;
          border-color: var(--div) !important;
        }
        .git-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .git-btn-pri {
          transition: filter 0.15s ease-in-out;
        }
        .git-btn-pri:hover:not(:disabled) {
          filter: brightness(1.15);
          color: #fff !important;
        }
      `}</style>
    </div>
  )
}

// ── PR Modal ────────────────────────────────────────────────────────────────
function PRModal({ cwd, currentBranch, onClose, onDone }: {
  cwd: string
  currentBranch: string
  onClose: () => void
  onDone: (msg: string, ok: boolean) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [base, setBase]   = useState('main')
  const [busy, setBusy]   = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')

  const submit = async () => {
    if (!title.trim()) return
    setBusy(true)
    const res = await window.forge.git.pr(cwd, title, body, base)
    onDone(res.ok ? `PR created: ${res.out}` : res.out, res.ok)
    setBusy(false)
  }

  const handleAiSuggestPR = async () => {
    if (aiBusy) return
    setAiBusy(true)
    setAiError('')
    try {
      const res = await window.forge.git.suggestPR(cwd, base)
      if (res.ok && res.title && res.body) {
        setTitle(res.title)
        setBody(res.body)
      } else {
        setAiError(res.error || 'Failed to generate PR content')
      }
    } catch (err: any) {
      setAiError(err.message || 'Error communicating with AI')
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--brd)',
        borderRadius: 'var(--r3)', padding: 24, width: 440,
        display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: '0 16px 40px rgba(0,0,0,.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
            <GitPullRequest size={16} style={{ color: 'var(--pri)' }} />
            Open Pull Request
          </div>

          <button
            onClick={handleAiSuggestPR}
            disabled={aiBusy || busy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: 'color-mix(in oklch, var(--pri) 12%, transparent)',
              border: '1px solid color-mix(in oklch, var(--pri) 30%, transparent)',
              borderRadius: 'var(--r2)',
              color: 'var(--pri)',
              fontSize: 11,
              fontWeight: 600,
              cursor: (aiBusy || busy) ? 'not-allowed' : 'pointer',
              marginLeft: 'auto',
              marginRight: 10,
              transition: 'all 0.2s ease',
            }}
            title="Suggest title & detailed description with AI"
          >
            <Sparkles size={12} style={{ animation: aiBusy ? 'spin 2s linear infinite' : 'none' }} />
            {aiBusy ? 'Analyzing...' : 'AI Suggest'}
          </button>

          <button onClick={onClose} style={{ color: 'var(--faint)', display: 'flex', padding: 2 }}><X size={14} /></button>
        </div>

        {aiError && (
          <div style={{ fontSize: 11, color: 'var(--warn)', background: 'rgba(235, 94, 85, 0.1)', border: '1px solid var(--warn)', padding: '6px 10px', borderRadius: 'var(--r2)' }}>
            ⚠️ {aiError}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', background: 'var(--offset)', padding: '5px 10px', borderRadius: 'var(--r2)' }}>
          {currentBranch} → {base}
        </div>

        <Field label="Title">
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder={aiBusy ? 'Analyzing changes & composing title...' : 'PR title…'}
            disabled={aiBusy}
            style={{ ...inputStyle, opacity: aiBusy ? 0.6 : 1 }}
          />
        </Field>

        <Field label="Base branch">
          <input
            value={base} onChange={e => setBase(e.target.value)}
            placeholder="main"
            disabled={aiBusy}
            style={{ ...inputStyle, opacity: aiBusy ? 0.6 : 1 }}
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={body} onChange={e => setBody(e.target.value)}
            placeholder={aiBusy ? 'Analyzing diff & writing a professional, detailed description...' : 'Describe your changes…'}
            rows={6}
            disabled={aiBusy}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)', opacity: aiBusy ? 0.6 : 1 }}
          />
        </Field>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: 'var(--offset)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', color: 'var(--muted)', fontSize: 12 }}>Cancel</button>
          <button
            onClick={submit}
            disabled={!title.trim() || busy || aiBusy}
            style={{ padding: '7px 16px', background: 'var(--pri)', color: '#fff', borderRadius: 'var(--r2)', fontSize: 12, fontWeight: 500, opacity: (busy || aiBusy) ? .6 : 1 }}
          >
            {busy ? 'Creating…' : 'Create PR'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--offset)', border: '1px solid var(--brd)',
  borderRadius: 'var(--r2)', color: 'var(--txt)', fontSize: 12,
  padding: '6px 10px', outline: 'none', fontFamily: 'var(--font-mono)',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)', letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  )
}

function BranchRow({ name, active, onSwitch, remote }: { name: string; active: boolean; onSwitch: (n: string) => void; remote?: boolean }) {
  return (
    <button
      onClick={() => onSwitch(name)}
      style={{
        width: '100%', textAlign: 'left', padding: '5px 14px',
        background: active ? 'color-mix(in oklch, var(--pri) 12%, transparent)' : 'transparent',
        color: active ? 'var(--pri)' : remote ? 'var(--faint)' : 'var(--txt)',
        fontSize: 12, fontFamily: 'var(--font-mono)',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid transparent',
        cursor: 'pointer',
      }}
    >
      {active && <Check size={11} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </button>
  )
}

function FileRow({ file, type, active, onClick }: {
  file: string
  type: string
  active?: boolean
  onClick?: () => void
}) {
  const colors: Record<string, string> = { modified: 'var(--warn)', untracked: 'var(--pri)', staged: 'var(--ok)' }
  const labels: Record<string, string> = { modified: 'M', untracked: '?', staged: 'S' }
  return (
    <button
      onClick={onClick}
      className="git-btn"
      style={{
        width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', fontSize: 12,
        backgroundColor: active ? 'color-mix(in oklch, var(--pri) 10%, transparent)' : 'transparent',
        color: active ? 'var(--txt)' : 'var(--muted)',
      }}
    >
      <span style={{ width: 14, fontSize: 10, fontWeight: 700, color: colors[type], flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
        {labels[type]}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', textAlign: 'left', fontWeight: active ? 500 : 400 }}>
        {file}
      </span>
    </button>
  )
}
