import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import type { LLMClient, GenerateOptions, GenerateResult, ToolCall } from "./types.ts";

export interface TokenRouterOptions {
  apiKey: string;
  baseURL: string;
  model: string;
}

export class TokenRouterLLM implements LLMClient {
  readonly providerLabel: string;
  private client: OpenAI;
  private model: string;

  constructor(opts: TokenRouterOptions) {
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
    this.model = opts.model;
    this.providerLabel = `tokenrouter:${opts.model}`;
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: opts.system },
      ...opts.messages.map((m) => {
        if (m.role === "tool") {
          return { role: "tool" as const, content: m.content, tool_call_id: m.toolCallId ?? "" };
        }
        return { role: m.role as "user" | "assistant", content: m.content };
      }),
    ];

    const tools = opts.tools?.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const tool_choice =
      opts.forceTool && tools
        ? ({ type: "function" as const, function: { name: opts.forceTool } })
        : tools
        ? "auto"
        : undefined;

    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1024,
    });

    const choice = res.choices[0];
    const msg = choice?.message;
    const tc = msg?.tool_calls?.[0];

    if (tc && tc.type === "function") {
      const toolCall: ToolCall = {
        id: tc.id ?? randomUUID(),
        name: tc.function.name,
        arguments: safeJson(tc.function.arguments),
      };
      return { toolCall, raw: res };
    }

    return { text: msg?.content ?? "", raw: res };
  }
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
