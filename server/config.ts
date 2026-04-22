import "dotenv/config";

export type Config = {
  kbDir: string;
  port: number;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export function loadConfig(): Config {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env var: LLM_API_KEY (copy .env.example to .env)");
  }
  return {
    kbDir: process.env.KB_DIR ?? "./kb",
    port: Number.parseInt(process.env.PORT ?? "3000", 10),
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.deepseek.com",
    apiKey,
    model: process.env.LLM_MODEL ?? "deepseek-chat",
  };
}
