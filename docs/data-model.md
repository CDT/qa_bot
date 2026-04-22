# Data Model

## KBFile

The only first-class entity. Stored as a markdown file on disk — the filesystem *is* the database.

| Field     | Source        | Description                                                                 |
|-----------|---------------|-----------------------------------------------------------------------------|
| `path`    | filesystem    | Relative path under the KB root, e.g. `guides/setup.md`. Primary key.       |
| `title`   | derived       | First markdown heading (`# ...`). Falls back to filename stem if no heading. |
| `content` | file body     | Full markdown text. Constraint: ≤ 10,000 Chinese characters.                |
| `mtime`   | filesystem    | Last-modified timestamp; used for UI sorting.                               |

## Index

An in-memory list of `{ path, title }` tuples.

- Built on startup by walking the KB directory.
- Updated in place on each write / delete.
- Passed to the LLM via the `list_files` tool — small enough to fit entirely in one prompt for any practical KB size.

## ChatMessage (ephemeral)

Not persisted in v1. A turn looks like:

```
{
  role: "user" | "assistant",
  content: string,
  citations?: string[]   // KB paths the model reported using
}
```

History lives in client state for the duration of the session.

## No database

Deliberately no RDBMS and no vector store:

- KB = filesystem.
- Index = derived, in-memory.
- Chat history = client-side only.

Introduce persistence (chat history, user accounts, audit trail) only when a concrete requirement forces it.
