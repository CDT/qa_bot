# Data Model

Personal internal tool. Single entity, no database.

## KBFile

Stored as a markdown file on disk — the filesystem *is* the database.

| Field     | Source        | Description                                                                 |
|-----------|---------------|-----------------------------------------------------------------------------|
| `path`    | filesystem    | Relative path under the KB root, e.g. `guides/setup.md`. Primary key.       |
| `title`   | derived       | First markdown heading (`# ...`). Falls back to the filename stem if none.  |
| `content` | file body     | Full markdown text. Constraint: ≤ 10,000 Chinese characters.                |
| `mtime`   | filesystem    | Last-modified timestamp; used for UI sorting.                               |

## Index

An in-memory list of `{ path, title }` tuples, held by the Node process.

- Built on startup by walking the KB directory.
- Updated in place on each write / delete.
- Passed to the LLM via the `list_files` tool — small enough to fit in one prompt for any practical personal KB.

## ChatSession (localStorage)

Persisted in the browser via `localStorage` under the key `chat_sessions` as a JSON array. Each session:

```
{
  id:        string,   // crypto.randomUUID()
  title:     string,   // First user message, truncated to 50 chars
  messages:  Msg[],    // Full message history (see Msg type below)
  updatedAt: number    // Date.now() — used for ordering
}
```

Sessions are ordered newest-first in the sidebar chat list. Deleting a session removes it from `localStorage` immediately.

## Msg (within ChatSession)

```
{
  role:       "user" | "assistant",
  content:    string,
  citations?: string[],      // KB paths the model cited
  toolCalls?: ToolCall[],    // Tool calls made by the model (display only)
  error?:     string
}
```

Only `role` and `content` are sent to the server on each request — the rich fields are client-side display metadata.

## No database

Deliberately:

- KB = filesystem.
- Index = derived, in-memory.
- Chat history = browser `localStorage` (client-side only, no server).

Introduce server-side persistence only if a concrete requirement forces it.
