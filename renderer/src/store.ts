import { create } from 'zustand'
import type { Project, ChatSession } from '../../shared/types'

type Panel = 'editor' | 'search' | 'terminal' | 'git' | 'chat' | 'dashboard' | 'tools'

interface ForgeState {
  // Theme
  theme: 'dark' | 'light'
  toggleTheme: () => void

  // Active project
  projects: Project[]
  activeProject: Project | null
  setProjects: (p: Project[]) => void
  setActiveProject: (p: Project | null) => void

  // Active panel
  activePanel: Panel
  setActivePanel: (p: Panel) => void

  // Chat
  activeChatSession: ChatSession | null
  setActiveChatSession: (s: ChatSession | null) => void

  // Terminal
  terminalCwd: string
  setTerminalCwd: (cwd: string) => void

  // Editor
  openFiles: { path: string; content: string; dirty: boolean }[]
  activeFile: string | null
  openFile: (path: string, content: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  markFileSaved: (path: string) => void

  // File tree refresh signal — increment to trigger a reload
  fileTreeRevision: number
  refreshFileTree: () => void
}

export const useForgeStore = create<ForgeState>((set, get) => ({
  theme: 'dark',
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    set({ theme: next })
  },

  projects: [],
  activeProject: null,
  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProject) => {
    set({ activeProject })
    if (activeProject) set({ terminalCwd: activeProject.path })
  },

  activePanel: 'editor',
  setActivePanel: (activePanel) => set({ activePanel }),

  activeChatSession: null,
  setActiveChatSession: (activeChatSession) => set({ activeChatSession }),

  terminalCwd: '/Users',
  setTerminalCwd: (terminalCwd) => set({ terminalCwd }),

  openFiles: [],
  activeFile: null,
  openFile: (path, content) => {
    const already = get().openFiles.find(f => f.path === path)
    if (!already) set(s => ({ openFiles: [...s.openFiles, { path, content, dirty: false }] }))
    set({ activeFile: path })
  },
  closeFile: (path) => {
    const next = get().openFiles.filter(f => f.path !== path)
    set({ openFiles: next, activeFile: next[next.length - 1]?.path ?? null })
  },
  setActiveFile: (path) => set({ activeFile: path }),
  updateFileContent: (path, content) => set(s => ({
    openFiles: s.openFiles.map(f => f.path === path ? { ...f, content, dirty: true } : f)
  })),
  markFileSaved: (path) => set(s => ({
    openFiles: s.openFiles.map(f => f.path === path ? { ...f, dirty: false } : f)
  })),

  fileTreeRevision: 0,
  refreshFileTree: () => set(s => ({ fileTreeRevision: s.fileTreeRevision + 1 })),
}))
