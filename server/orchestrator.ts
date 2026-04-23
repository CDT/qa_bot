import type OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions.js";
import type { Kb } from "./kb.js";

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "List every knowledge base file with its relative path and title. Call this first to see what is available.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "grep_files",
      description:
        "Search across all knowledge base files for a regex pattern (case-insensitive). Returns matching lines with their file paths and line numbers.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern to match." },
        },
        required: ["pattern"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the full content of a knowledge base file. Prefer this over grep when you need the context around a match.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path returned by list_files, e.g. 'guides/setup.md'.",
          },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
];

const SYSTEM_PROMPT = `You are a helpful QA assistant. Answer the user's question using only the knowledge base provided through the tools.

Workflow:
1. Call list_files to see what exists.
2. Use grep_files for keyword searches, or pick files by title; then call read_file for anything that looks relevant.
3. Answer in the same language as the user's question.
4. At the end of your answer, list the file paths you actually used.

If the knowledge base does not contain the answer, say so honestly — do not invent facts.`;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatEvents = {
  onToken: (text: string) => void | Promise<void>;
  onToolCall: (name: string, args: unknown) => void | Promise<void>;
  onCitation: (path: string) => void | Promise<void>;
};

export type Orchestrator = {
  chat: (messages: ChatTurn[], events: ChatEvents) => Promise<void>;
};

const MAX_STEPS = 10;

export function createOrchestrator(
  kb: Kb,
  client: OpenAI,
  model: string,
): Orchestrator {
  async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
    try {
      if (name === "list_files") {
        return JSON.stringify(
          kb.list().map((f) => ({ path: f.path, title: f.title })),
        );
      }
      if (name === "grep_files") {
        const pattern = String(args.pattern ?? "");
        if (!pattern) return JSON.stringify({ error: "pattern is required" });
        return JSON.stringify(await kb.grep(pattern));
      }
      if (name === "read_file") {
        const p = String(args.path ?? "");
        if (!p) return JSON.stringify({ error: "path is required" });
        const f = await kb.read(p);
        return JSON.stringify({ path: f.path, title: f.title, content: f.content });
      }
      return JSON.stringify({ error: `unknown tool: ${name}` });
    } catch (e) {
      return JSON.stringify({ error: (e as Error).message });
    }
  }

  return {
    async chat(userMessages, events) {
      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...userMessages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const cited = new Set<string>();

      for (let step = 0; step < MAX_STEPS; step++) {
        const stream = await client.chat.completions.create({
          model,
          messages,
          tools,
          stream: true,
        });

        let assistantText = "";
        const callBuf: Record<
          number,
          { id: string; name: string; argsJson: string }
        > = {};

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            assistantText += delta.content;
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const slot =
                callBuf[tc.index] ??
                (callBuf[tc.index] = { id: "", name: "", argsJson: "" });
              if (tc.id) slot.id = tc.id;
              if (tc.function?.name) slot.name += tc.function.name;
              if (tc.function?.arguments) slot.argsJson += tc.function.arguments;
            }
          }
        }

        const calls = Object.values(callBuf);
        if (calls.length === 0) {
          // Final step — no tool calls, emit the answer now
          if (assistantText) await events.onToken(assistantText);
          return;
        }
        // Intermediate step — assistantText is thinking text, discard it

        messages.push({
          role: "assistant",
          content: assistantText || null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: "function" as const,
            function: { name: c.name, arguments: c.argsJson || "{}" },
          })),
        });

        for (const c of calls) {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(c.argsJson || "{}");
          } catch {
            parsed = {};
          }
          await events.onToolCall(c.name, parsed);
          const result = await runTool(c.name, parsed);
          messages.push({
            role: "tool",
            tool_call_id: c.id,
            content: result,
          });
          if (c.name === "read_file") {
            const p = typeof parsed.path === "string" ? parsed.path : "";
            if (p && !cited.has(p)) {
              cited.add(p);
              await events.onCitation(p);
            }
          }
        }
      }
    },
  };
}
