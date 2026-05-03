import { TokenRouterLLM } from "./tokenrouter.ts";
import type { LLMClient } from "./types.ts";

export type { LLMClient, GenerateOptions, GenerateResult, ToolDefinition, ToolCall, ChatMessage } from "./types.ts";
export { TokenRouterLLM };

export function getLLMClient(): LLMClient {
  const apiKey = process.env.TOKENROUTER_API_KEY;
  const baseURL = process.env.TOKENROUTER_BASE_URL;
  const model = process.env.TOKENROUTER_MODEL;

  if (!apiKey || !baseURL || !model) {
    throw new Error(
      "TOKENROUTER_API_KEY, TOKENROUTER_BASE_URL, and TOKENROUTER_MODEL must all be set in .env",
    );
  }
  return new TokenRouterLLM({ apiKey, baseURL, model });
}
