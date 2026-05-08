import { useState } from 'react'
import { useForgeStore } from '../store'
import {
  Code2, Terminal, GitBranch, MessageSquare,
  LayoutDashboard, FolderOpen, Plus, Sun, Moon, Trash2, Search,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import type { Project } from '../../../shared/types'
import FileTree from './FileTree'

const NAV = [
  { id: 'editor',    icon: Code2,          label: 'Editor' },
  { id: 'search',    icon: Search,         label: 'Search' },
  { id: 'terminal',  icon: Terminal,       label: 'Terminal' },
  { id: 'git',       icon: GitBranch,      label: 'Git' },
  { id: 'chat',      icon: MessageSquare,  label: 'Chat' },
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
] as const

export default function Sidebar() {
  const {
    projects, activeProject, setActiveProject,
    activePanel, setActivePanel,
    theme, toggleTheme, setProjects
  } = useForgeStore()

  const [collapsed, setCollapsed] = useState(false)

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
      width: collapsed ? '64px' : 'var(--sidebar-w)',
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--brd)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      userSelect: 'none',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        padding: collapsed ? '14px 0' : '12px 16px',
        borderBottom: '1px solid var(--brd)',
        display: 'flex',
        flexDirection: collapsed ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: collapsed ? 12 : 8,
        height: collapsed ? 'auto' : 56,
        boxSizing: 'border-box',
      }}>
        {/* Logo and Name Group */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            overflow: 'visible', // Ensure the scaled image can render outside the 32px box
          }}>
            <img
              src="./logoforforge.png"
              alt="Forge"
              width={32}
              height={32}
              style={{
                objectFit: 'contain',
                transform: 'scale(1.85)',
                transformOrigin: 'center',
              }}
            />
          </div>
          
          {!collapsed && (
            <div>
              <div style={{
                fontFamily: "var(--font-body)",
                fontSize: '16px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                background: 'linear-gradient(135deg, var(--txt) 30%, var(--pri) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Forge</div>
              <div style={{
                fontSize: '9px',
                color: 'var(--pri)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginTop: '1px',
              }}>beta</div>
            </div>
          )}
        </div>

        {/* Collapse Toggle Arrow Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            width: 24,
            height: 24,
            borderRadius: 'var(--r1)',
            border: '1px solid var(--brd)',
            background: 'var(--offset)',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Projects */}
      {!collapsed && (
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
      )}

      {/* File Tree */}
      {!collapsed && <FileTree />}

      {/* Nav */}
      <div style={{
        padding: collapsed ? '8px 0' : '8px 8px 4px',
        borderTop: '1px solid var(--div)',
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'stretch',
        gap: collapsed ? 6 : 0,
      }}>
        {!collapsed && (
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
            textTransform: 'uppercase', color: 'var(--faint)',
            padding: '4px 8px 6px',
          }}>Workspace</div>
        )}

        {NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            title={collapsed ? label : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? 0 : 9,
              width: collapsed ? 40 : '100%',
              height: collapsed ? 40 : 'auto',
              padding: collapsed ? 0 : '8px 10px',
              borderRadius: 'var(--r2)',
              fontSize: 13,
              color: activePanel === id ? 'var(--pri)' : 'var(--muted)',
              background: activePanel === id ? 'var(--pri-glow)' : 'transparent',
              fontWeight: activePanel === id ? 500 : 400,
              marginBottom: collapsed ? 0 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            <Icon size={15} style={{ flexShrink: 0, opacity: activePanel === id ? 1 : .7 }} />
            {!collapsed && label}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        padding: collapsed ? '12px 0' : '12px',
        borderTop: '1px solid var(--div)',
        display: 'flex',
        flexDirection: collapsed ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: collapsed ? 12 : 6,
      }}>
        {activeProject ? (
          <div
            title={activeProject.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: collapsed ? 0 : 6,
              fontSize: 11, color: 'var(--muted)',
              fontFamily: 'var(--font-mono)',
              background: 'var(--offset)',
              padding: collapsed ? '8px' : '5px 8px',
              borderRadius: 'var(--r2)',
              flex: collapsed ? 'none' : 1,
              width: collapsed ? 36 : 'auto',
              height: collapsed ? 36 : 'auto',
              overflow: 'hidden',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--ok)', flexShrink: 0,
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            {!collapsed && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeProject.name}
              </span>
            )}
          </div>
        ) : (
          !collapsed && <span style={{ fontSize: 11, color: 'var(--faint)' }}>No project</span>
        )}

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={collapsed ? "Toggle theme" : undefined}
          style={{
            width: 28, height: 28, borderRadius: 'var(--r2)',
            border: '1px solid var(--brd)',
            background: 'var(--offset)',
            color: 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            marginLeft: collapsed ? 0 : 6,
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
