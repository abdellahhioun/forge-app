import { useForgeStore } from '../store'
import { RefreshCw } from 'lucide-react'

export default function Topbar() {
  const { activePanel, activeProject } = useForgeStore()

  const titles: Record<string, string> = {
    editor: 'Editor', terminal: 'Terminal',
    git: 'Git', chat: 'Chat', dashboard: 'Dashboard',
  }

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--brd)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      flexShrink: 0,
      WebkitAppRegion: 'drag', // draggable titlebar region
    } as React.CSSProperties}>

      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-.01em', flex: 1 }}>
        {titles[activePanel]}
        {activeProject && (
          <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>
            — {activeProject.name}
          </span>
        )}
      </span>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, color: 'var(--muted)',
        fontFamily: 'var(--font-mono)',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        {activeProject && (
          <span style={{
            background: 'var(--ok-bg)', color: 'var(--ok)',
            padding: '2px 8px', borderRadius: 99,
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ok)' }} />
            active
          </span>
        )}

        <span>{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>

        <button
          onClick={() => window.location.reload()}
          aria-label="Refresh"
          style={{
            width: 28, height: 28, borderRadius: 'var(--r2)',
            border: '1px solid var(--brd)',
            background: 'var(--offset)',
            color: 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <RefreshCw size={12} />
        </button>
      </div>
    </header>
  )
}
