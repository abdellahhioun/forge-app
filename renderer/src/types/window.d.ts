import type { Project, GitStatus, GitCommit, ChatSession, ChatMessage, AiModel } from '../../../shared/types'

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
        diff:         (cwd: string, filePath?: string) => Promise<string>
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
        newSession: (title: string, projectId?: number) => Promise<ChatSession[]>
        deleteSession: (sessionId: number) => Promise<{ success: boolean }>
        messages: (sessionId: number) => Promise<ChatMessage[]>
        send: (sessionId: number, role: string, content: string) => Promise<{ success: boolean }>
        ai: (messages: Array<{ role: string; content: string }>, projectCtx?: string, model?: AiModel, projectPath?: string) => Promise<void>
        onToken: (cb: (token: string) => void) => () => void
        onDone: (cb: () => void) => () => void
        onError: (cb: (err: string) => void) => () => void
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
