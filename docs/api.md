# API

All endpoints are JSON over HTTP. Authentication is out of scope for v1.

Paths under `{path}` are URL-encoded relative paths within the KB root (e.g. `guides%2Fsetup.md`). Writes that would escape the KB root (`..`, absolute paths) are rejected.

## Knowledge Base

### `GET /api/kb/files`

List all KB files.

Response:

```json
{
  "files": [
    { "path": "guides/setup.md", "title": "Setup Guide", "mtime": "2026-04-22T10:00:00Z" }
  ]
}
```

### `GET /api/kb/files/{path}`

Return the raw markdown of a file.

Response:

```json
{
  "path": "guides/setup.md",
  "title": "Setup Guide",
  "content": "# Setup Guide\n..."
}
```

### `PUT /api/kb/files/{path}`

Create or update a file. Rejects content exceeding 10,000 Chinese characters with `413 Payload Too Large`.

Request:

```json
{ "content": "# Title\n..." }
```

### `DELETE /api/kb/files/{path}`

Delete a file. Idempotent — deleting a missing file returns `204`.

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

### `GET /api/config/model`

Return the active provider and model.

Response:

```json
{ "provider": "deepseek", "model": "deepseek-chat" }
```

### `PUT /api/config/model`

Switch provider / model. Credentials are supplied via environment variables, not this endpoint.

Request:

```json
{ "provider": "deepseek", "model": "deepseek-chat" }
```
