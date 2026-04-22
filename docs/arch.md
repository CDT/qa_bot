# Architecture

## Components

### Backend

- **KB Service** — CRUD on markdown files on disk. Owns the KB directory and the derived index (filename + first heading).
- **LLM Gateway** — Provider-agnostic chat / tool-use interface. Swappable adapters: DeepSeek (default), OpenAI, Anthropic, local (e.g. Ollama). All providers are used through the same internal API.
- **Retrieval Orchestrator** — Runs the agentic grep-then-read loop. Exposes three tools to the LLM: `list_files`, `grep_files`, `read_file`. Loops until the model produces an answer.
- **Chat API** — Accepts user questions, drives the orchestrator, streams tokens and citations back to the frontend.

### Frontend

- **Browser** — Lists KB files with titles; preview in place.
- **Editor** — Markdown editor for create / update / delete.
- **Chat** — Conversational UI that renders streamed answers and citation links back to source files.

## Data flow — query

1. User sends a question from the Chat UI.
2. Chat API opens a tool-use session with the LLM Gateway, exposing `list_files` / `grep_files` / `read_file`.
3. The LLM iterates: inspects the index, greps for keywords, reads selected files, then produces an answer referencing them.
4. API streams tokens and final citations to the client.

## Data flow — KB edit

1. Frontend calls a KB Service endpoint (create / update / delete).
2. Service writes the file to disk and refreshes that entry in the in-memory index.
3. The next query automatically sees the updated file — there is no separate reindex step.

## Proposed tech defaults (non-binding)

- Backend: Python + FastAPI (mature LLM SDK ecosystem).
- Frontend: React plus a markdown editor library (e.g. Milkdown, CodeMirror).
- Storage: plain files under a `kb/` directory; optionally Git-backed for history.

These are defaults for getting started; nothing in the architecture above depends on a specific framework.
