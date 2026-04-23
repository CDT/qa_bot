import { useCallback, useEffect, useRef, useState } from "react";
import { Browser, type KbFile } from "./Browser";
import { Editor } from "./Editor";
import { Chat, type Msg } from "./Chat";

type ChatSession = {
  id: string;
  title: string;
  messages: Msg[];
  updatedAt: number;
};

type View = { kind: "chat" } | { kind: "edit"; path: string | null };

function loadSessions(): ChatSession[] {
  try { return JSON.parse(localStorage.getItem("chat_sessions") ?? "[]"); }
  catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem("chat_sessions", JSON.stringify(sessions));
}

export function App() {
  const [files, setFiles] = useState<KbFile[]>([]);
  const [view, setView] = useState<View>({ kind: "chat" });
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/kb/files");
    const data = (await r.json()) as { files: KbFile[] };
    setFiles(data.files);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function newChat() {
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    setView({ kind: "chat" });
  }

  function openSession(id: string) {
    setCurrentSessionId(id);
    currentSessionIdRef.current = id;
    setView({ kind: "chat" });
  }

  function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      saveSessions(updated);
      return updated;
    });
    if (currentSessionIdRef.current === id) {
      setCurrentSessionId(null);
      currentSessionIdRef.current = null;
    }
  }

  const handleChatUpdate = useCallback((messages: Msg[]) => {
    if (messages.length === 0) return;
    const sessionId = currentSessionIdRef.current;
    const firstUserMsg = messages.find(m => m.role === "user")?.content ?? "New chat";
    const title = firstUserMsg.length > 50 ? firstUserMsg.slice(0, 50) + "…" : firstUserMsg;

    if (!sessionId) {
      const id = crypto.randomUUID();
      const session: ChatSession = { id, title, messages, updatedAt: Date.now() };
      setSessions(prev => { const u = [session, ...prev]; saveSessions(u); return u; });
      setCurrentSessionId(id);
      currentSessionIdRef.current = id;
    } else {
      setSessions(prev => {
        const u = prev.map(s =>
          s.id === sessionId ? { ...s, messages, updatedAt: Date.now() } : s
        );
        saveSessions(u);
        return u;
      });
    }
  }, []);

  const currentSession = sessions.find(s => s.id === currentSessionId) ?? null;

  return (
    <div className="app">
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.5 2L4 9h4.5L6 14l7-8H9l1.5-4H9.5z" fill="white"/>
            </svg>
          </div>
          <span className="sidebar-brand-name">QA Bot</span>
          <button
            className="theme-toggle"
            onClick={() => setDark((d) => !d)}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="8" cy="8" r="3"/>
                <line x1="8" y1="1" x2="8" y2="2.5"/>
                <line x1="8" y1="13.5" x2="8" y2="15"/>
                <line x1="1" y1="8" x2="2.5" y2="8"/>
                <line x1="13.5" y1="8" x2="15" y2="8"/>
                <line x1="3" y1="3" x2="4.1" y2="4.1"/>
                <line x1="11.9" y1="11.9" x2="13" y2="13"/>
                <line x1="13" y1="3" x2="11.9" y2="4.1"/>
                <line x1="4.1" y1="11.9" x2="3" y2="13"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7.5 1a6.5 6.5 0 1 0 6.5 6.5A5 5 0 0 1 7.5 1z"/>
              </svg>
            )}
          </button>
        </div>

        {/* Navigation */}
        <div className="sidebar-nav">
          <button className="btn-new-chat" onClick={newChat}>
            + New Chat
          </button>
          <button className="btn-new" onClick={() => setView({ kind: "edit", path: null })}>
            + KB
          </button>
        </div>

        {/* Scrollable content */}
        <div className="sidebar-scroll">
          {/* Chat history */}
          {sessions.length > 0 && (
            <>
              <div className="sidebar-section-label">Chats</div>
              <ul className="chat-list">
                {sessions.map(s => (
                  <li key={s.id} className={`chat-list-item${s.id === currentSessionId ? " active" : ""}`}>
                    <button className="chat-list-btn" onClick={() => openSession(s.id)}>
                      {s.title}
                    </button>
                    <button
                      className="chat-list-delete"
                      onClick={(e) => deleteSession(s.id, e)}
                      title="Delete chat"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Knowledge Base */}
          {files.length > 0 && (
            <div className="sidebar-section-label">Knowledge Base</div>
          )}
          <Browser
            files={files}
            selected={view.kind === "edit" ? view.path : null}
            onPick={(p) => setView({ kind: "edit", path: p })}
          />
        </div>
      </aside>

      <main>
        {view.kind === "chat" ? (
          <Chat
            key={currentSessionId ?? "new"}
            initialMessages={currentSession?.messages ?? []}
            onUpdate={handleChatUpdate}
            onOpenFile={(p) => setView({ kind: "edit", path: p })}
          />
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
