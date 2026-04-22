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

## ChatMessage (ephemeral)

Not persisted. A turn:

```
{
  role: "user" | "assistant",
  content: string,
  citations?: string[]   // KB paths the model reported using
}
```

History lives in client state for the session.

## No database

Deliberately:

- KB = filesystem.
- Index = derived, in-memory.
- Chat history = client-side only.

Introduce persistence only if a concrete requirement forces it.
