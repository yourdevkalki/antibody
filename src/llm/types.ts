export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolCallId?: string;
}

export interface GenerateOptions {
  system: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  forceTool?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface GenerateResult {
  text?: string;
  toolCall?: ToolCall;
  raw?: unknown;
}

export interface LLMClient {
  generate(opts: GenerateOptions): Promise<GenerateResult>;
  readonly providerLabel: string;
}
