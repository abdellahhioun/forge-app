import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useForgeStore } from '../store'
import { Plus, X } from 'lucide-react'

function genId() { return Math.random().toString(36).slice(2, 9) }

interface TermTab { id: string; title: string }

export default function TerminalPanel() {
  const { activeProject } = useForgeStore()
  const [tabs, setTabs]           = useState<TermTab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const termRefs   = useRef<Map<string, { xterm: XTerm; fit: FitAddon }>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const spawnedFor   = useRef<string | null>(null)
  const outputBound  = useRef(false)   // global onOutput listener registered once

  // Register the global output listener exactly once
  const ensureOutputListener = () => {
    if (outputBound.current) return
    outputBound.current = true
    window.forge.terminal.onOutput((tid, data) => {
      const ref = termRefs.current.get(tid)
      if (ref) ref.xterm.write(data)
    })
  }

  const spawnTab = (cwd: string) => {
    const id  = genId()
    const tab: TermTab = { id, title: cwd.split('/').pop() ?? 'shell' }
    setTabs(t => [...t, tab])
    setActiveTab(id)

    // Wait for the DOM node to be rendered, then init xterm
    const tryInit = (attempts = 0) => {
      const el = document.getElementById(`term-${id}`)
      if (!el || el.offsetWidth === 0) {
        if (attempts < 20) setTimeout(() => tryInit(attempts + 1), 50)
        return
      }

      const xterm = new XTerm({
        fontFamily: 'Geist Mono, Fira Code, monospace',
        fontSize: 13,
        lineHeight: 1.5,
        theme: {
          background: '#0f0e0d',
          foreground: '#e8e6e2',
          cursor: '#4f98a3',
          selectionBackground: 'rgba(79,152,163,.3)',
          black: '#1c1b19', red: '#d163a7', green: '#6daa45',
          yellow: '#e8af34', blue: '#5591c7', magenta: '#a86fdf',
          cyan: '#4f98a3', white: '#e8e6e2',
          brightBlack: '#4a4947', brightWhite: '#ffffff',
        },
        cursorBlink: true,
        allowTransparency: true,
      })

      const fit = new FitAddon()
      xterm.loadAddon(fit)
      xterm.open(el)

      // Fit after paint so the element has real dimensions
      requestAnimationFrame(() => {
        fit.fit()
        xterm.onResize(({ cols, rows }) => {
          window.forge.terminal.resize(id, cols, rows)
        })
        termRefs.current.set(id, { xterm, fit })

        // Wire input
        xterm.onData(data => window.forge.terminal.input(id, data))

        // Register global output listener once, then spawn
        ensureOutputListener()
        window.forge.terminal.spawn(id, cwd).then(() => {
          // Force shell to emit prompt
          window.forge.terminal.input(id, '')
          xterm.focus()
        })
      })
    }

    setTimeout(() => tryInit(), 50)
  }

  const closeTab = (id: string) => {
    window.forge.terminal.kill(id)
    const t = termRefs.current.get(id)
    t?.xterm.dispose()
    termRefs.current.delete(id)
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      setActiveTab(next[next.length - 1]?.id ?? null)
      return next
    })
  }

  // Spawn first terminal when a project becomes active
  useEffect(() => {
    if (!activeProject) return
    if (spawnedFor.current === activeProject.path) return
    spawnedFor.current = activeProject.path

    if (tabs.length === 0) {
      spawnTab(activeProject.path)
    } else {
      termRefs.current.forEach((_, tid) => {
        window.forge.terminal.input(tid, `cd "${activeProject.path}"\r`)
      })
      const title = activeProject.path.split('/').pop() ?? 'shell'
      setTabs(prev => prev.map(t => ({ ...t, title })))
    }
  }, [activeProject])

  // Refit on container resize
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      termRefs.current.forEach(({ fit }) => fit.fit())
    })
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f0e0d' }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--brd)',
        flexShrink: 0,
        padding: '0 4px',
      }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '0 10px', height: 36,
              fontSize: 11, fontFamily: 'var(--font-mono)',
              color: activeTab === tab.id ? 'var(--txt)' : 'var(--muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--ok)' : '2px solid transparent',
              cursor: 'pointer', flexShrink: 0,
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.title}</span>
            <button
              onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
              style={{ color: 'var(--faint)', display: 'flex' }}
            >
              <X size={10} />
            </button>
          </div>
        ))}

        <button
          onClick={() => activeProject && spawnTab(activeProject.path)}
          style={{ marginLeft: 4, color: 'var(--faint)', padding: '4px 6px', borderRadius: 'var(--r1)', display: 'flex' }}
          title="New terminal"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Terminal panes */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            id={`term-${tab.id}`}
            style={{
              position: 'absolute', inset: 0,
              padding: '8px 12px',
              display: activeTab === tab.id ? 'block' : 'none',
            }}
          />
        ))}
        {tabs.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 8,
            color: 'var(--faint)', fontSize: 13,
          }}>
            <span>{activeProject ? 'Opening terminal…' : 'Open a project to start a terminal'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
