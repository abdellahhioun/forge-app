import { useEffect } from 'react'
import { useForgeStore } from './store'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import EditorPanel from './panels/Editor'
import TerminalPanel from './panels/Terminal'
import GitPanel from './panels/Git'
import ChatPanel from './panels/Chat'
import DashboardPanel from './panels/Dashboard'

export default function App() {
  const { activePanel, setProjects, theme } = useForgeStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Load projects from DB on mount
  useEffect(() => {
    if (!window.forge) { console.warn('[Forge] window.forge not ready'); return }
    window.forge.projects.list()
      .then(setProjects)
      .catch(err => console.error('[Forge] projects.list failed:', err))
  }, [])

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'var(--bg)',
      color: 'var(--txt)',
    }}>
      {/* macOS traffic light spacer */}
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />

        <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {activePanel === 'editor'    && <EditorPanel />}
          {activePanel === 'terminal'  && <TerminalPanel />}
          {activePanel === 'git'       && <GitPanel />}
          {activePanel === 'chat'      && <ChatPanel />}
          {activePanel === 'dashboard' && <DashboardPanel />}
        </main>
      </div>
    </div>
  )
}
