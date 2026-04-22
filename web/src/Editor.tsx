import { useEffect, useState } from "react";

export function Editor({
  path,
  onSaved,
  onDeleted,
}: {
  path: string | null;
  onSaved: (savedPath: string) => Promise<void> | void;
  onDeleted: () => Promise<void> | void;
}) {
  const [currentPath, setCurrentPath] = useState(path ?? "");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCurrentPath(path ?? "");
    setError(null);
    if (!path) {
      setContent("");
      return;
    }
    fetch(`/api/kb/files/${encodeURIComponent(path)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`failed to load: ${r.status}`);
        return (await r.json()) as { content: string };
      })
      .then((d) => setContent(d.content))
      .catch((e) => setError((e as Error).message));
  }, [path]);

  async function save() {
    const target = currentPath.trim();
    if (!target) {
      setError("path is required (e.g. notes/my-note.md)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/kb/files/${encodeURIComponent(target)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `error ${r.status}`);
        return;
      }
      await onSaved(target);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!path) return;
    if (!confirm(`Delete ${path}?`)) return;
    await fetch(`/api/kb/files/${encodeURIComponent(path)}`, { method: "DELETE" });
    await onDeleted();
  }

  return (
    <div className="editor">
      <div className="editor-head">
        <input
          value={currentPath}
          onChange={(e) => setCurrentPath(e.target.value)}
          placeholder="path/to/file.md"
          disabled={!!path}
          spellCheck={false}
        />
        <button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        {path && (
          <button onClick={remove} className="danger">
            Delete
          </button>
        )}
      </div>
      <textarea
        className="editor-body"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# Title&#10;&#10;Write markdown here…"
        spellCheck={false}
      />
      {error && <div className="error">{error}</div>}
    </div>
  );
}
