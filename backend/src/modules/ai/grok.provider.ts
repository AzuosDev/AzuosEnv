import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AI_REQUEST_ATTEMPTS, AI_REQUEST_TIMEOUT_MS } from './ai-fields';
import {
  AiCompletion,
  AiCompletionRequest,
  AiMessage,
  AiProvider,
  AiStreamEvent,
  AiToolCall,
  AiUsage,
} from './ai-provider';

export interface GrokProviderOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface WireToolCall {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface WireMessage {
  content?: string | null;
  tool_calls?: WireToolCall[];
}

interface WireUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface WireCompletion {
  model?: string;
  usage?: WireUsage;
  choices?: { message?: WireMessage; delta?: WireMessage }[];
}

/** A 4xx other than 429 is the request itself: trying again would fail the same way. */
class PermanentProviderError extends Error {}

/**
 * Grok over the OpenAI-compatible API of xAI: chat completions, tool calling and
 * streaming by SSE. Every call times out in 60 s and is tried twice.
 */
@Injectable()
export class GrokProvider implements AiProvider {
  private readonly logger = new Logger(GrokProvider.name);

  readonly model: string;

  constructor(private readonly options: GrokProviderOptions) {
    this.model = options.model;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletion> {
    const response = await this.send(this.body(request, false));
    const payload = (await response.json()) as WireCompletion;
    const message = payload.choices?.[0]?.message ?? {};

    return {
      content: message.content ?? '',
      toolCalls: this.toolCallsOf(message.tool_calls ?? []),
      usage: this.usageOf(payload.usage),
      model: payload.model ?? this.model,
    };
  }

  async *stream(request: AiCompletionRequest): AsyncIterable<AiStreamEvent> {
    const response = await this.send(this.body(request, true));
    const body = response.body;

    if (!body) {
      throw this.unavailable(new Error('A resposta da xAI veio sem corpo.'));
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    const pending = new Map<number, WireToolCall>();
    let buffer = '';
    let usage: AiUsage = { tokensIn: 0, tokensOut: 0 };
    let model = this.model;

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const chunk = this.chunkOf(block);

        if (!chunk) {
          continue;
        }

        model = chunk.model ?? model;

        if (chunk.usage) {
          usage = this.usageOf(chunk.usage);
        }

        const delta = chunk.choices?.[0]?.delta;

        if (delta?.content) {
          yield { type: 'delta', text: delta.content };
        }

        for (const call of delta?.tool_calls ?? []) {
          this.mergeToolCall(pending, call);
        }
      }
    }

    if (pending.size > 0) {
      yield { type: 'toolCalls', toolCalls: this.toolCallsOf([...pending.values()]) };
    }

    yield { type: 'end', usage, model };
  }

  /** Body of the OpenAI-compatible chat completions endpoint. */
  private body(request: AiCompletionRequest, stream: boolean): Record<string, unknown> {
    return {
      model: this.model,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      messages: request.messages.map((message) => this.wireMessage(message)),
      ...(request.tools?.length
        ? {
            tools: request.tools.map((tool) => ({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
          }
        : {}),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
      ...(request.responseFormat === 'json_object'
        ? { response_format: { type: 'json_object' } }
        : {}),
    };
  }

  private wireMessage(message: AiMessage): Record<string, unknown> {
    if (message.role === 'tool') {
      return { role: 'tool', content: message.content, tool_call_id: message.toolCallId };
    }

    if (message.toolCalls?.length) {
      return {
        role: message.role,
        content: message.content,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }

    return { role: message.role, content: message.content };
  }

  /** Two attempts: a timeout, a network failure, a 429 or a 5xx is tried again. */
  private async send(body: Record<string, unknown>): Promise<Response> {
    let last: unknown;

    for (let attempt = 1; attempt <= AI_REQUEST_ATTEMPTS; attempt += 1) {
      try {
        return await this.fetchOnce(body);
      } catch (error) {
        last = error;

        if (error instanceof PermanentProviderError || attempt === AI_REQUEST_ATTEMPTS) {
          break;
        }

        this.logger.warn(
          `Tentativa ${attempt} na xAI falhou: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw this.unavailable(last);
  }

  private async fetchOnce(body: Record<string, unknown>): Promise<Response> {
    const url = `${this.options.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      return response;
    }

    const detail = `xAI respondeu ${response.status}.`;

    if (response.status >= 500 || response.status === 429) {
      throw new Error(detail);
    }

    throw new PermanentProviderError(detail);
  }

  private unavailable(error: unknown): ServiceUnavailableException {
    this.logger.error(
      'Falha na chamada à xAI.',
      error instanceof Error ? error.stack : String(error),
    );

    return new ServiceUnavailableException({
      code: 'AI_PROVIDER_ERROR',
      message: 'A IA está indisponível agora. Tente novamente.',
    });
  }

  /** One SSE block; the comments and the final `[DONE]` are ignored. */
  private chunkOf(block: string): WireCompletion | null {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');

    if (data.length === 0 || data === '[DONE]') {
      return null;
    }

    try {
      return JSON.parse(data) as WireCompletion;
    } catch {
      this.logger.warn('Bloco SSE inválido ignorado.');

      return null;
    }
  }

  /** The stream sends the name once and the arguments in pieces, per index. */
  private mergeToolCall(pending: Map<number, WireToolCall>, call: WireToolCall): void {
    const index = call.index ?? 0;
    const current = pending.get(index);

    pending.set(index, {
      index,
      id: call.id ?? current?.id,
      function: {
        name: call.function?.name ?? current?.function?.name ?? '',
        arguments: `${current?.function?.arguments ?? ''}${call.function?.arguments ?? ''}`,
      },
    });
  }

  private toolCallsOf(calls: WireToolCall[]): AiToolCall[] {
    return calls
      .filter((call) => Boolean(call.function?.name))
      .map((call, index) => ({
        id: call.id ?? `call_${index}`,
        name: call.function?.name ?? '',
        arguments: call.function?.arguments ?? '{}',
      }));
  }

  private usageOf(usage?: WireUsage): AiUsage {
    return {
      tokensIn: usage?.prompt_tokens ?? 0,
      tokensOut: usage?.completion_tokens ?? 0,
    };
  }
}
