import { useForgeStore } from '../store'
import {
  Code2, Terminal, GitBranch, MessageSquare,
  LayoutDashboard, FolderOpen, Plus, Sun, Moon
} from 'lucide-react'
import type { Project } from '../../../shared/types'
import FileTree from './FileTree'

const NAV = [
  { id: 'editor',    icon: Code2,          label: 'Editor' },
  { id: 'terminal',  icon: Terminal,        label: 'Terminal' },
  { id: 'git',       icon: GitBranch,       label: 'Git' },
  { id: 'chat',      icon: MessageSquare,   label: 'Chat' },
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
] as const

export default function Sidebar() {
  const {
    projects, activeProject, setActiveProject,
    activePanel, setActivePanel,
    theme, toggleTheme, setProjects
  } = useForgeStore()

  const handleAddProject = async () => {
    const project = await window.forge.projects.add()
    if (project) {
      const all = await window.forge.projects.list()
      setProjects(all)
      setActiveProject(project)
    }
  }

  const handleSelectProject = (p: Project) => {
    setActiveProject(p)
  }

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--brd)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      userSelect: 'none',
    }}>

      {/* Logo — with macOS traffic light offset */}
      <div style={{
        padding: '16px 16px 12px',
        paddingTop: '44px', // clear macOS traffic lights
        borderBottom: '1px solid var(--brd)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 28, height: 28,
          background: 'var(--pri)',
          borderRadius: 'var(--r2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {/* Forge logo — stylised F */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2h8v2H5v2.5h5v2H5V12H3V2z" fill="white"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-.02em' }}>Forge</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>v0.1.0</div>
        </div>
      </div>

      {/* Projects */}
      <div style={{ padding: '12px 8px 4px' }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
          textTransform: 'uppercase', color: 'var(--faint)',
          padding: '0 8px 6px',
        }}>Projects</div>

        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => handleSelectProject(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              width: '100%', padding: '7px 10px',
              borderRadius: 'var(--r2)',
              fontSize: 12.5,
              color: activeProject?.id === p.id ? 'var(--pri)' : 'var(--muted)',
              background: activeProject?.id === p.id ? 'var(--pri-glow)' : 'transparent',
              fontWeight: activeProject?.id === p.id ? 500 : 400,
              textAlign: 'left',
              marginBottom: 1,
              transition: 'all .15s',
            }}
          >
            <FolderOpen size={13} style={{ flexShrink: 0, opacity: .7 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </span>
          </button>
        ))}

        <button
          onClick={handleAddProject}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            width: '100%', padding: '7px 10px',
            borderRadius: 'var(--r2)',
            fontSize: 12.5,
            color: 'var(--faint)',
            marginTop: 2,
          }}
        >
          <Plus size={13} />
          <span>Add project…</span>
        </button>
      </div>

      {/* File Tree */}
      <FileTree />

      {/* Nav */}
      <div style={{ padding: '8px 8px 4px', borderTop: '1px solid var(--div)', marginTop: 8 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
          textTransform: 'uppercase', color: 'var(--faint)',
          padding: '4px 8px 6px',
        }}>Workspace</div>

        {NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              width: '100%', padding: '8px 10px',
              borderRadius: 'var(--r2)',
              fontSize: 13,
              color: activePanel === id ? 'var(--pri)' : 'var(--muted)',
              background: activePanel === id ? 'var(--pri-glow)' : 'transparent',
              fontWeight: activePanel === id ? 500 : 400,
              marginBottom: 1,
            }}
          >
            <Icon size={15} style={{ flexShrink: 0, opacity: activePanel === id ? 1 : .7 }} />
            {label}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        padding: 12,
        borderTop: '1px solid var(--div)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {activeProject ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--muted)',
            fontFamily: 'var(--font-mono)',
            background: 'var(--offset)',
            padding: '5px 8px',
            borderRadius: 'var(--r2)',
            flex: 1, overflow: 'hidden',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--ok)', flexShrink: 0,
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeProject.name}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>No project</span>
        )}

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={{
            width: 28, height: 28, borderRadius: 'var(--r2)',
            border: '1px solid var(--brd)',
            background: 'var(--offset)',
            color: 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginLeft: 6,
          }}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        aside button:hover { background: var(--offset) !important; color: var(--txt) !important; }
        aside button.active { background: var(--pri-glow) !important; color: var(--pri) !important; }
      `}</style>
    </aside>
  )
}
