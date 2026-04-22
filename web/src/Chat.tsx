import { useEffect, useRef, useState } from "react";

type ToolCall = { name: string; args: unknown };

type Msg = {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  toolCalls?: ToolCall[];
  error?: string;
};

export function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

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
            patchLast((m) => ({
              ...m,
              citations: [...(m.citations ?? []), p],
            }));
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

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="empty">Ask a question about your knowledge base.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <div className="tool-calls">
                {m.toolCalls.map((tc, j) => (
                  <div key={j} className="tool-call">
                    → {tc.name}({JSON.stringify(tc.args)})
                  </div>
                ))}
              </div>
            )}
            {m.content && <div className="msg-body">{m.content}</div>}
            {m.citations && m.citations.length > 0 && (
              <div className="citations">
                Sources:{" "}
                {m.citations.map((c, j) => (
                  <span key={j} className="citation">
                    {c}
                    {j < m.citations!.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            )}
            {m.error && <div className="error">{m.error}</div>}
          </div>
        ))}
      </div>
      <div className="chat-input">
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
        <button onClick={send} disabled={busy || !input.trim()}>
          {busy ? "…" : "Send"}
        </button>
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
