# QA Bot — Claude Code Guide

## Project Overview

Personal single-user LLM-powered QA bot. Users ask questions and get answers grounded in a curated markdown knowledge base. Runs entirely on localhost — no auth, no deployment complexity.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js (ESM, TypeScript via `tsx`) |
| Server | Hono v4 + `@hono/node-server` |
| LLM client | `openai` npm package (OpenAI-compatible; default: DeepSeek) |
| Frontend | Vite 5 + React 18 + TypeScript |
| Markdown render | `react-markdown` |
| Storage | `kb/` — plain `.md` files; chat history — browser `localStorage` |

## Dev Commands

```bash
npm run dev      # Vite dev server + tsx watch server (concurrent)
npm run build    # tsc + vite build → dist/
npm start        # node dist/server/index.js (production)
```

## Key Files

```
server/
  index.ts          — Hono routes (KB CRUD + POST /api/chat)
  orchestrator.ts   — Agentic grep-then-read loop; ChatTurn / ChatEvents types
  kb.ts             — KB filesystem CRUD + in-memory index
  llm.ts            — OpenAI client factory
  config.ts         — Env var loader

web/src/
  App.tsx           — Root layout, session management, sidebar
  Chat.tsx          — Chat UI + SSE streaming; exports Msg type
  Editor.tsx        — Markdown editor (create/edit/delete KB files)
  Browser.tsx       — Sidebar KB file list
  styles.css        — All styles (design tokens, layout, components)
```

## Architecture Invariants

- **Stateless server chat:** `POST /api/chat` receives the full `messages[]` array each request. The server discards it after responding. No session IDs, no server-side chat storage.
- **Chat history lives in `localStorage`:** `ChatSession[]` stored under key `chat_sessions`. Sessions are created on first message send and updated after each response completes.
- **No database:** KB = filesystem. Chat = localStorage. Keep it this way unless a concrete requirement forces server-side persistence.
- **One Node process:** serves both the API and the static frontend. No separate API / frontend servers in production.

## Data Model Summary

See `docs/data-model.md` for full details.

- `KbFile`: `{ path, title, content, mtime }` — `path` is the filesystem primary key
- `ChatSession`: `{ id, title, messages[], updatedAt }` — title = first 50 chars of first user message
- `Msg`: `{ role, content, citations?, toolCalls?, error? }` — only `role`+`content` sent to server

## API Summary

See `docs/api.md` for full details.

- `GET /api/kb/files` — list all KB files
- `GET /api/kb/files/:path+` — read one file
- `PUT /api/kb/files/:path+` — create/update
- `DELETE /api/kb/files/:path+` — delete
- `POST /api/chat` — SSE stream; events: `token`, `tool_call`, `citation`, `done`, `error`

## Environment Variables

```
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_API_KEY=sk-...
KB_DIR=./kb
PORT=3000
```

## Development Rules

### Update docs after each functionality change

After implementing any new feature or meaningful change, update the relevant docs in `docs/`:

- `docs/data-model.md` — if adding/changing any data entity or persistence mechanism
- `docs/arch.md` — if adding/changing a component, data flow, or removing something from "out of scope"
- `docs/api.md` — if adding/changing/removing any API endpoint or request/response shape
- `docs/requirements.md` — if the scope of the project changes

Keep `CLAUDE.md` in sync with any structural changes (new files, renamed files, changed commands, new invariants).
