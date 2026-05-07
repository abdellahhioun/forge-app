"use strict";
const electron = require("electron");
const IPC = {
  // Projects
  PROJECTS_LIST: "projects:list",
  PROJECTS_ADD: "projects:add",
  PROJECTS_REMOVE: "projects:remove",
  // Git
  GIT_STATUS: "git:status",
  GIT_DIFF: "git:diff",
  GIT_LOG: "git:log",
  GIT_COMMIT: "git:commit",
  GIT_PUSH: "git:push",
  GIT_BRANCH: "git:branch",
  // Terminal
  TERM_SPAWN: "terminal:spawn",
  TERM_INPUT: "terminal:input",
  TERM_OUTPUT: "terminal:output",
  TERM_KILL: "terminal:kill",
  // Chat
  CHAT_SESSIONS: "chat:sessions",
  CHAT_MESSAGES: "chat:messages",
  CHAT_SEND: "chat:send",
  // Context
  CONTEXT_GET: "context:get",
  CONTEXT_INDEX: "context:index"
};
electron.contextBridge.exposeInMainWorld("forge", {
  // Projects
  projects: {
    list: () => electron.ipcRenderer.invoke(IPC.PROJECTS_LIST),
    add: (path) => electron.ipcRenderer.invoke(IPC.PROJECTS_ADD, path),
    remove: (id) => electron.ipcRenderer.invoke(IPC.PROJECTS_REMOVE, id)
  },
  // Git
  git: {
    status: (cwd) => electron.ipcRenderer.invoke(IPC.GIT_STATUS, cwd),
    diff: (cwd) => electron.ipcRenderer.invoke(IPC.GIT_DIFF, cwd),
    log: (cwd, limit) => electron.ipcRenderer.invoke(IPC.GIT_LOG, cwd, limit),
    commit: (cwd, message) => electron.ipcRenderer.invoke(IPC.GIT_COMMIT, cwd, message),
    push: (cwd) => electron.ipcRenderer.invoke(IPC.GIT_PUSH, cwd),
    branch: (cwd, name) => electron.ipcRenderer.invoke(IPC.GIT_BRANCH, cwd, name)
  },
  // Terminal
  terminal: {
    spawn: (id, cwd) => electron.ipcRenderer.invoke(IPC.TERM_SPAWN, id, cwd),
    input: (id, string) => electron.ipcRenderer.invoke(IPC.TERM_INPUT, id, data),
    kill: (id) => electron.ipcRenderer.invoke(IPC.TERM_KILL, id),
    onOutput: (cb) => electron.ipcRenderer.on(IPC.TERM_OUTPUT, (_e, id, data2) => cb(id, data2))
  },
  // Chat
  chat: {
    sessions: (projectId) => electron.ipcRenderer.invoke(IPC.CHAT_SESSIONS, projectId),
    messages: (sessionId) => electron.ipcRenderer.invoke(IPC.CHAT_MESSAGES, sessionId),
    send: (sessionId, role, content) => electron.ipcRenderer.invoke(IPC.CHAT_SEND, sessionId, role, content)
  },
  // Context
  context: {
    get: (cwd) => electron.ipcRenderer.invoke(IPC.CONTEXT_GET, cwd),
    index: (cwd) => electron.ipcRenderer.invoke(IPC.CONTEXT_INDEX, cwd)
  }
});
