import OpenAI from "openai";
import type { Config } from "./config.js";

export function createLlm(cfg: Config): OpenAI {
  return new OpenAI({
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });
}
