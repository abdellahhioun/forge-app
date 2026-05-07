import { useEffect, useState, useCallback, useRef } from 'react'
import { useForgeStore } from '../store'
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen, RefreshCw } from 'lucide-react'

interface Node { name: string; path: string; isDir: boolean; children: Node[] }

const EXT_COLOR: Record<string, string> = {
  ts: '#4f98a3', tsx: '#4f98a3', js: '#e8af34', jsx: '#e8af34',
  json: '#e89050', md: '#a8d0a0', css: '#d163a7', html: '#e8af34',
  py: '#6daa45', rs: '#e89050', go: '#5591c7', sh: '#a86fdf',
}
function fileColor(name: string) {
  return EXT_COLOR[name.split('.').pop() ?? ''] ?? 'var(--muted)'
}

interface CtxMenu { x: number; y: number; node: Node }
type EditType = 'rename' | 'newfile' | 'newdir'
interface InlineEdit { dirPath: string; nodePath: string; type: EditType; defaultVal: string }

function TreeNode({ node, depth = 0, onRefresh, onCtxMenu }: {
  node: Node; depth?: number
  onRefresh: () => void
  onCtxMenu: (e: React.MouseEvent, node: Node) => void
}) {
  const [open, setOpen] = useState(depth === 0)
  const { openFile, setActiveFile, activeFile } = useForgeStore()
  const isActive = activeFile === node.path

  const handleClick = useCallback(async () => {
    if (node.isDir) { setOpen(o => !o); return }
    if (!window.forge) return
    const res = await window.forge.files.read(node.path)
    if (res.ok && res.content !== undefined) {
      openFile(node.path, res.content)
      setActiveFile(node.path)
    }
  }, [node])

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onCtxMenu(e, node) }}
        title={node.path}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: `3px 10px 3px ${8 + depth * 12}px`,
          fontSize: 12, cursor: 'pointer', borderRadius: 4,
          color: isActive ? 'var(--pri)' : 'var(--muted)',
          background: isActive ? 'var(--pri-glow)' : 'transparent',
          fontFamily: 'var(--font-body)', transition: 'background .1s, color .1s',
          userSelect: 'none',
        }}
        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--offset)' }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <span style={{ width: 12, flexShrink: 0, display: 'flex', alignItems: 'center', color: 'var(--faint)' }}>
          {node.isDir ? (open ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : null}
        </span>
        {node.isDir
          ? open
            ? <FolderOpen size={13} style={{ color: 'var(--pri)', flexShrink: 0 }} />
            : <Folder size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          : <FileCode size={13} style={{ color: fileColor(node.name), flexShrink: 0 }} />
        }
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: node.isDir ? 'var(--txt)' : isActive ? 'var(--pri)' : 'var(--muted)',
          fontWeight: node.isDir ? 500 : 400,
        }}>
          {node.name}
        </span>
      </div>
      {node.isDir && open && node.children.map(child => (
        <TreeNode key={child.path} node={child} depth={depth + 1} onRefresh={onRefresh} onCtxMenu={onCtxMenu} />
      ))}
    </div>
  )
}

