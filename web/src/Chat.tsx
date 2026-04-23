import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type ToolCall = { name: string; args: unknown };

export type Msg = {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  toolCalls?: ToolCall[];
  error?: string;
};

export function Chat({
  onOpenFile,
  initialMessages = [],
  onUpdate,
}: {
  onOpenFile?: (path: string) => void;
  initialMessages?: Msg[];
  onUpdate?: (messages: Msg[]) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const prevBusyRef = useRef(false);

  messagesRef.current = messages;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (prevBusyRef.current && !busy && messagesRef.current.length > 0) {
      onUpdate?.(messagesRef.current);
    }
    prevBusyRef.current = busy;
  }, [busy, onUpdate]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    const patchLast = (fn: (m: Msg) => Msg) =>
      setMessages((prev) => {
        const copy = prev.slice();
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!r.body) throw new Error("no response body");

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const ev = parseSse(part);
          if (!ev) continue;
          if (ev.event === "token") {
            const t = JSON.parse(ev.data) as string;
            patchLast((m) => ({ ...m, content: m.content + t }));
          } else if (ev.event === "tool_call") {
            const tc = JSON.parse(ev.data) as ToolCall;
            patchLast((m) => ({ ...m, toolCalls: [...(m.toolCalls ?? []), tc] }));
          } else if (ev.event === "citation") {
            const p = JSON.parse(ev.data) as string;
            patchLast((m) => ({ ...m, citations: [...(m.citations ?? []), p] }));
          } else if (ev.event === "error") {
            const msg = JSON.parse(ev.data) as string;
            patchLast((m) => ({ ...m, error: msg }));
          }
        }
      }
    } catch (e) {
      patchLast((m) => ({ ...m, error: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  const showDots =
    busy &&
    messages[messages.length - 1]?.role === "assistant" &&
    !messages[messages.length - 1]?.content;

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h3>Ask your knowledge base</h3>
            <p>The assistant will search your files and answer with citations.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            {m.role === "user" ? (
              <div className="bubble">{m.content}</div>
            ) : (
              <>
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="tool-calls">
                    {m.toolCalls.map((tc, j) => (
                      <div key={j} className="tool-call">
                        <span className="tool-call-arrow">→</span>
                        <span className="tool-call-name">{tc.name}</span>
                        <span className="tool-call-args">({JSON.stringify(tc.args)})</span>
                      </div>
                    ))}
                  </div>
                )}
                {m.content && (
                  <div className="msg-body msg-markdown">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
                {m.citations && m.citations.length > 0 && (
                  <div className="citations">
                    <span className="citations-label">Sources</span>
                    {m.citations.map((c, j) => (
                      <button
                        key={j}
                        className="citation"
                        onClick={() => onOpenFile?.(c)}
                        title="Open in editor"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                {m.error && <div className="error">{m.error}</div>}
              </>
            )}
          </div>
        ))}

        {showDots && (
          <div className="msg msg-assistant streaming-indicator">
            <span className="dot" /><span className="dot" /><span className="dot" />
          </div>
        )}
      </div>

      <div className="chat-input">
        <div className="chat-input-inner">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="chat-send-btn" onClick={send} disabled={busy || !input.trim()}>
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseSse(block: string): { event: string; data: string } | null {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data && event === "message") return null;
  return { event, data };
}
