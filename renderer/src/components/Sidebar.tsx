import { useForgeStore } from '../store'
import {
  Code2, Terminal, GitBranch, MessageSquare,
  LayoutDashboard, FolderOpen, Plus, Sun, Moon, Trash2, Search
} from 'lucide-react'
import type { Project } from '../../../shared/types'
import FileTree from './FileTree'

const NAV = [
  { id: 'editor',    icon: Code2,          label: 'Editor' },
  { id: 'search',    icon: Search,          label: 'Search' },
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

  const handleRemoveProject = async (projectId: number) => {
    const project = projects.find(p => p.id === projectId)
    if (project?.path) {
      try {
        const status = await window.forge.git.status(project.path)
        // Prompt only for real dirty repos; skip non-git folders.
        const looksLikeGitRepo = status.branch && !status.branch.toLowerCase().includes('fatal')
        if (looksLikeGitRepo && !status.clean) {
          const confirmed = window.confirm(
            `This project has uncommitted changes on branch "${status.branch}".\n\nRemove it from the list anyway?`
          )
          if (!confirmed) return
        }
      } catch {
        // If git status fails, proceed with remove-from-list behavior.
      }
    }

    await window.forge.projects.remove(projectId)
    const all = await window.forge.projects.list()
    setProjects(all)
    if (activeProject?.id === projectId) {
      setActiveProject(all[0] ?? null)
    }
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

      {/* Logo */}
      <div style={{
        padding: '12px 16px 12px',
        borderBottom: '1px solid var(--brd)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {/* Forge logo — flame + hammer + code brackets */}
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Forge">
            <defs>
              <linearGradient id="sb-flame" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#7ee8f2"/>
                <stop offset="60%" stopColor="#3aa8b5"/>
                <stop offset="100%" stopColor="#1a5f68"/>
              </linearGradient>
              <linearGradient id="sb-steel" x1="24" y1="14" x2="24" y2="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#dbd9d5"/>
                <stop offset="50%" stopColor="#a8a6a2"/>
                <stop offset="100%" stopColor="#6a6866"/>
              </linearGradient>
              <filter id="sb-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <path d="M15 41 C6 30 10 16 20 10 C17 19 21 24 23 20 C17 27 19 35 15 41Z" fill="url(#sb-flame)" opacity="0.93" filter="url(#sb-glow)"/>
            <path d="M33 41 C42 30 38 16 28 10 C31 19 27 24 25 20 C31 27 29 35 33 41Z" fill="url(#sb-flame)" opacity="0.93" filter="url(#sb-glow)"/>
            <rect x="21" y="27" width="6" height="14" rx="3" fill="url(#sb-steel)"/>
            <rect x="21" y="27" width="6" height="3" rx="2" fill="rgba(255,255,255,0.18)"/>
            <rect x="13" y="15" width="22" height="14" rx="3.5" fill="url(#sb-steel)"/>
            <rect x="13" y="15" width="22" height="4.5" rx="3.5" fill="rgba(255,255,255,0.18)"/>
            <rect x="13" y="24" width="22" height="5" rx="0" fill="rgba(0,0,0,0.12)"/>
            <text x="24" y="47" textAnchor="middle" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="#4fc9d4" opacity="0.88" filter="url(#sb-glow)">{'< >'}</text>
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
          <div
            key={p.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              marginBottom: 1,
            }}
          >
            <button
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
                transition: 'all .15s',
              }}
            >
              <FolderOpen size={13} style={{ flexShrink: 0, opacity: .7 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
            </button>
            <button
              title="Remove project from list"
              onClick={async (e) => {
                e.stopPropagation()
                await handleRemoveProject(p.id)
              }}
              style={{
                width: 22, height: 22, borderRadius: 'var(--r1)',
                color: 'var(--faint)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
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