export default function FileTree() {
  const { activeProject, fileTreeRevision } = useForgeStore()
  const [tree, setTree] = useState<Node[]>([])
  const [loading, setLoading] = useState(false)
  const [ctx, setCtx] = useState<CtxMenu | null>(null)
  const [edit, setEdit] = useState<InlineEdit | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!activeProject || !window.forge) return
    setLoading(true)
    const nodes = await window.forge.files.list(activeProject.path)
    setTree(nodes)
    setLoading(false)
  }, [activeProject])

  useEffect(() => { load() }, [load, fileTreeRevision])

  // Focus+select input when edit opens
  useEffect(() => {
    if (edit) setTimeout(() => { editRef.current?.focus(); editRef.current?.select() }, 50)
  }, [edit])

  // Close context menu on any click
  useEffect(() => {
    const close = () => setCtx(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const openCtx = useCallback((e: React.MouseEvent, node: Node) => {
    setCtx({ x: e.clientX, y: e.clientY, node })
  }, [])

  const commitEdit = async (value: string) => {
    if (!edit) return
    const name = value.trim()
    if (!name) { setEdit(null); return }

    if (edit.type === 'rename') {
      const parent = edit.nodePath.split('/').slice(0, -1).join('/')
      await window.forge.files.rename(edit.nodePath, parent + '/' + name)
    } else if (edit.type === 'newfile') {
      await window.forge.files.newfile(edit.dirPath + '/' + name)
    } else {
      await window.forge.files.mkdir(edit.dirPath + '/' + name)
    }
    setEdit(null)
    load()
  }

  const buildMenu = (node: Node) => {
    if (node.isDir) return [
      {
        label: '📄  New File', action: () => {
          setEdit({ dirPath: node.path, nodePath: node.path, type: 'newfile', defaultVal: '' })
          setCtx(null)
        }
      },
      {
        label: '📁  New Folder', action: () => {
          setEdit({ dirPath: node.path, nodePath: node.path, type: 'newdir', defaultVal: '' })
          setCtx(null)
        }
      },
      { label: '─', action: null },
      {
        label: '✏️  Rename', action: () => {
          setEdit({ dirPath: node.path, nodePath: node.path, type: 'rename', defaultVal: node.name })
          setCtx(null)
        }
      },
      {
        label: '🗑️  Delete', danger: true, action: async () => {
          if (window.confirm('Delete "' + node.name + '" and all its contents?')) {
            await window.forge.files.delete(node.path); load()
          }
          setCtx(null)
        }
      },
      { label: '─', action: null },
      { label: '📋  Copy Path', action: () => { navigator.clipboard.writeText(node.path); setCtx(null) } },
    ]

    return [
      {
        label: '✏️  Rename', action: () => {
          setEdit({ dirPath: node.path.split('/').slice(0, -1).join('/'), nodePath: node.path, type: 'rename', defaultVal: node.name })
          setCtx(null)
        }
      },
      {
        label: '🗑️  Delete', danger: true, action: async () => {
          if (window.confirm('Delete "' + node.name + '"?')) {
            await window.forge.files.delete(node.path); load()
          }
          setCtx(null)
        }
      },
      { label: '─', action: null },
      { label: '📋  Copy Path', action: () => { navigator.clipboard.writeText(node.path); setCtx(null) } },
      { label: '📄  Copy Name', action: () => { navigator.clipboard.writeText(node.name); setCtx(null) } },
    ]
  }

  if (!activeProject) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, position: 'relative' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 10px 4px', borderTop: '1px solid var(--div)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          Files
        </span>
        <button onClick={load} style={{ color: 'var(--faint)', display: 'flex', padding: 2, borderRadius: 'var(--r1)' }} title="Refresh">
          <RefreshCw size={11} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 8 }}>
        {loading && tree.length === 0 && (
          <div style={{ padding: '12px 16px', fontSize: 11, color: 'var(--faint)' }}>Loading…</div>
        )}
        {!loading && tree.length === 0 && (
          <div style={{ padding: '12px 16px', fontSize: 11, color: 'var(--faint)' }}>No files found</div>
        )}
        {tree.map(node => (
          <TreeNode key={node.path} node={node} onRefresh={load} onCtxMenu={openCtx} />
        ))}
      </div>

      {/* Inline input for rename / new file / new folder */}
      {edit && (
        <div style={{ padding: '6px 10px', borderTop: '1px solid var(--div)', background: 'var(--surface)' }}>
          <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 4 }}>
            {edit.type === 'rename' ? 'Rename to:' : edit.type === 'newfile' ? 'New file name:' : 'New folder name:'}
          </div>
          <input
            ref={editRef}
            defaultValue={edit.defaultVal}
            placeholder={edit.type === 'newfile' ? 'filename.ts' : edit.type === 'newdir' ? 'folder-name' : ''}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setEdit(null)
            }}
            onBlur={e => commitEdit(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg)', border: '1px solid var(--pri)',
              borderRadius: 3, padding: '4px 7px', fontSize: 12,
              color: 'var(--txt)', outline: 'none',
            }}
          />
        </div>
      )}

      {/* Context menu */}
      {ctx && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', zIndex: 9999,
            top: ctx.y, left: ctx.x,
            background: 'var(--surface-2, #1c1b19)',
            border: '1px solid var(--div)',
            borderRadius: 7, padding: '4px 0',
            boxShadow: '0 8px 32px rgba(0,0,0,.5)',
            minWidth: 170,
          }}
        >
          {buildMenu(ctx.node).map((item, i) =>
            item.label === '─'
              ? <div key={i} style={{ height: 1, background: 'var(--div)', margin: '3px 0' }} />
              : (
                <div
                  key={i}
                  onClick={item.action ?? undefined}
                  style={{
                    padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                    color: (item as any).danger ? 'var(--error, #d163a7)' : 'var(--txt)',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--offset)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  {item.label}
                </div>
              )
          )}
        </div>
      )}

      <style>{`
        .spin { animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
