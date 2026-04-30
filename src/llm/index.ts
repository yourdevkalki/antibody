import { MockLLM } from "./mock.ts";
import { TokenRouterLLM } from "./tokenrouter.ts";
import type { LLMClient } from "./types.ts";

export type { LLMClient, GenerateOptions, GenerateResult, ToolDefinition, ToolCall, ChatMessage } from "./types.ts";
export { MockLLM, TokenRouterLLM };

export function getLLMClient(): LLMClient {
  const apiKey = process.env.TOKENROUTER_API_KEY;
  const baseURL = process.env.TOKENROUTER_BASE_URL;
  const model = process.env.TOKENROUTER_MODEL;

  if (!apiKey || !baseURL || !model) {
    console.warn("[llm] TOKENROUTER_* env vars not all set — using MockLLM");
    return new MockLLM();
  }
  return new TokenRouterLLM({ apiKey, baseURL, model });
}
