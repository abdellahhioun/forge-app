import type { Project, GitStatus, GitCommit, ChatSession, ChatMessage } from '../../../shared/types'

declare global {
  interface Window {
    forge: {
      projects: {
        list: () => Promise<Project[]>
        add: (path?: string) => Promise<Project | null>
        remove: (id: number) => Promise<{ success: boolean }>
      }
      git: {
        status:       (cwd: string) => Promise<GitStatus>
        diff:         (cwd: string) => Promise<string>
        log:          (cwd: string, limit?: number) => Promise<GitCommit[]>
        commit:       (cwd: string, message: string) => Promise<{ ok: boolean; out: string }>
        push:         (cwd: string) => Promise<{ ok: boolean; out: string }>
        branch:       (cwd: string, name: string) => Promise<{ ok: boolean; out: string }>
        branches:     (cwd: string) => Promise<{ current: string; local: string[]; remote: string[] }>
        switchBranch: (cwd: string, name: string) => Promise<{ ok: boolean; out: string }>
        pr:           (cwd: string, title: string, body: string, base: string) => Promise<{ ok: boolean; out: string }>
      }
      terminal: {
        spawn: (id: string, cwd: string) => Promise<{ success: boolean }>
        input: (id: string,  string) => Promise<void>
        resize: (id: string, cols: number, rows: number) => Promise<void>
        kill: (id: string) => Promise<void>
        onOutput: (cb: (id: string,  string) => void) => void
      }
      chat: {
        sessions: (projectId?: number) => Promise<ChatSession[]>
        messages: (sessionId: number) => Promise<ChatMessage[]>
        send: (sessionId: number, role: string, content: string) => Promise<{ success: boolean }>
      }
      files: {
        list: (cwd: string) => Promise<any[]>
        read: (path: string) => Promise<{ ok: boolean; content?: string; error?: string }>
        write: (path: string, content: string) => Promise<{ ok: boolean }>
      }
      context: {
        get: (cwd: string) => Promise<any>
        index: (cwd: string) => Promise<{ success: boolean }>
      }
    }
  }
}

export {}
