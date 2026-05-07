# ⚡ Forge App

> A personal AI-powered desktop IDE — built on Electron, powered by your MCP server.

Forge is a standalone desktop app that wraps your custom MCP server engine and gives you a full UI for coding, project management, git, terminal, AI chat, and more — without ever opening Cursor.

## Stack

- **Electron** — desktop shell (Node.js + Chromium).
- **React + Vite** — renderer (UI)
- **Monaco Editor** — VS Code's editor engine, embedded
- **xterm.js** — fully featured terminal emulator
- **MCP Server** — your custom 49-tool engine (from `abdellahhioun/test`)
- **TypeScript** — everywhere

## Architecture

```
forge-app/
├── main/                  ← Electron main process (Node.js)
│   ├── mcp-bridge.ts      ← spawns & talks to MCP server
│   └── ipc-handlers.ts    ← exposes MCP tools to renderer via IPC
├── renderer/              ← React/Vite frontend
│   └── src/
│       ├── chat/          ← AI conversation panel
│       ├── editor/        ← Monaco editor
│       ├── terminal/      ← xterm.js terminal
│       ├── git/           ← git sidebar
│       ├── dashboard/     ← live MCP dashboard
│       ├── tools/         ← tool palette (all 49 tools)
│       └── projects/      ← project switcher
├── shared/                ← types shared between main + renderer
└── package.json
```

## Roadmap

### 🔴 Tier 1 — Core
- [ ] Electron shell + MCP bridge
- [ ] Monaco editor
- [ ] xterm.js terminal
- [ ] AI chat panel (streaming)
- [ ] Project switcher (index_project + get_context)

### 🟡 Tier 2 — Power Features
- [ ] Tool palette (all 49 MCP tools with form UI)
- [ ] Git sidebar (status, diff, commit, push, branch)
- [ ] Live dashboard (WebSocket from MCP server)
- [ ] Memory & context panel

### 🟢 Tier 3 — Magic
- [ ] Inbox tab (read_inbox rendered as email client)
- [ ] Command palette (Cmd+P, search_code across projects)
- [ ] AI-generated PR descriptions
- [ ] Template gallery
- [ ] Native notifications

## Related

- MCP Server engine: [abdellahhioun/test](https://github.com/abdellahhioun/test)
