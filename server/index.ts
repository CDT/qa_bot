import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { loadConfig } from "./config.js";
import { createKb, KbError } from "./kb.js";
import { createLlm } from "./llm.js";
import { createOrchestrator } from "./orchestrator.js";

const cfg = loadConfig();
const kb = await createKb(cfg.kbDir);
const llm = createLlm(cfg);
const orchestrator = createOrchestrator(kb, llm, cfg.model);

const app = new Hono();

app.get("/api/kb/files", (c) => c.json({ files: kb.list() }));

app.get("/api/kb/files/:path{.+}", async (c) => {
  try {
    return c.json(await kb.read(c.req.param("path")));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return c.json({ error: "not found" }, 404);
    }
    if (e instanceof KbError) return c.json({ error: e.message }, e.status as 400);
    return c.json({ error: (e as Error).message }, 500);
  }
});

app.put("/api/kb/files/:path{.+}", async (c) => {
  try {
    const body = (await c.req.json()) as { content?: unknown };
    if (typeof body.content !== "string") {
      return c.json({ error: "content must be a string" }, 400);
    }
    return c.json(await kb.write(c.req.param("path"), body.content));
  } catch (e) {
    if (e instanceof KbError) return c.json({ error: e.message }, e.status as 400);
    return c.json({ error: (e as Error).message }, 500);
  }
});

app.delete("/api/kb/files/:path{.+}", async (c) => {
  try {
    await kb.remove(c.req.param("path"));
    return c.body(null, 204);
  } catch (e) {
    if (e instanceof KbError) return c.json({ error: e.message }, e.status as 400);
    return c.json({ error: (e as Error).message }, 500);
  }
});

app.post("/api/chat", async (c) => {
  const body = (await c.req.json()) as {
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
  };
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return streamSSE(c, async (stream) => {
    const write = (event: string, data: unknown) =>
      stream.writeSSE({ event, data: JSON.stringify(data) });
    try {
      await orchestrator.chat(messages, {
        onToken: (text) => write("token", text),
        onToolCall: (name, args) => write("tool_call", { name, args }),
        onCitation: (path) => write("citation", path),
      });
    } catch (e) {
      await write("error", (e as Error).message);
    }
    await stream.writeSSE({ event: "done", data: "" });
  });
});

app.use("/*", serveStatic({ root: "./dist/web" }));
app.get("*", serveStatic({ path: "./dist/web/index.html" }));

serve({ fetch: app.fetch, port: cfg.port });
console.log(`QA bot listening on http://localhost:${cfg.port}`);
console.log(`  model:    ${cfg.model}`);
console.log(`  base url: ${cfg.baseUrl}`);
console.log(`  kb dir:   ${cfg.kbDir}`);
