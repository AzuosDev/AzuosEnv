/** Role of a message in the conversation sent to the model. */
export type AiRole = 'system' | 'user' | 'assistant' | 'tool';

/** One call the model asked the server to run. */
export interface AiToolCall {
  id: string;
  name: string;
  /** JSON string, exactly as the model produced it. */
  arguments: string;
}

export interface AiMessage {
  role: AiRole;
  content: string;
  /** Only on an assistant message that asked for tools. */
  toolCalls?: AiToolCall[];
  /** Only on a tool message, pointing back to the call it answers. */
  toolCallId?: string;
  name?: string;
}

/** Tool offered to the model, described by a JSON schema. */
export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiCompletionRequest {
  messages: AiMessage[];
  tools?: AiToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  /** `json_object` forces a parseable answer (used by tasks-from-text). */
  responseFormat?: 'text' | 'json_object';
}

export interface AiUsage {
  tokensIn: number;
  tokensOut: number;
}

export interface AiCompletion {
  content: string;
  toolCalls: AiToolCall[];
  usage: AiUsage;
  model: string;
}

/** What the stream of the provider hands over, in order. */
export type AiStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'toolCalls'; toolCalls: AiToolCall[] }
  | { type: 'end'; usage: AiUsage; model: string };

/**
 * Contract of the language model. GrokProvider talks to the OpenAI-compatible API
 * of xAI; the stub answers locally so no test ever reaches the network.
 */
export interface AiProvider {
  readonly model: string;
  complete(request: AiCompletionRequest): Promise<AiCompletion>;
  stream(request: AiCompletionRequest): AsyncIterable<AiStreamEvent>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
