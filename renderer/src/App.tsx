import { useEffect, useState, useCallback } from 'react'
import { useForgeStore } from './store'
import SplashScreen from './components/SplashScreen'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import EditorPanel from './panels/Editor'
import SearchPanel from './panels/Search'
import TerminalPanel from './panels/Terminal'
import GitPanel from './panels/Git'
import ChatPanel from './panels/Chat'
import DashboardPanel from './panels/Dashboard'
import { GripVertical } from 'lucide-react'

export default function App() {
  const { activePanel, setActivePanel, setProjects, theme } = useForgeStore()
  const [splashDone, setSplashDone] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatWidth, setChatWidth] = useState(380)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Redirect from chat panel to editor if activePanel is chat
  useEffect(() => {
    if (activePanel === 'chat') {
      setActivePanel('editor')
    }
  }, [activePanel, setActivePanel])

  useEffect(() => {
    if (!window.forge) { console.warn('[Forge] window.forge not ready'); return }
    window.forge.projects.list()
      .then(setProjects)
      .catch(err => console.error('[Forge] projects.list failed:', err))
  }, [])

  // ── Resizable divider drag ──────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    const startX = e.clientX
    const startW = chatWidth
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      setChatWidth(Math.max(280, Math.min(700, startW + delta)))
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [chatWidth])

  // ── Keyboard shortcut ⌘J to toggle chat (Commented out) ─────────────────
  // useEffect(() => {
  //   const handler = (e: KeyboardEvent) => {
  //     if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
  //       e.preventDefault()
  //       setChatOpen(o => !o)
  //     }
  //   }
  //   window.addEventListener('keydown', handler)
  //   return () => window.removeEventListener('keydown', handler)
  // }, [])

  const showSplitChat = chatOpen

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg)',
        color: 'var(--txt)',
        userSelect: dragging ? 'none' : undefined,
      }}>
        <Sidebar />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <Topbar />

          <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

            {/* ── Main panel area ── */}
            <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {activePanel === 'editor'    && <EditorPanel />}
              {activePanel === 'search'    && <SearchPanel />}
              {activePanel === 'terminal'  && <TerminalPanel />}
              {activePanel === 'git'       && <GitPanel />}
              {/* {activePanel === 'chat'      && <ChatPanel />} */}
              {activePanel === 'dashboard' && <DashboardPanel />}
            </div>

            {/* ── Resizable drag handle (Commented out Chat) ── */}
            {/* {showSplitChat && (
              <div
                onMouseDown={onMouseDown}
                title="Drag to resize"
                style={{
                  width: 4,
                  cursor: 'col-resize',
                  background: dragging ? 'var(--pri)' : 'transparent',
                  flexShrink: 0,
                  transition: 'background 120ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderLeft: '1px solid var(--brd)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--pri)')}
                onMouseLeave={e => !dragging && (e.currentTarget.style.background = 'transparent')}
              >
                <GripVertical size={10} style={{ color: 'var(--muted)', pointerEvents: 'none', opacity: 0.4 }} />
              </div>
            )} */}

            {/* ── AI Chat side panel (Commented out Chat) ── */}
            {/* <div style={{
              width: showSplitChat ? chatWidth : 0,
              minWidth: 0,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: dragging ? 'none' : 'width 220ms cubic-bezier(0.4,0,0.2,1)',
              background: 'var(--surface)',
              borderLeft: showSplitChat ? '1px solid var(--brd)' : 'none',
            }}>
              {showSplitChat && (
                <div style={{ width: chatWidth, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <ChatPanel />
                </div>
              )}
            </div> */}

          </main>
        </div>
      </div>
    </>
  )
}
