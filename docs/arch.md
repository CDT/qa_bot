# Architecture

## Guiding principle

Personal internal tool — optimize for the smallest number of obvious moving parts. **One Node process** serves the API and the static frontend. No containers, no auxiliary services, no orchestration.

## Components (single Node process)

- **KB Service** — CRUD on markdown files on disk. Owns the KB directory and the derived in-memory index (filename + first heading).
- **LLM Gateway** — Thin wrapper around the OpenAI-compatible chat / tool-use API. Because DeepSeek, OpenAI, Ollama, LM Studio, vLLM, etc. all speak the same protocol, a single client with a configurable `baseURL` and `apiKey` covers them all.
- **Retrieval Orchestrator** — Runs the agentic grep-then-read loop. Exposes three tools to the LLM: `list_files`, `grep_files`, `read_file`. Loops until the model produces a final answer.
- **Chat API** — Accepts user questions, drives the orchestrator, streams tokens and citations back to the frontend via SSE.

## Frontend

- **Browser** — Lists KB files with titles; preview in place.
- **Editor** — Markdown editor for create / update / delete.
- **Chat** — Streams answers and renders citation links back to source files.
- **Chat History** — Sidebar chat list backed by `localStorage`. Sessions are created automatically on first send, updated after each response, and listed newest-first. No server involvement — all persistence is client-side.

## Data flow — query

1. User sends a question from the Chat UI.
2. Chat API opens a tool-use session with the LLM Gateway, exposing `list_files` / `grep_files` / `read_file`.
3. The LLM iterates: inspects the index, greps for keywords, reads selected files, then produces an answer referencing them.
4. API streams tokens and final citations to the client.

## Data flow — KB edit

1. Frontend calls a KB Service endpoint (create / update / delete).
2. Service writes the file to disk and refreshes that entry in the in-memory index.
3. The next query sees the updated file immediately — no separate reindex step.

## Stack

- **Runtime**: Node.js (LTS), TypeScript.
- **Server**: Hono — tiny, first-class SSE streaming (`streamSSE`), zero-config TypeScript.
- **LLM client**: the `openai` npm package, pointed at DeepSeek's base URL by default.
- **Frontend**: Vite + React + TypeScript, built to static files and served by the same Node process.
- **Storage**: a `kb/` directory of markdown files.

## Run model

- `npm run dev` during development (Vite dev server + Node server with HMR).
- `npm run build && npm start` for local use (single Node process on `http://localhost:PORT`).

## Explicitly out of scope

- Authentication, authorization, multi-user support.
- Containers, orchestration, CI/CD, observability stacks.
- Server-side chat history persistence, audit logs, metrics, rate limiting.
- RAG, embeddings, vector databases.
