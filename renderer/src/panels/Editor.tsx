import { useRef, useEffect, useCallback, useState } from 'react'
import MonacoEditor, { DiffEditor, loader } from '@monaco-editor/react'
import { useForgeStore } from '../store'
import { X, FileCode, Check, X as XIcon } from 'lucide-react'

// Configure Monaco language diagnostics globally once to avoid repetitive mounting errors
loader.init().then(monaco => {
  if (monaco?.languages?.typescript?.typescriptDefaults) {
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    })
  }
  if (monaco?.languages?.javascript?.javascriptDefaults) {
    monaco.languages.javascript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    })
  }
}).catch(err => {
  console.error('Failed to configure Monaco defaults:', err)
})

export default function EditorPanel() {
  const {
    openFiles, activeFile, closeFile, setActiveFile,
    theme, activeProject, updateFileContent, markFileSaved,
    pendingDiff, setPendingDiff
  } = useForgeStore()

  const editorRef = useRef<any>(null)
  const currentFile = openFiles.find(f => f.path === activeFile)

  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      json: 'json', css: 'css', html: 'html', md: 'markdown',
      py: 'python', rs: 'rust', go: 'go', sql: 'sql', sh: 'shell',
    }
    return map[ext ?? ''] ?? 'plaintext'
  }

  const saveFile = useCallback(async (path: string, content: string) => {
    if (!window.forge?.files?.write) return
    const res = await window.forge.files.write(path, content)
    if (res.ok) markFileSaved(path)
  }, [markFileSaved])

  // Cmd+K state
  const [cmdKOpen, setCmdKOpen] = useState(false)
  const [cmdKInput, setCmdKInput] = useState('')
  const [cmdKLoading, setCmdKLoading] = useState(false)
  const cmdKInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cmdKOpen) {
      setTimeout(() => cmdKInputRef.current?.focus(), 0)
    }
  }, [cmdKOpen])

  // ⌘S / Ctrl+S global handler & ⌘K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        const file = useForgeStore.getState().openFiles.find(
          f => f.path === useForgeStore.getState().activeFile
        )
        if (file) saveFile(file.path, file.content)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdKOpen(prev => !prev)
      }
      if (e.key === 'Escape' && cmdKOpen) {
        setCmdKOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveFile, cmdKOpen])

  const handleCmdKSubmit = async () => {
    if (!cmdKInput.trim() || !currentFile || !editorRef.current) return
    setCmdKLoading(true)

    const editor = editorRef.current
    const selection = editor.getSelection()
    const selectedText = editor.getModel()?.getValueInRange(selection) || ''
    
    try {
      const res = await (window.forge as any).chat.generateEdit(
        currentFile.path,
        currentFile.content,
        selectedText,
        cmdKInput,
        activeProject?.path
      )
      
      if (res.ok) {
        setPendingDiff({
          path: currentFile.path,
          original: currentFile.content,
          modified: res.code
        })
        setCmdKOpen(false)
        setCmdKInput('')
      } else {
        console.error('Generation failed:', res.error)
      }
    } finally {
      setCmdKLoading(false)
    }
  }

  if (openFiles.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: 'var(--faint)', gap: 12,
      }}>
        <FileCode size={40} strokeWidth={1} />
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>No file open</div>
        <div style={{ fontSize: 12, color: 'var(--faint)' }}>
          {activeProject ? 'Select a file from the explorer' : 'Open a project first'}
        </div>
      </div>
    )
  }

  const isDiffing = pendingDiff && pendingDiff.path === currentFile?.path

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--brd)',
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {openFiles.map(f => {
          const name = f.path.split('/').pop()
          const active = f.path === activeFile
          return (
            <div
              key={f.path}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 12px',
                height: 36,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: active ? 'var(--txt)' : 'var(--muted)',
                background: active ? 'var(--bg)' : 'transparent',
                borderRight: '1px solid var(--brd)',
                borderBottom: active ? '2px solid var(--pri)' : '2px solid transparent',
                cursor: 'pointer',
                flexShrink: 0,
                userSelect: 'none',
              }}
              onClick={() => setActiveFile(f.path)}
            >
              {/* dirty dot */}
              {f.dirty && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--warn)', flexShrink: 0,
                }} />
              )}
              <span>{name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (pendingDiff?.path === f.path) setPendingDiff(null)
                  closeFile(f.path)
                }}
                style={{ color: 'var(--faint)', padding: 1, borderRadius: 3, display: 'flex' }}
              >
                <X size={11} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Monaco Area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Diff Review Header Badge */}
        {isDiffing && (
          <div style={{
            position: 'absolute', top: 16, right: 24, zIndex: 10,
            display: 'flex', gap: 8, background: 'var(--surface)',
            padding: '6px 8px', borderRadius: 'var(--r3)',
            border: '1px solid var(--brd)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)', marginRight: 8, marginLeft: 4 }}>
              Review AI Changes
            </span>
            <button
              onClick={() => {
                if (!pendingDiff) return
                updateFileContent(pendingDiff.path, pendingDiff.modified)
                saveFile(pendingDiff.path, pendingDiff.modified)
                setPendingDiff(null)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 12px', background: 'var(--ok)', color: '#fff',
                borderRadius: 'var(--r2)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: 'none'
              }}
            >
              <Check size={14} /> Accept
            </button>
            <button
              onClick={() => setPendingDiff(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 12px', background: 'var(--surface-hover)', color: 'var(--txt)',
                borderRadius: 'var(--r2)', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: '1px solid var(--brd)'
              }}
            >
              <XIcon size={14} /> Reject
            </button>
          </div>
        )}

        {/* Cmd+K Floating Bar */}
        {cmdKOpen && !isDiffing && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 100, display: 'flex', width: '50%', minWidth: 400,
            background: 'var(--surface)', border: '1px solid var(--brd)',
            borderRadius: 'var(--r3)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            overflow: 'hidden'
          }}>
            <input
              ref={cmdKInputRef}
              value={cmdKInput}
              onChange={(e) => setCmdKInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCmdKSubmit()
                }
              }}
              placeholder="Instructions for AI (e.g. refactor this function)..."
              disabled={cmdKLoading}
              style={{
                flex: 1, padding: '12px 16px', background: 'transparent',
                border: 'none', color: 'var(--txt)', fontSize: 13,
                outline: 'none', fontFamily: 'var(--font-sans)',
              }}
            />
            {cmdKLoading && (
              <div style={{
                display: 'flex', alignItems: 'center', padding: '0 16px',
                color: 'var(--pri)', fontSize: 12, fontWeight: 500
              }}>
                Generating...
              </div>
            )}
          </div>
        )}

        {currentFile && (
          isDiffing ? (
            <DiffEditor
              key={`diff-${currentFile.path}`}
              height="100%"
              language={getLanguage(currentFile.path)}
              original={pendingDiff!.original}
              modified={pendingDiff!.modified}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              options={{
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                renderSideBySide: true,
                minimap: { enabled: false },
                readOnly: true,
                padding: { top: 12 },
                fixedOverflowWidgets: true,
              }}
            />
          ) : (
            <MonacoEditor
              key={currentFile.path}
              height="100%"
              language={getLanguage(currentFile.path)}
              value={currentFile.content}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              onMount={(editor) => {
                editorRef.current = editor
                // Wire ⌘S inside Monaco context too
                editor.addCommand(
                  // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyS
                  2048 | 49,
                  () => saveFile(currentFile.path, editor.getValue())
                )
              }}
              onChange={(value) => {
                if (value !== undefined) {
                  updateFileContent(currentFile.path, value)
                }
              }}
              options={{
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                fontLigatures: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                renderLineHighlight: 'line',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                padding: { top: 12 },
                tabSize: 2,
                fixedOverflowWidgets: true,
              }}
            />
          )
        )}
      </div>
    </div>
  )
}
