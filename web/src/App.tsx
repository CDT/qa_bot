import { useCallback, useEffect, useState } from "react";
import { Browser, type KbFile } from "./Browser";
import { Editor } from "./Editor";
import { Chat } from "./Chat";

type View = { kind: "chat" } | { kind: "edit"; path: string | null };

export function App() {
  const [files, setFiles] = useState<KbFile[]>([]);
  const [view, setView] = useState<View>({ kind: "chat" });

  const refresh = useCallback(async () => {
    const r = await fetch("/api/kb/files");
    const data = (await r.json()) as { files: KbFile[] };
    setFiles(data.files);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-head">
          <button
            onClick={() => setView({ kind: "chat" })}
            className={view.kind === "chat" ? "active" : ""}
          >
            Chat
          </button>
          <button onClick={() => setView({ kind: "edit", path: null })}>
            + New
          </button>
        </div>
        <Browser
          files={files}
          selected={view.kind === "edit" ? view.path : null}
          onPick={(p) => setView({ kind: "edit", path: p })}
        />
      </aside>
      <main>
        {view.kind === "chat" ? (
          <Chat />
        ) : (
          <Editor
            path={view.path}
            onSaved={async (savedPath) => {
              await refresh();
              if (view.path === null) setView({ kind: "edit", path: savedPath });
            }}
            onDeleted={async () => {
              await refresh();
              setView({ kind: "chat" });
            }}
          />
        )}
      </main>
    </div>
  );
}
