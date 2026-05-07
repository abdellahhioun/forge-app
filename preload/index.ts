import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AiModel } from '../shared/types'

contextBridge.exposeInMainWorld('forge', {
  // Projects
  projects: {
    list:   ()              => ipcRenderer.invoke(IPC.PROJECTS_LIST),
    add:    (path?: string) => ipcRenderer.invoke(IPC.PROJECTS_ADD, path),
    remove: (id: number)    => ipcRenderer.invoke(IPC.PROJECTS_REMOVE, id),
  },

  // Files
  files: {
    list:    (cwd: string)                          => ipcRenderer.invoke('files:list', cwd),
    read:    (path: string)                         => ipcRenderer.invoke('files:read', path),
    write:   (path: string, content: string)        => ipcRenderer.invoke('files:write', path, content),
    rename:  (oldPath: string, newPath: string)     => ipcRenderer.invoke('files:rename', oldPath, newPath),
    delete:  (path: string)                         => ipcRenderer.invoke('files:delete', path),
    mkdir:   (path: string)                         => ipcRenderer.invoke('files:mkdir', path),
    newfile: (path: string)                         => ipcRenderer.invoke('files:newfile', path),
  },

  // Git
  git: {
    status:       (cwd: string)                                            => ipcRenderer.invoke(IPC.GIT_STATUS, cwd),
    diff:         (cwd: string, filePath?: string)                         => ipcRenderer.invoke(IPC.GIT_DIFF, cwd, filePath),
    log:          (cwd: string, limit?: number)                            => ipcRenderer.invoke(IPC.GIT_LOG, cwd, limit),
    commit:       (cwd: string, message: string)                           => ipcRenderer.invoke(IPC.GIT_COMMIT, cwd, message),
    push:         (cwd: string)                                            => ipcRenderer.invoke(IPC.GIT_PUSH, cwd),
    branch:       (cwd: string, name: string)                              => ipcRenderer.invoke(IPC.GIT_BRANCH, cwd, name),
    branches:     (cwd: string)                                            => ipcRenderer.invoke(IPC.GIT_BRANCHES, cwd),
    switchBranch: (cwd: string, name: string)                              => ipcRenderer.invoke(IPC.GIT_BRANCH_SWITCH, cwd, name),
    pr:           (cwd: string, title: string, body: string, base: string) => ipcRenderer.invoke(IPC.GIT_PR, cwd, title, body, base),
    suggestCommit: (cwd: string)                                           => ipcRenderer.invoke(IPC.GIT_SUGGEST_COMMIT, cwd),
    suggestPR:    (cwd: string, base: string)                              => ipcRenderer.invoke(IPC.GIT_SUGGEST_PR, cwd, base),
  },

  // Terminal
  terminal: {
    spawn:    (id: string, cwd: string)                   => ipcRenderer.invoke(IPC.TERM_SPAWN, id, cwd),
    input:    (id: string, data: string)                 => ipcRenderer.invoke(IPC.TERM_INPUT, id, data),
    resize:   (id: string, cols: number, rows: number)    => ipcRenderer.invoke(IPC.TERM_RESIZE, id, cols, rows),
    kill:     (id: string)                                => ipcRenderer.invoke(IPC.TERM_KILL, id),
    onOutput: (cb: (id: string, data: string) => void)   =>
      ipcRenderer.on(IPC.TERM_OUTPUT, (_e, id, data) => cb(id, data)),
  },

  // Chat
  chat: {
    sessions:   (projectId?: number)                               => ipcRenderer.invoke(IPC.CHAT_SESSIONS, projectId),
    newSession: (title: string, projectId?: number)               => ipcRenderer.invoke(IPC.CHAT_SESSION_NEW, title, projectId),
    deleteSession: (sessionId: number)                            => ipcRenderer.invoke(IPC.CHAT_SESSION_DELETE, sessionId),
    messages:   (sessionId: number)                                => ipcRenderer.invoke(IPC.CHAT_MESSAGES, sessionId),
    send:       (sessionId: number, role: string, content: string) => ipcRenderer.invoke(IPC.CHAT_SEND, sessionId, role, content),
    ai:         (messages: Array<{role:string;content:string}>, projectCtx?: string, model?: AiModel, projectPath?: string) => ipcRenderer.invoke(IPC.CHAT_AI, messages, projectCtx, model, projectPath),
    onToken:    (cb: (token: string) => void) => { ipcRenderer.on(IPC.CHAT_AI_TOKEN, (_e, t) => cb(t)); return () => ipcRenderer.removeAllListeners(IPC.CHAT_AI_TOKEN) },
    onDone:     (cb: () => void)              => { ipcRenderer.on(IPC.CHAT_AI_DONE,  () => cb());     return () => ipcRenderer.removeAllListeners(IPC.CHAT_AI_DONE) },
    onError:    (cb: (err: string) => void)   => { ipcRenderer.on(IPC.CHAT_AI_ERROR, (_e, e) => cb(e)); return () => ipcRenderer.removeAllListeners(IPC.CHAT_AI_ERROR) },
  },

  // Context
  context: {
    get:   (cwd: string) => ipcRenderer.invoke(IPC.CONTEXT_GET, cwd),
    index: (cwd: string) => ipcRenderer.invoke(IPC.CONTEXT_INDEX, cwd),
  },
})
