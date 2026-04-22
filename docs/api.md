# API

JSON over HTTP, served by a single Node process. **No authentication** — personal single-user tool on localhost.

Paths under `{path}` are URL-encoded relative paths within the KB root (e.g. `guides%2Fsetup.md`). Requests that would escape the KB root (`..`, absolute paths) are rejected with `400`.

## Knowledge Base

### `GET /api/kb/files`

List all KB files.

```json
{
  "files": [
    { "path": "guides/setup.md", "title": "Setup Guide", "mtime": "2026-04-22T10:00:00Z" }
  ]
}
```

### `GET /api/kb/files/{path}`

```json
{
  "path": "guides/setup.md",
  "title": "Setup Guide",
  "content": "# Setup Guide\n..."
}
```

### `PUT /api/kb/files/{path}`

Create or update. Rejects content exceeding 10,000 Chinese characters with `413 Payload Too Large`.

Request:

```json
{ "content": "# Title\n..." }
```

### `DELETE /api/kb/files/{path}`

Delete. Idempotent — deleting a missing file returns `204`.

## Chat

### `POST /api/chat`

Ask a question. The response is a Server-Sent Events stream.

Request:

```json
{
  "messages": [
    { "role": "user", "content": "How do I configure the model?" }
  ]
}
```

Stream events:

- `token` — incremental answer token
- `tool_call` — tool the model invoked (`list_files` / `grep_files` / `read_file`) with its argument, for UI transparency
- `citation` — a KB file path the model reported as a source
- `done` — end of stream

## Configuration

No runtime config API. Provider, model, and credentials are supplied via environment variables at start time:

```
LLM_BASE_URL=https://api.deepseek.com   # any OpenAI-compatible endpoint
LLM_MODEL=deepseek-chat
LLM_API_KEY=sk-...
KB_DIR=./kb
PORT=3000
```

Restart the Node process to change them.
