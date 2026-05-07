import { useRef, useEffect, useCallback } from 'react'
import MonacoEditor, { loader } from '@monaco-editor/react'
import { useForgeStore } from '../store'
import { X, FileCode } from 'lucide-react'

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

  // ⌘S / Ctrl+S global handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        const file = useForgeStore.getState().openFiles.find(
          f => f.path === useForgeStore.getState().activeFile
        )
        if (file) saveFile(file.path, file.content)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveFile])

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

      {/* Monaco */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {currentFile && (
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
              fixedOverflowWidgets: true, // Prevent hover tooltips and dropdowns from clipping or going past screen boundaries
            }}
          />
        )}
      </div>
    </div>
  )
}
